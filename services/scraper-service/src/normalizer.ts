/**
 * Data Normalizer
 * Standardizes scraped data from all sources before database storage
 *
 * This ensures consistent data format regardless of scraper source
 */

import { ScrapedListing, Platform, PropertyType } from './types.js';

/**
 * Normalized listing ready for database storage
 * Maps to actual database column names
 */
export interface NormalizedListing {
  // Required fields
  platform: Platform;
  platform_id: string;
  url: string;

  // Property details
  title?: string;
  description?: string;
  property_type?: PropertyType;

  // Price
  price?: number;           // Per night (converted if monthly)
  currency: string;

  // Location
  location_text?: string;
  city: string;
  region: string;
  latitude?: number;
  longitude?: number;

  // Host/Owner
  host_name?: string;
  host_id?: string;

  // Property specs
  num_rooms?: number;       // bedrooms
  num_guests?: number;      // max occupancy

  // Media
  photos: string[];
  amenities: string[];

  // Reviews
  rating?: number;
  num_reviews?: number;

  // Raw data (extra fields that don't have columns)
  raw_data: {
    bathrooms?: number;
    beds?: number;
    surface_area?: number;
    phone?: string;
    whatsapp?: string;
    is_superhost?: boolean;
    neighborhood?: string;
    host_profile_url?: string;
    price_frequency?: 'nightly' | 'monthly' | 'unknown';
    original_price?: number;
    scraped_at: string;
    [key: string]: any;
  };

  // Timestamps
  last_seen_at: string;
}

/**
 * Normalize a ScrapedListing to database format
 */
export function normalizeListing(listing: ScrapedListing): NormalizedListing {
  // Determine price (convert monthly to nightly if needed)
  let price = listing.pricePerNight;
  let priceFrequency: 'nightly' | 'monthly' | 'unknown' = 'nightly';

  if (listing.rawData?.priceFrequency === 'monthly' && price) {
    priceFrequency = 'monthly';
    price = Math.round(price / 30);
  }

  // Normalize city name
  const city = normalizeCity(listing.city);

  // Build normalized listing
  const normalized: NormalizedListing = {
    platform: listing.platform,
    platform_id: String(listing.platformId),
    url: listing.url,

    title: listing.title?.trim(),
    description: listing.description?.trim(),
    property_type: normalizePropertyType(listing.propertyType),

    price,
    currency: listing.currency || 'XOF',

    location_text: listing.locationText?.trim(),
    city,
    region: determineRegion(city),
    latitude: validCoordinate(listing.latitude, -90, 90),
    longitude: validCoordinate(listing.longitude, -180, 180),

    host_name: listing.hostName?.trim(),
    host_id: listing.hostId,

    num_rooms: listing.bedrooms,
    num_guests: listing.maxGuests,

    photos: (listing.photos || []).filter(Boolean).slice(0, 20),
    amenities: normalizeAmenities(listing.amenities || []),

    rating: validRating(listing.rating),
    num_reviews: listing.reviewCount,

    raw_data: {
      bathrooms: listing.bathrooms,
      beds: listing.rawData?.beds,
      surface_area: listing.rawData?.surfaceArea || listing.rawData?.surface,
      phone: normalizePhone(listing.rawData?.phone || listing.rawData?.phoneNumber),
      whatsapp: normalizePhone(listing.rawData?.whatsapp),
      is_superhost: listing.rawData?.is_superhost || listing.rawData?.isSuperhost,
      neighborhood: listing.neighborhood,
      host_profile_url: listing.hostProfileUrl,
      price_frequency: priceFrequency,
      original_price: listing.pricePerNight,
      scraped_at: listing.rawData?.scrapedAt || new Date().toISOString(),
      // Preserve any other raw data
      ...Object.fromEntries(
        Object.entries(listing.rawData || {}).filter(([key]) =>
          !['phone', 'phoneNumber', 'whatsapp', 'surfaceArea', 'surface',
            'is_superhost', 'isSuperhost', 'scrapedAt', 'beds'].includes(key)
        )
      ),
    },

    last_seen_at: new Date().toISOString(),
  };

  return normalized;
}

/**
 * Normalize city name to standard format
 */
function normalizeCity(city?: string): string {
  if (!city) return 'Dakar';

  const cityMap: Record<string, string> = {
    'dakar': 'Dakar',
    'dakar-region': 'Dakar',
    'thies': 'Thiès',
    'thiès': 'Thiès',
    'saint-louis': 'Saint-Louis',
    'saint louis': 'Saint-Louis',
    'mbour': 'Mbour',
    'saly': 'Saly',
    'rufisque': 'Rufisque',
    'pikine': 'Pikine',
    'guediawaye': 'Guédiawaye',
    'ziguinchor': 'Ziguinchor',
    'kaolack': 'Kaolack',
    'touba': 'Touba',
    'cap skirring': 'Cap Skirring',
    'ngor': 'Dakar',
    'almadies': 'Dakar',
    'plateau': 'Dakar',
    'mermoz': 'Dakar',
    'ouakam': 'Dakar',
    'yoff': 'Dakar',
    'fann': 'Dakar',
    'point e': 'Dakar',
    'sacre coeur': 'Dakar',
  };

  const normalized = city.toLowerCase().trim();
  return cityMap[normalized] || city;
}

/**
 * Determine region from city
 */
