import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Types
type PropertyType =
  | 'apartment'
  | 'house'
  | 'room'
  | 'villa'
  | 'studio'
  | 'guesthouse'
  | 'hotel'
  | 'other';

interface ScrapedListing {
  platform: string;
  platformId: string;
  url: string;
  title?: string;
  locationText?: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  hostName?: string;
  pricePerNight?: number;
  propertyType?: PropertyType;
  bedrooms?: number;
}

interface RegisteredProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  property_type: string;
  total_rooms?: number;
  landlord?: {
    first_name: string;
    last_name: string;
    company_name?: string;
  };
}

interface MatchResult {
  propertyId: string;
  matchType: 'exact' | 'probable' | 'possible' | 'no_match';
  matchScore: number;
  matchFactors: {
    addressMatch?: number;
    coordinateDistance?: number;
    hostNameMatch?: number;
    propertyTypeMatch?: boolean;
    bedroomMatch?: boolean;
  };
}

// Haversine formula for distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Text normalization
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance based similarity
function calculateTextSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check for containment
  if (s1.includes(s2) || s2.includes(s1)) {
    const containmentScore = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return Math.max(containmentScore, 0.7);
  }

  // Simple Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

// Property type matching
function propertyTypesMatch(scrapedType: PropertyType, registeredType: string): boolean {
  const typeMapping: Record<PropertyType, string[]> = {
    apartment: ['apartment', 'appartement', 'flat'],
    house: ['house', 'maison', 'home'],
    room: ['room', 'chambre'],
    villa: ['villa'],
    studio: ['studio'],
    guesthouse: ['guesthouse', "maison d'hotes", 'guest house'],
    hotel: ['hotel', 'hostel'],
    other: [],
  };

  const registeredLower = registeredType.toLowerCase();
  const possibleMatches = typeMapping[scrapedType] || [];

  return possibleMatches.some((type) => registeredLower.includes(type));
}

// Determine match type based on score
function getMatchType(score: number): 'exact' | 'probable' | 'possible' | 'no_match' {
  if (score >= 0.8) return 'exact';
  if (score >= 0.6) return 'probable';
  if (score >= 0.4) return 'possible';
  return 'no_match';
}

