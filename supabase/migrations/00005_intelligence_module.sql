-- Intelligence Module: Scraped Listings & Analysis
-- For detecting unregistered/illegal accommodations

-- Scraped listings from OTAs and rental platforms
CREATE TABLE scraped_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- 'airbnb', 'booking', 'expedia', 'facebook', 'local_site'
  platform_id TEXT NOT NULL, -- ID on the platform
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  location_text TEXT, -- Raw location from listing
  city TEXT,
  neighborhood TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  host_name TEXT,
  host_id TEXT,
  host_profile_url TEXT,
  price_per_night INTEGER,
  currency TEXT DEFAULT 'XOF',
  property_type TEXT, -- 'apartment', 'house', 'room', 'villa'
  bedrooms INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,
  amenities TEXT[],
  photos TEXT[],
  rating DECIMAL(3, 2),
  review_count INTEGER,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  raw_data JSONB, -- Full scraped data for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_id)
);

-- Listing match analysis (comparing scraped vs registered)
CREATE TABLE listing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL, -- 'exact', 'probable', 'possible', 'no_match'
  match_score DECIMAL(5, 4), -- 0.0000 to 1.0000
  match_factors JSONB, -- What factors contributed to match
  status TEXT DEFAULT 'pending', -- 'pending', 'verified_match', 'verified_different', 'flagged'
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Illegal listing reports (for confirmed violations)
CREATE TABLE illegal_listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  listing_match_id UUID REFERENCES listing_matches(id),
  report_type TEXT NOT NULL, -- 'unregistered', 'tax_evasion', 'false_info', 'safety_concern'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  evidence JSONB, -- Screenshots, URLs, comparison data
  status TEXT DEFAULT 'new', -- 'new', 'investigating', 'confirmed', 'resolved', 'dismissed'
  assigned_to UUID REFERENCES admin_users(id),
  action_taken TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraping jobs tracking
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'full_scan', 'incremental', 'targeted'
  target_params JSONB, -- City, area, date range, etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market intelligence aggregates
CREATE TABLE market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT,
  metrics JSONB NOT NULL,
  -- Example metrics structure:
  -- {
  --   "total_listings": 500,
  --   "registered_listings": 350,
  --   "compliance_rate": 0.70,
  --   "avg_price": 45000,
  --   "price_range": {"min": 15000, "max": 150000},
  --   "property_types": {"apartment": 300, "house": 150, "villa": 50},
  --   "occupancy_estimate": 0.65,
  --   "new_listings": 25,
  --   "removed_listings": 10,
  --   "platform_distribution": {"airbnb": 200, "booking": 180, "other": 120}
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_start, period_end, city, neighborhood)
);

-- Indexes for performance
CREATE INDEX idx_scraped_listings_platform ON scraped_listings(platform);
CREATE INDEX idx_scraped_listings_city ON scraped_listings(city);
CREATE INDEX idx_scraped_listings_location ON scraped_listings(latitude, longitude);
CREATE INDEX idx_scraped_listings_active ON scraped_listings(is_active);
CREATE INDEX idx_scraped_listings_last_seen ON scraped_listings(last_seen_at);

CREATE INDEX idx_listing_matches_status ON listing_matches(status);
CREATE INDEX idx_listing_matches_type ON listing_matches(match_type);
CREATE INDEX idx_listing_matches_score ON listing_matches(match_score);

CREATE INDEX idx_illegal_reports_status ON illegal_listing_reports(status);
CREATE INDEX idx_illegal_reports_severity ON illegal_listing_reports(severity);

CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_platform ON scrape_jobs(platform);

CREATE INDEX idx_market_intelligence_city ON market_intelligence(city);
CREATE INDEX idx_market_intelligence_period ON market_intelligence(period_start, period_end);

-- Enable RLS
ALTER TABLE scraped_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE illegal_listing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;

-- Policies for admin access (all tables are admin-only)
CREATE POLICY "Admin full access to scraped_listings"
  ON scraped_listings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to listing_matches"
  ON listing_matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to illegal_listing_reports"
  ON illegal_listing_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to scrape_jobs"
  ON scrape_jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to market_intelligence"
  ON market_intelligence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Function to update match timestamps
CREATE OR REPLACE FUNCTION update_listing_match_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_matches_updated
  BEFORE UPDATE ON listing_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_match_timestamp();

CREATE TRIGGER illegal_reports_updated
  BEFORE UPDATE ON illegal_listing_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_match_timestamp();

-- View for compliance dashboard
CREATE VIEW compliance_overview AS
SELECT
  sl.city,
  COUNT(DISTINCT sl.id) as total_scraped,
  COUNT(DISTINCT CASE WHEN lm.match_type = 'exact' OR lm.match_type = 'probable' THEN sl.id END) as likely_registered,
  COUNT(DISTINCT CASE WHEN lm.match_type = 'no_match' OR lm.id IS NULL THEN sl.id END) as likely_unregistered,
  ROUND(
    COUNT(DISTINCT CASE WHEN lm.match_type IN ('exact', 'probable') THEN sl.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT sl.id), 0) * 100,
    2
  ) as compliance_rate,
  COUNT(DISTINCT ilr.id) FILTER (WHERE ilr.status IN ('new', 'investigating')) as active_investigations
FROM scraped_listings sl
LEFT JOIN listing_matches lm ON sl.id = lm.scraped_listing_id AND lm.status != 'verified_different'
LEFT JOIN illegal_listing_reports ilr ON sl.id = ilr.scraped_listing_id
WHERE sl.is_active = TRUE
GROUP BY sl.city;