function determineRegion(city: string): string {
  const regionMap: Record<string, string> = {
    'Dakar': 'Dakar',
    'Pikine': 'Dakar',
    'Guédiawaye': 'Dakar',
    'Rufisque': 'Dakar',
    'Thiès': 'Thiès',
    'Mbour': 'Thiès',
    'Saly': 'Thiès',
    'Saint-Louis': 'Saint-Louis',
    'Ziguinchor': 'Ziguinchor',
    'Cap Skirring': 'Ziguinchor',
    'Kaolack': 'Kaolack',
    'Touba': 'Diourbel',
  };

  return regionMap[city] || 'Dakar';
}

/**
 * Normalize property type
 */
function normalizePropertyType(type?: string): PropertyType | undefined {
  if (!type) return undefined;

  const lower = type.toLowerCase();

  if (lower.includes('villa')) return 'villa';
  if (lower.includes('studio')) return 'studio';
  if (lower.includes('apartment') || lower.includes('appartement') || lower.includes('entire home')) return 'apartment';
  if (lower.includes('house') || lower.includes('maison')) return 'house';
  if (lower.includes('room') || lower.includes('chambre') || lower.includes('private room')) return 'room';
  if (lower.includes('hotel')) return 'hotel';
  if (lower.includes('guesthouse') || lower.includes('guest house')) return 'guesthouse';

  return 'other';
}

/**
 * Validate coordinate is within range
 */
function validCoordinate(coord: number | undefined, min: number, max: number): number | undefined {
  if (coord === undefined || coord === null || isNaN(coord)) return undefined;
  if (coord < min || coord > max) return undefined;
  return coord;
}

/**
 * Validate rating is between 0 and 5
 */
function validRating(rating: number | undefined): number | undefined {
  if (rating === undefined || rating === null || isNaN(rating)) return undefined;
  if (rating < 0 || rating > 5) return undefined;
  return Math.round(rating * 100) / 100; // 2 decimal places
}

/**
 * Normalize Senegalese phone number
 */
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Handle various formats
  if (digits.startsWith('00221')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('221')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Valid Senegalese numbers should be 9 digits (7X XXX XX XX or 3X XXX XX XX)
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('3'))) {
    return `+221${digits}`;
  }

  return undefined;
}

/**
 * Normalize and deduplicate amenities
 */
function normalizeAmenities(amenities: string[]): string[] {
  const normalized = new Map<string, string>();

  // Common amenity normalizations (French/English)
  const amenityMap: Record<string, string> = {
    'wifi': 'WiFi',
    'wi-fi': 'WiFi',
    'internet': 'WiFi',
    'climatisation': 'Air conditioning',
    'clim': 'Air conditioning',
    'air conditioning': 'Air conditioning',
    'ac': 'Air conditioning',
    'parking': 'Parking',
    'stationnement': 'Parking',
    'piscine': 'Pool',
    'pool': 'Pool',
    'cuisine': 'Kitchen',
    'kitchen': 'Kitchen',
    'cuisinière': 'Kitchen',
    'lave-linge': 'Washer',
    'washer': 'Washer',
    'machine à laver': 'Washer',
    'sèche-linge': 'Dryer',
    'dryer': 'Dryer',
    'tv': 'TV',
    'télévision': 'TV',
    'television': 'TV',
    'terrasse': 'Terrace',
    'balcon': 'Balcony',
    'balcony': 'Balcony',
    'jardin': 'Garden',
    'garden': 'Garden',
    'securite': 'Security',
    'security': 'Security',
    'gardien': 'Security',
    'groupe electrogene': 'Generator',
    'generator': 'Generator',
    'meuble': 'Furnished',
    'furnished': 'Furnished',
  };

  for (const amenity of amenities) {
    const clean = amenity.trim().toLowerCase();

    // Skip empty or UI elements
    if (!clean || clean.length < 2 || clean.length > 50) continue;
    if (['show', 'more', 'less', 'view', 'close', 'back', 'next', 'automatically translated'].some(skip => clean.includes(skip))) continue;

    // Apply normalization or keep original
    const normalized_name = amenityMap[clean] || amenity.trim();
    const key = normalized_name.toLowerCase();

    if (!normalized.has(key)) {
      normalized.set(key, normalized_name);
    }
  }

  return Array.from(normalized.values()).slice(0, 30);
}

/**
 * Batch normalize multiple listings
 */
export function normalizeListings(listings: ScrapedListing[]): NormalizedListing[] {
  return listings.map(normalizeListing);
}

/**
 * Data quality score for a listing (0-100)
 */
export function calculateDataQuality(listing: NormalizedListing): number {
  let score = 0;
  const weights = {
    title: 10,
    description: 10,
    price: 15,
    photos: 10,
    location_text: 5,
    latitude: 15,
    longitude: 15,
    host_name: 5,
    num_rooms: 5,
    amenities: 5,
    rating: 5,
  };

  if (listing.title) score += weights.title;
  if (listing.description && listing.description.length > 50) score += weights.description;
  if (listing.price && listing.price > 0) score += weights.price;
  if (listing.photos.length > 0) score += weights.photos;
  if (listing.location_text) score += weights.location_text;
  if (listing.latitude) score += weights.latitude;
  if (listing.longitude) score += weights.longitude;
  if (listing.host_name) score += weights.host_name;
  if (listing.num_rooms) score += weights.num_rooms;
  if (listing.amenities.length > 0) score += weights.amenities;
  if (listing.rating) score += weights.rating;

  return score;
}
