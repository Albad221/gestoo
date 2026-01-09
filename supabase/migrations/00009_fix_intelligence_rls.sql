-- Fix RLS for intelligence module - allow admin dashboard to read scraped data
-- MVP fix: Allow public read access since this data is from public websites

-- Drop conflicting policies first
DROP POLICY IF EXISTS "Admin full access to scraped_listings" ON scraped_listings;
DROP POLICY IF EXISTS "scraped_listings_select_ministry" ON scraped_listings;
DROP POLICY IF EXISTS "scraped_listings_insert_system" ON scraped_listings;
DROP POLICY IF EXISTS "scraped_listings_update_system" ON scraped_listings;
DROP POLICY IF EXISTS "public_read_scraped_listings" ON scraped_listings;

-- Allow public read access (scraped data is from public websites)
CREATE POLICY "public_read_scraped_listings" ON scraped_listings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- System can insert and update (needed for scrapers)
CREATE POLICY "system_insert_scraped_listings" ON scraped_listings
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "system_update_scraped_listings" ON scraped_listings
  FOR UPDATE
  USING (TRUE);

-- Same for detected_owners table
DROP POLICY IF EXISTS "admin_read_detected_owners" ON detected_owners;
DROP POLICY IF EXISTS "system_insert_detected_owners" ON detected_owners;
DROP POLICY IF EXISTS "system_update_detected_owners" ON detected_owners;
DROP POLICY IF EXISTS "public_read_detected_owners" ON detected_owners;

ALTER TABLE detected_owners ENABLE ROW LEVEL SECURITY;

-- Allow public read access for MVP dashboard
CREATE POLICY "public_read_detected_owners" ON detected_owners
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "system_insert_detected_owners" ON detected_owners
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "system_update_detected_owners" ON detected_owners
  FOR UPDATE
  USING (TRUE);

-- Same for owner_listings
DROP POLICY IF EXISTS "admin_read_owner_listings" ON owner_listings;
DROP POLICY IF EXISTS "system_insert_owner_listings" ON owner_listings;
DROP POLICY IF EXISTS "public_read_owner_listings" ON owner_listings;

ALTER TABLE owner_listings ENABLE ROW LEVEL SECURITY;

-- Allow public read access for MVP dashboard
CREATE POLICY "public_read_owner_listings" ON owner_listings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "system_insert_owner_listings" ON owner_listings
  FOR INSERT
  WITH CHECK (TRUE);
