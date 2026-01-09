import 'dotenv/config';

// Read migration SQL
const migrationSQL = `
-- Listing match analysis (comparing scraped vs registered)
CREATE TABLE IF NOT EXISTS listing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_listing_id UUID REFERENCES scraped_listings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL,
  match_score DECIMAL(5, 4),
  match_factors JSONB,
  status TEXT DEFAULT 'pending',
  verified BOOLEAN DEFAULT FALSE,
  rejected BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  job_type TEXT NOT NULL,
  target_params JSONB,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_listing_matches_status ON listing_matches(status);
CREATE INDEX IF NOT EXISTS idx_listing_matches_type ON listing_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_platform ON scrape_jobs(platform);
`;

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Running migration via Supabase...');
  console.log('URL:', supabaseUrl);

  // Split into individual statements
  const statements = migrationSQL.split(';').filter(s => s.trim());

  for (const statement of statements) {
    if (!statement.trim()) continue;

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: statement.trim()
        })
      });

      if (!response.ok) {
        const text = await response.text();
        // Ignore "already exists" errors
        if (!text.includes('already exists')) {
          console.log('Statement result:', response.status, text.substring(0, 200));
        }
      }
    } catch (err) {
      // Continue on error
    }
  }

  console.log('\\nMigration attempted. Run check-tables.mjs to verify.');
  console.log('\\nIf tables are still missing, run this SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/qqwdxyeqenaaltzfxqla/sql');
  console.log('\\n--- Copy SQL below ---');
  console.log(migrationSQL);
}

runMigration().catch(console.error);
