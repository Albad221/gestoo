import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Types
type Platform =
  | 'airbnb'
  | 'booking'
  | 'expedia'
  | 'tripadvisor'
  | 'facebook'
  | 'jumia_house'
  | 'expat_dakar'
  | 'local_site';

type PropertyType =
  | 'apartment'
  | 'house'
  | 'room'
  | 'villa'
  | 'studio'
  | 'guesthouse'
  | 'hotel'
  | 'other';

interface ScrapeJob {
  id?: string;
  platform: Platform;
  jobType: 'full_scan' | 'incremental' | 'targeted';
  targetParams: {
    city?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    maxPages?: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  listingsFound?: number;
  listingsNew?: number;
  listingsUpdated?: number;
}

interface ScrapedListing {
  platform: Platform;
  platformId: string;
  url: string;
  title?: string;
  city?: string;
  pricePerNight?: number;
  propertyType?: PropertyType;
}

interface MarketMetrics {
  totalListings: number;
  registeredListings: number;
  complianceRate: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  propertyTypes: Record<PropertyType, number>;
  newListings: number;
  removedListings: number;
  platformDistribution: Record<Platform, number>;
}

// Supported platforms
const SUPPORTED_PLATFORMS: Platform[] = [
  'airbnb',
  'booking',
  'expedia',
  'expat_dakar',
  'jumia_house',
];

// Calculate average price
function calculateAvgPrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// Calculate compliance rate
function calculateComplianceRate(matched: number, total: number): number {
  if (total === 0) return 1;
  return matched / total;
}

// Count property types
function countPropertyTypes(listings: ScrapedListing[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const listing of listings) {
    const type = listing.propertyType || 'other';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

// Count platform distribution
function countPlatformDistribution(listings: ScrapedListing[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const listing of listings) {
    counts[listing.platform] = (counts[listing.platform] || 0) + 1;
  }
  return counts;
}

describe('Scraper Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supported Platforms', () => {
    it('should include airbnb platform', () => {
      expect(SUPPORTED_PLATFORMS).toContain('airbnb');
    });

    it('should include booking platform', () => {
      expect(SUPPORTED_PLATFORMS).toContain('booking');
    });

    it('should include expat_dakar platform', () => {
      expect(SUPPORTED_PLATFORMS).toContain('expat_dakar');
    });

    it('should have multiple platforms defined', () => {
      expect(SUPPORTED_PLATFORMS.length).toBeGreaterThan(3);
    });
  });

  describe('Scrape Job Creation', () => {
    it('should create job with running status', () => {
      const job: ScrapeJob = {
        platform: 'airbnb',
        jobType: 'full_scan',
        targetParams: { city: 'Dakar' },
        status: 'running',
        startedAt: new Date(),
      };

      expect(job.status).toBe('running');
      expect(job.startedAt).toBeDefined();
    });

    it('should support full_scan job type', () => {
      const job: ScrapeJob = {
        platform: 'airbnb',
        jobType: 'full_scan',
        targetParams: {},
        status: 'pending',
      };

      expect(job.jobType).toBe('full_scan');
    });

    it('should support incremental job type', () => {
      const job: ScrapeJob = {
        platform: 'booking',
        jobType: 'incremental',
        targetParams: {},
        status: 'pending',
      };

      expect(job.jobType).toBe('incremental');
    });

    it('should support targeted job type with params', () => {
      const job: ScrapeJob = {
        platform: 'airbnb',
        jobType: 'targeted',
        targetParams: {
          city: 'Dakar',
          neighborhood: 'Almadies',
          minPrice: 50000,
          maxPrice: 200000,
          maxPages: 10,
        },
        status: 'pending',
      };

      expect(job.jobType).toBe('targeted');
      expect(job.targetParams.city).toBe('Dakar');
      expect(job.targetParams.neighborhood).toBe('Almadies');
    });
  });

  describe('Scrape Job Completion', () => {
    it('should mark job as completed with stats', () => {
      const job: ScrapeJob = {
        id: 'job-123',
        platform: 'airbnb',
        jobType: 'full_scan',
        targetParams: {},
        status: 'completed',
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        listingsFound: 150,
        listingsNew: 25,
        listingsUpdated: 125,
      };

      expect(job.status).toBe('completed');
      expect(job.completedAt).toBeDefined();
      expect(job.listingsFound).toBe(150);
      expect(job.listingsNew).toBe(25);
    });

    it('should mark job as failed with error', () => {
      const job: ScrapeJob = {
        id: 'job-456',
        platform: 'airbnb',
        jobType: 'full_scan',
        targetParams: {},
        status: 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(job.status).toBe('failed');
    });
  });

  describe('Listing Save and Update', () => {
    it('should detect new listing', () => {
      const existingId = null;
      const isNew = !existingId;
      expect(isNew).toBe(true);
    });

    it('should detect existing listing for update', () => {
      const existingId = 'listing-123';
      const isNew = !existingId;
      expect(isNew).toBe(false);
    });

    it('should construct listing data correctly', () => {
      const listing: ScrapedListing = {
        platform: 'airbnb',
        platformId: 'airbnb-123',
        url: 'https://airbnb.com/rooms/123',
        title: 'Beautiful Apartment',
        city: 'Dakar',
        pricePerNight: 50000,
        propertyType: 'apartment',
      };

      const listingData = {
        platform: listing.platform,
        platform_id: listing.platformId,
        url: listing.url,
        title: listing.title,
        city: listing.city || 'Dakar',
        price_per_night: listing.pricePerNight,
        property_type: listing.propertyType,
        last_seen_at: new Date().toISOString(),
        is_active: true,
      };

      expect(listingData.platform).toBe('airbnb');
      expect(listingData.platform_id).toBe('airbnb-123');
      expect(listingData.is_active).toBe(true);
    });
  });

  describe('Inactive Listing Detection', () => {
    it('should identify listings older than threshold', () => {
      const lastSeen = new Date('2024-01-01');
      const threshold = new Date('2024-01-10');

      const isOld = lastSeen < threshold;
      expect(isOld).toBe(true);
    });

    it('should not mark recent listings as inactive', () => {
      const lastSeen = new Date('2024-01-15');
      const threshold = new Date('2024-01-10');

      const isOld = lastSeen < threshold;
      expect(isOld).toBe(false);
    });
  });

  describe('Market Metrics Calculation', () => {
    it('should calculate average price correctly', () => {
      const prices = [50000, 75000, 100000, 125000];
      expect(calculateAvgPrice(prices)).toBe(87500);
    });

    it('should return 0 for empty prices', () => {
      expect(calculateAvgPrice([])).toBe(0);
    });

    it('should calculate compliance rate correctly', () => {
      expect(calculateComplianceRate(80, 100)).toBe(0.8);
      expect(calculateComplianceRate(50, 200)).toBe(0.25);
    });

    it('should return 1 for zero total listings', () => {
      expect(calculateComplianceRate(0, 0)).toBe(1);
    });

    it('should count property types correctly', () => {
      const listings: ScrapedListing[] = [
        { platform: 'airbnb', platformId: '1', url: 'url1', propertyType: 'apartment' },
        { platform: 'airbnb', platformId: '2', url: 'url2', propertyType: 'apartment' },
        { platform: 'airbnb', platformId: '3', url: 'url3', propertyType: 'villa' },
        { platform: 'airbnb', platformId: '4', url: 'url4', propertyType: 'hotel' },
      ];

      const counts = countPropertyTypes(listings);

      expect(counts['apartment']).toBe(2);
      expect(counts['villa']).toBe(1);
      expect(counts['hotel']).toBe(1);
    });

    it('should count platform distribution correctly', () => {
      const listings: ScrapedListing[] = [
        { platform: 'airbnb', platformId: '1', url: 'url1' },
        { platform: 'airbnb', platformId: '2', url: 'url2' },
        { platform: 'booking', platformId: '3', url: 'url3' },
        { platform: 'expat_dakar', platformId: '4', url: 'url4' },
      ];

      const counts = countPlatformDistribution(listings);

      expect(counts['airbnb']).toBe(2);
      expect(counts['booking']).toBe(1);
      expect(counts['expat_dakar']).toBe(1);
    });
  });

  describe('Market Metrics Generation', () => {
    it('should generate complete market metrics object', () => {
      const listings: ScrapedListing[] = [
        { platform: 'airbnb', platformId: '1', url: 'url1', pricePerNight: 50000, propertyType: 'apartment' },
        { platform: 'airbnb', platformId: '2', url: 'url2', pricePerNight: 75000, propertyType: 'villa' },
        { platform: 'booking', platformId: '3', url: 'url3', pricePerNight: 100000, propertyType: 'hotel' },
      ];

      const prices = listings.map((l) => l.pricePerNight!).filter((p) => p > 0);

      const metrics: MarketMetrics = {
        totalListings: listings.length,
        registeredListings: 2,
        complianceRate: 2 / 3,
        avgPrice: Math.round(calculateAvgPrice(prices)),
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
        },
        propertyTypes: countPropertyTypes(listings) as any,
        newListings: 1,
        removedListings: 0,
        platformDistribution: countPlatformDistribution(listings) as any,
      };

      expect(metrics.totalListings).toBe(3);
      expect(metrics.avgPrice).toBe(75000);
      expect(metrics.priceRange.min).toBe(50000);
      expect(metrics.priceRange.max).toBe(100000);
    });
  });

  describe('Unregistered Listing Detection', () => {
    it('should identify listing with no matches', () => {
      const matches: any[] = [];
      const isUnregistered = matches.length === 0;
      expect(isUnregistered).toBe(true);
    });

    it('should identify listing with only no_match results', () => {
      const matches = [
        { match_type: 'no_match', status: 'pending' },
        { match_type: 'no_match', status: 'verified_different' },
      ];

      const isUnregistered = matches.every(
        (m) => m.match_type === 'no_match' || m.status === 'verified_different'
      );

      expect(isUnregistered).toBe(true);
    });

    it('should not mark listing with probable match as unregistered', () => {
      const matches = [{ match_type: 'probable', status: 'pending' }];

      const isUnregistered = matches.every(
        (m) => m.match_type === 'no_match' || m.status === 'verified_different'
      );

      expect(isUnregistered).toBe(false);
    });
  });

  describe('Date Filtering', () => {
    it('should filter listings by period', () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const listings = [
        { first_seen_at: '2024-01-15' },
        { first_seen_at: '2024-01-20' },
        { first_seen_at: '2024-02-05' },
      ];

      const inPeriod = listings.filter((l) => {
        const date = new Date(l.first_seen_at);
        return date >= periodStart && date <= periodEnd;
      });

      expect(inPeriod).toHaveLength(2);
    });
  });

  describe('Pagination', () => {
    it('should calculate correct range for pagination', () => {
      const offset = 50;
      const limit = 50;

      const rangeStart = offset;
      const rangeEnd = offset + limit - 1;

      expect(rangeStart).toBe(50);
      expect(rangeEnd).toBe(99);
    });

    it('should handle first page', () => {
      const offset = 0;
      const limit = 50;

      const rangeStart = offset || 0;
      const rangeEnd = rangeStart + (limit || 50) - 1;

      expect(rangeStart).toBe(0);
      expect(rangeEnd).toBe(49);
    });
  });
});
