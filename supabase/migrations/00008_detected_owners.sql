-- Migration: Detected Owners for Entity Resolution
-- PREREQUISITE: Run migration 00005_intelligence_module.sql first if scraped_listings doesn't exist

-- Create scraped_listings if it doesn't exist (from migration 00005)
CREATE TABLE IF NOT EXISTS scraped_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  url TEXT,
  title TEXT,
  description TEXT,
  price INTEGER,
  currency TEXT DEFAULT 'XOF',
  location_text TEXT,
  city TEXT,
  region TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  host_name TEXT,
  host_id TEXT,
  num_rooms INTEGER,
  num_guests INTEGER,
  photos TEXT[],
  amenities TEXT[],
  rating DECIMAL(3, 2),
  num_reviews INTEGER,
  status TEXT DEFAULT 'active',
  matched_property_id UUID,
  is_compliant BOOLEAN,
  is_active BOOLEAN DEFAULT TRUE,
  compliance_checked_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_id)
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_scraped_listings_platform ON scraped_listings(platform);
CREATE INDEX IF NOT EXISTS idx_scraped_listings_city ON scraped_listings(city);
CREATE INDEX IF NOT EXISTS idx_scraped_listings_active ON scraped_listings(is_active);

-- Detected owners table
CREATE TABLE IF NOT EXISTS detected_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner identification
  primary_phone TEXT,
  primary_email TEXT,
  names TEXT[] DEFAULT '{}',
  host_ids TEXT[] DEFAULT '{}',

  -- Activity metrics
  platforms TEXT[] DEFAULT '{}',
  listing_count INTEGER DEFAULT 0,
  active_listing_count INTEGER DEFAULT 0,
  registered_count INTEGER DEFAULT 0,
  unregistered_count INTEGER DEFAULT 0,

  -- Financial estimates
  estimated_monthly_revenue INTEGER DEFAULT 0,
  avg_price_per_night INTEGER DEFAULT 0,

  -- Risk scoring
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '[]',
  priority_rank INTEGER,

  -- Status
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'under_review', 'verified', 'dismissed')),
  notes TEXT,

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: links owners to their listings
CREATE TABLE IF NOT EXISTS owner_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES detected_owners(id) ON DELETE CASCADE,
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  match_type TEXT DEFAULT 'phone' CHECK (match_type IN ('phone', 'host_id', 'email', 'name', 'manual')),
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(owner_id, scraped_listing_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detected_owners_phone ON detected_owners(primary_phone) WHERE primary_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detected_owners_risk ON detected_owners(risk_score DESC, priority_rank);
CREATE INDEX IF NOT EXISTS idx_detected_owners_status ON detected_owners(status);
CREATE INDEX IF NOT EXISTS idx_owner_listings_owner ON owner_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_listings_listing ON owner_listings(scraped_listing_id);

-- Update trigger for detected_owners
CREATE OR REPLACE FUNCTION update_detected_owners_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS detected_owners_updated_at ON detected_owners;
CREATE TRIGGER detected_owners_updated_at
  BEFORE UPDATE ON detected_owners
  FOR EACH ROW
  EXECUTE FUNCTION update_detected_owners_timestamp();

-- Function to calculate risk score
CREATE OR REPLACE FUNCTION calculate_owner_risk_score(owner_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  owner_record RECORD;
  risk INTEGER := 0;
  factors JSONB := '[]';
BEGIN
  SELECT * INTO owner_record FROM detected_owners WHERE id = owner_id_param;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Multi-property penalty
  IF owner_record.listing_count > 1 THEN
    risk := risk + (owner_record.listing_count - 1) * 10;
    factors := factors || jsonb_build_object(
      'factor', 'multi_property',
      'count', owner_record.listing_count,
      'points', (owner_record.listing_count - 1) * 10
    );
  END IF;

  -- Unregistered penalty
  IF owner_record.unregistered_count > 0 THEN
    risk := risk + owner_record.unregistered_count * 15;
    factors := factors || jsonb_build_object(
      'factor', 'unregistered_listings',
      'count', owner_record.unregistered_count,
      'points', owner_record.unregistered_count * 15
    );
  END IF;

  -- Multi-platform presence
  IF array_length(owner_record.platforms, 1) > 1 THEN
    risk := risk + (array_length(owner_record.platforms, 1) - 1) * 5;
    factors := factors || jsonb_build_object(
      'factor', 'multi_platform',
      'platforms', owner_record.platforms,
      'points', (array_length(owner_record.platforms, 1) - 1) * 5
    );
  END IF;

  -- High revenue
  IF owner_record.estimated_monthly_revenue > 0 THEN
    risk := risk + (owner_record.estimated_monthly_revenue / 100000);
    factors := factors || jsonb_build_object(
      'factor', 'high_revenue',
      'monthly_xof', owner_record.estimated_monthly_revenue,
      'points', owner_record.estimated_monthly_revenue / 100000
    );
  END IF;

  risk := LEAST(risk, 100);

  UPDATE detected_owners
  SET risk_score = risk, risk_factors = factors
  WHERE id = owner_id_param;

  RETURN risk;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE detected_owners IS 'Entity resolution - groups listings by owner across platforms';
COMMENT ON TABLE owner_listings IS 'Links detected owners to their scraped listings';
