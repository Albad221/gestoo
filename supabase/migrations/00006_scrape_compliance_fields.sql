-- Add compliance tracking fields to scraped_listings
ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS matched_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS is_compliant BOOLEAN DEFAULT FALSE;
ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS compliance_checked_at TIMESTAMPTZ;
ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS region TEXT;

-- Rename price_per_night to price for consistency (keep both for backwards compatibility)
ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS price INTEGER;

-- Update price from price_per_night if it exists
UPDATE scraped_listings SET price = price_per_night WHERE price IS NULL AND price_per_night IS NOT NULL;

-- Create index for compliance queries
CREATE INDEX IF NOT EXISTS idx_scraped_listings_compliant ON scraped_listings(is_compliant);
CREATE INDEX IF NOT EXISTS idx_scraped_listings_matched ON scraped_listings(matched_property_id);
