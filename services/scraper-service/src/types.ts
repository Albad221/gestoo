/**
 * Types for the Scraper Service
 */

export interface ScrapedListing {
  platform: Platform;
  platformId: string;
  url: string;
  title?: string;
  description?: string;
  locationText?: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  hostName?: string;
  hostId?: string;
  hostProfileUrl?: string;
  pricePerNight?: number;
  currency?: string;
  propertyType?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  photos?: string[];
  rating?: number;
  reviewCount?: number;
  rawData?: Record<string, any>;
}

export type Platform =
  | 'airbnb'
  | 'booking'
  | 'expedia'
  | 'tripadvisor'
  | 'facebook'
  | 'jumia_house'
  | 'expat_dakar'
  | 'coinafrique'
  | 'keur_immo'
  | 'mamaison'
  | 'local_site';

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'room'
  | 'villa'
  | 'studio'
  | 'guesthouse'
  | 'hotel'
  | 'other';

export interface ScrapeJob {
  id?: string;
  platform: Platform;
  jobType: 'full_scan' | 'incremental' | 'targeted';
  targetParams: {
    city?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    maxPages?: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  listingsFound?: number;
  listingsNew?: number;
  listingsUpdated?: number;
  errorMessage?: string;
}

export interface MatchResult {
  scrapedListingId: string;
  propertyId?: string;
  matchType: 'exact' | 'probable' | 'possible' | 'no_match';
  matchScore: number;
  matchFactors: {
    addressMatch?: number;
    coordinateDistance?: number;
    hostNameMatch?: number;
    propertyTypeMatch?: boolean;
    bedroomMatch?: boolean;
    priceProximity?: number;
  };
}

export interface ScraperConfig {
  platform: Platform;
  enabled: boolean;
  rateLimit: number; // requests per minute
  maxConcurrent: number;
  userAgent?: string;
  proxy?: string;
}

export interface MarketMetrics {
  totalListings: number;
  registeredListings: number;
  complianceRate: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  propertyTypes: Record<PropertyType, number>;
  occupancyEstimate?: number;
  newListings: number;
  removedListings: number;
  platformDistribution: Record<Platform, number>;
}
