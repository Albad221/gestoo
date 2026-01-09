-- Add google_places as a valid platform for hotels/establishments
ALTER TYPE listing_platform ADD VALUE IF NOT EXISTS 'google_places';

-- Also add other useful platforms we might need
ALTER TYPE listing_platform ADD VALUE IF NOT EXISTS 'tripadvisor';
ALTER TYPE listing_platform ADD VALUE IF NOT EXISTS 'hotels_com';
