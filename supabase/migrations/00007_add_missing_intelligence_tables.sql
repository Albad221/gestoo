-- Add missing intelligence tables
-- Run this in Supabase SQL Editor if tables are missing

-- Listing match analysis (comparing scraped vs registered)
CREATE TABLE IF NOT EXISTS listing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL, -- 'exact', 'probable', 'possible', 'no_match'
  match_score DECIMAL(5, 4), -- 0.0000 to 1.0000
  match_factors JSONB, -- What factors contributed to match
  status TEXT DEFAULT 'pending', -- 'pending', 'verified_match', 'verified_different', 'flagged'
  verified BOOLEAN DEFAULT FALSE,
  rejected BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraping jobs tracking
CREATE TABLE IF NOT EXISTS scrape_jobs (
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
CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_start, period_end, city, neighborhood)
);

-- Illegal listing reports (for confirmed violations)
CREATE TABLE IF NOT EXISTS illegal_listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  listing_match_id UUID REFERENCES listing_matches(id),
  report_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  description TEXT,
  evidence JSONB,
  status TEXT DEFAULT 'new',
  assigned_to UUID,
  action_taken TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listing_matches_status ON listing_matches(status);
CREATE INDEX IF NOT EXISTS idx_listing_matches_type ON listing_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_listing_matches_score ON listing_matches(match_score);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_platform ON scrape_jobs(platform);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_city ON market_intelligence(city);

-- Disable RLS for service access (using anon key with service role would need these)
ALTER TABLE listing_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE illegal_listing_reports ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (in production, restrict to service role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listing_matches' AND policyname = 'Allow all for listing_matches') THEN
    CREATE POLICY "Allow all for listing_matches" ON listing_matches FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scrape_jobs' AND policyname = 'Allow all for scrape_jobs') THEN
    CREATE POLICY "Allow all for scrape_jobs" ON scrape_jobs FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_intelligence' AND policyname = 'Allow all for market_intelligence') THEN
    CREATE POLICY "Allow all for market_intelligence" ON market_intelligence FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'illegal_listing_reports' AND policyname = 'Allow all for illegal_listing_reports') THEN
    CREATE POLICY "Allow all for illegal_listing_reports" ON illegal_listing_reports FOR ALL USING (true);
  END IF;
END $$;