describe('Listing Matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Distance Calculation (Haversine)', () => {
    it('should calculate distance of 0 for same coordinates', () => {
      const distance = calculateDistance(14.7645, -17.3660, 14.7645, -17.3660);
      expect(distance).toBe(0);
    });

    it('should calculate distance correctly for nearby points', () => {
      // Two points in Dakar approximately 1km apart
      const distance = calculateDistance(14.7645, -17.3660, 14.7735, -17.3660);
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1100);
    });

    it('should calculate distance correctly for far points', () => {
      // Dakar to Saint-Louis (~200km)
      const distance = calculateDistance(14.7645, -17.3660, 16.0237, -16.4894);
      expect(distance).toBeGreaterThan(150000);
      expect(distance).toBeLessThan(250000);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateDistance(-14.7645, -17.3660, -14.7735, -17.3660);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('Text Normalization', () => {
    it('should convert to lowercase', () => {
      expect(normalizeText('HELLO World')).toBe('hello world');
    });

    it('should remove accents', () => {
      expect(normalizeText('Mermoz Sacre-Coeur')).toBe('mermoz sacrecoeur');
      expect(normalizeText('cafe resume')).toBe('cafe resume');
    });

    it('should remove special characters', () => {
      expect(normalizeText("L'Hotel #123")).toBe('lhotel 123');
    });

    it('should collapse whitespace', () => {
      expect(normalizeText('hello   world  test')).toBe('hello world test');
    });

    it('should trim whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
    });
  });

  describe('Text Similarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(calculateTextSimilarity('hello world', 'hello world')).toBe(1.0);
    });

    it('should return 1.0 for identical strings after normalization', () => {
      expect(calculateTextSimilarity('Hello World!', 'hello world')).toBe(1.0);
    });

    it('should return high score for similar strings', () => {
      const similarity = calculateTextSimilarity('Hotel Dakar', 'Hotel de Dakar');
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should return high score for containment', () => {
      const similarity = calculateTextSimilarity('Hotel', 'Hotel Teranga');
      expect(similarity).toBeGreaterThanOrEqual(0.7);
    });

    it('should return 0 for empty strings', () => {
      expect(calculateTextSimilarity('', 'hello')).toBe(0);
      expect(calculateTextSimilarity('hello', '')).toBe(0);
    });

    it('should return low score for completely different strings', () => {
      const similarity = calculateTextSimilarity('abc', 'xyz');
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('Property Type Matching', () => {
    it('should match apartment types', () => {
      expect(propertyTypesMatch('apartment', 'Apartment')).toBe(true);
      expect(propertyTypesMatch('apartment', 'appartement meuble')).toBe(true);
    });

    it('should match house types', () => {
      expect(propertyTypesMatch('house', 'Maison')).toBe(true);
      expect(propertyTypesMatch('house', 'House')).toBe(true);
    });

    it('should match villa type', () => {
      expect(propertyTypesMatch('villa', 'Villa de luxe')).toBe(true);
    });

    it('should match hotel types', () => {
      expect(propertyTypesMatch('hotel', 'Hotel')).toBe(true);
      expect(propertyTypesMatch('hotel', 'Hostel Backpackers')).toBe(true);
    });

    it('should match guesthouse types', () => {
      expect(propertyTypesMatch('guesthouse', "Maison d'hotes")).toBe(true);
      expect(propertyTypesMatch('guesthouse', 'Guest House')).toBe(true);
    });

    it('should not match unrelated types', () => {
      expect(propertyTypesMatch('apartment', 'Villa')).toBe(false);
      expect(propertyTypesMatch('hotel', 'Apartment')).toBe(false);
    });
  });

  describe('Match Type Determination', () => {
    it('should return exact for score >= 0.8', () => {
      expect(getMatchType(0.8)).toBe('exact');
      expect(getMatchType(0.9)).toBe('exact');
      expect(getMatchType(1.0)).toBe('exact');
    });

    it('should return probable for score >= 0.6', () => {
      expect(getMatchType(0.6)).toBe('probable');
      expect(getMatchType(0.7)).toBe('probable');
      expect(getMatchType(0.79)).toBe('probable');
    });

    it('should return possible for score >= 0.4', () => {
      expect(getMatchType(0.4)).toBe('possible');
      expect(getMatchType(0.5)).toBe('possible');
      expect(getMatchType(0.59)).toBe('possible');
    });

    it('should return no_match for score < 0.4', () => {
      expect(getMatchType(0.0)).toBe('no_match');
      expect(getMatchType(0.2)).toBe('no_match');
      expect(getMatchType(0.39)).toBe('no_match');
    });
  });

  describe('Match Score Calculation', () => {
    it('should give high score for close coordinates', () => {
      const listing: ScrapedListing = {
        platform: 'airbnb',
        platformId: '123',
        url: 'https://airbnb.com/123',
        latitude: 14.7645,
        longitude: -17.3660,
      };

      const property: RegisteredProperty = {
        id: 'prop-1',
        name: 'Hotel Test',
        address: 'Rue Test',
        city: 'Dakar',
        latitude: 14.7645,
        longitude: -17.3660,
        property_type: 'hotel',
      };

      const distance = calculateDistance(
        listing.latitude!,
        listing.longitude!,
        property.latitude!,
        property.longitude!
      );

      expect(distance).toBe(0);
    });

    it('should match on address similarity', () => {
      const listing: ScrapedListing = {
        platform: 'airbnb',
        platformId: '123',
        url: 'https://airbnb.com/123',
        locationText: 'Mermoz Sacre-Coeur, Dakar',
      };

      const property: RegisteredProperty = {
        id: 'prop-1',
        name: 'Hotel Test',
        address: 'Mermoz Sacre-Coeur',
        city: 'Dakar',
        property_type: 'hotel',
      };

      const similarity = calculateTextSimilarity(
        listing.locationText!,
        property.address
      );

      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should match on host/landlord name', () => {
      const listing: ScrapedListing = {
        platform: 'airbnb',
        platformId: '123',
        url: 'https://airbnb.com/123',
        hostName: 'Amadou Diallo',
      };

      const property: RegisteredProperty = {
        id: 'prop-1',
        name: 'Hotel Test',
        address: 'Rue Test',
        city: 'Dakar',
        property_type: 'hotel',
        landlord: {
          first_name: 'Amadou',
          last_name: 'Diallo',
        },
      };

      const landlordFullName = `${property.landlord!.first_name} ${property.landlord!.last_name}`;
      const similarity = calculateTextSimilarity(listing.hostName!, landlordFullName);

      expect(similarity).toBe(1.0);
    });

    it('should consider bedroom count match', () => {
      const listing: ScrapedListing = {
        platform: 'airbnb',
        platformId: '123',
        url: 'https://airbnb.com/123',
        bedrooms: 3,
      };

      const property: RegisteredProperty = {
        id: 'prop-1',
        name: 'Apartment',
        address: 'Rue Test',
        city: 'Dakar',
        property_type: 'apartment',
        total_rooms: 3,
      };

      const bedroomMatch = listing.bedrooms === property.total_rooms;
      expect(bedroomMatch).toBe(true);
    });
  });

  describe('Match Result Filtering', () => {
    it('should filter out matches below threshold', () => {
      const matches: MatchResult[] = [
        { propertyId: '1', matchType: 'exact', matchScore: 0.9, matchFactors: {} },
        { propertyId: '2', matchType: 'possible', matchScore: 0.45, matchFactors: {} },
        { propertyId: '3', matchType: 'no_match', matchScore: 0.15, matchFactors: {} },
      ];

      const threshold = 0.2;
      const filtered = matches.filter((m) => m.matchScore > threshold);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.propertyId)).toContain('1');
      expect(filtered.map((m) => m.propertyId)).toContain('2');
    });

    it('should sort matches by score descending', () => {
      const matches: MatchResult[] = [
        { propertyId: '1', matchType: 'possible', matchScore: 0.5, matchFactors: {} },
        { propertyId: '2', matchType: 'exact', matchScore: 0.9, matchFactors: {} },
        { propertyId: '3', matchType: 'probable', matchScore: 0.7, matchFactors: {} },
      ];

      const sorted = [...matches].sort((a, b) => b.matchScore - a.matchScore);

      expect(sorted[0].propertyId).toBe('2');
      expect(sorted[1].propertyId).toBe('3');
      expect(sorted[2].propertyId).toBe('1');
    });

    it('should limit to top 5 matches', () => {
      const matches: MatchResult[] = Array.from({ length: 10 }, (_, i) => ({
        propertyId: `${i}`,
        matchType: 'possible' as const,
        matchScore: 0.5 + i * 0.05,
        matchFactors: {},
      }));

      const topMatches = matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);

      expect(topMatches).toHaveLength(5);
      expect(topMatches[0].matchScore).toBeGreaterThan(topMatches[4].matchScore);
    });
  });
});
