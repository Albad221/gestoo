/**
 * Listing Matcher
 * Compares scraped listings against registered properties to detect matches
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScrapedListing, MatchResult, PropertyType } from './types.js';

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

export class ListingMatcher {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Find potential matches for a scraped listing
   */
  async findMatches(listing: ScrapedListing): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    // Get registered properties in the same city
    const { data: properties, error } = await this.supabase
      .from('properties')
      .select(`
        id,
        name,
        address,
        city,
        neighborhood,
        latitude,
        longitude,
        property_type,
        total_rooms,
        landlord:landlords (
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('city', listing.city || 'Dakar')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching properties:', error);
      return matches;
    }

    // Compare against each registered property
    for (const property of properties || []) {
      // Handle landlord being returned as an array from Supabase join
      const normalizedProperty = {
        ...property,
        landlord: Array.isArray(property.landlord) ? property.landlord[0] : property.landlord
      } as RegisteredProperty;
      const matchResult = this.calculateMatch(listing, normalizedProperty);

      // Only include matches with some relevance
      if (matchResult.matchScore > 0.2) {
        matches.push(matchResult);
      }
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches.slice(0, 5); // Return top 5 matches
  }

  /**
   * Calculate match score between scraped listing and registered property
   */
  private calculateMatch(listing: ScrapedListing, property: RegisteredProperty): MatchResult {
    const factors: MatchResult['matchFactors'] = {};
    let totalScore = 0;
    let weightSum = 0;

    // 1. Coordinate proximity (weight: 30%)
    if (listing.latitude && listing.longitude && property.latitude && property.longitude) {
      const distance = this.calculateDistance(
        listing.latitude,
        listing.longitude,
        property.latitude,
        property.longitude
      );
      factors.coordinateDistance = distance;

      // Score based on distance (0-100m = 1.0, 100-500m = 0.5-1.0, >1km = 0)
      let distanceScore = 0;
      if (distance <= 100) {
        distanceScore = 1.0;
      } else if (distance <= 500) {
        distanceScore = 1.0 - ((distance - 100) / 400) * 0.5;
      } else if (distance <= 1000) {
        distanceScore = 0.5 - ((distance - 500) / 500) * 0.5;
      }

      totalScore += distanceScore * 0.3;
      weightSum += 0.3;
    }

    // 2. Address/location text similarity (weight: 25%)
    if (listing.locationText && property.address) {
      const addressSimilarity = this.calculateTextSimilarity(
        listing.locationText.toLowerCase(),
        property.address.toLowerCase()
      );
      factors.addressMatch = addressSimilarity;
      totalScore += addressSimilarity * 0.25;
      weightSum += 0.25;

      // Also check neighborhood
      if (listing.neighborhood && property.neighborhood) {
        const neighborhoodSim = this.calculateTextSimilarity(
          listing.neighborhood.toLowerCase(),
          property.neighborhood.toLowerCase()
        );
        if (neighborhoodSim > 0.7) {
          totalScore += 0.1;
          weightSum += 0.1;
        }
      }
    }

    // 3. Host/landlord name similarity (weight: 20%)
    if (listing.hostName && property.landlord) {
      const landlordFullName = `${property.landlord.first_name} ${property.landlord.last_name}`.toLowerCase();
      const companyName = property.landlord.company_name?.toLowerCase() || '';

      const nameSimilarity = Math.max(
        this.calculateTextSimilarity(listing.hostName.toLowerCase(), landlordFullName),
        companyName ? this.calculateTextSimilarity(listing.hostName.toLowerCase(), companyName) : 0
      );

      factors.hostNameMatch = nameSimilarity;
      totalScore += nameSimilarity * 0.2;
      weightSum += 0.2;
    }

    // 4. Property type match (weight: 10%)
    if (listing.propertyType) {
      const typeMatch = this.propertyTypesMatch(listing.propertyType, property.property_type);
      factors.propertyTypeMatch = typeMatch;
      if (typeMatch) {
        totalScore += 0.1;
      }
      weightSum += 0.1;
    }

    // 5. Bedroom count match (weight: 10%)
    if (listing.bedrooms !== undefined && property.total_rooms) {
      const bedroomMatch = listing.bedrooms === property.total_rooms;
      factors.bedroomMatch = bedroomMatch;
      if (bedroomMatch) {
        totalScore += 0.1;
      } else if (Math.abs(listing.bedrooms - property.total_rooms) <= 1) {
        totalScore += 0.05; // Partial credit for close match
      }
      weightSum += 0.1;
    }

    // 6. Title/Name similarity (weight: 5%)
    if (listing.title && property.name) {
      const nameSimilarity = this.calculateTextSimilarity(
        listing.title.toLowerCase(),
        property.name.toLowerCase()
      );
      if (nameSimilarity > 0.5) {
        totalScore += nameSimilarity * 0.05;
      }
      weightSum += 0.05;
    }

    // Normalize score
    const normalizedScore = weightSum > 0 ? totalScore / weightSum : 0;

    // Determine match type
    let matchType: MatchResult['matchType'];
    if (normalizedScore >= 0.8) {
      matchType = 'exact';
    } else if (normalizedScore >= 0.6) {
      matchType = 'probable';
    } else if (normalizedScore >= 0.4) {
      matchType = 'possible';
    } else {
      matchType = 'no_match';
    }

    return {
      scrapedListingId: '', // Will be set after saving
      propertyId: property.id,
      matchType,
      matchScore: normalizedScore,
      matchFactors: factors,
    };
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  /**
   * Calculate text similarity using Levenshtein distance
   */
  private calculateTextSimilarity(str1: string, str2: string): number {
    // Normalize strings
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Check for containment
    if (s1.includes(s2) || s2.includes(s1)) {
      const containmentScore = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      return Math.max(containmentScore, 0.7);
    }

    // Calculate Levenshtein distance
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if property types match (with some flexibility)
   */
  private propertyTypesMatch(scrapedType: PropertyType, registeredType: string): boolean {
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

  /**
   * Save match results to database
   */
  async saveMatchResults(scrapedListingId: string, matches: MatchResult[]): Promise<void> {
    for (const match of matches) {
      const { error } = await this.supabase.from('listing_matches').upsert({
        scraped_listing_id: scrapedListingId,
        property_id: match.propertyId,
        match_type: match.matchType,
        match_score: match.matchScore,
        match_factors: match.matchFactors,
        status: 'pending',
      });

      if (error) {
        console.error('Error saving match result:', error);
      }
    }

    // If no good matches found, flag as potentially unregistered
    if (matches.length === 0 || matches[0].matchType === 'no_match') {
      await this.flagPotentiallyUnregistered(scrapedListingId);
    }
  }

  /**
   * Flag a listing as potentially unregistered
   */
  private async flagPotentiallyUnregistered(scrapedListingId: string): Promise<void> {
    // Create an automatic match record indicating no match
    const { error } = await this.supabase.from('listing_matches').upsert({
      scraped_listing_id: scrapedListingId,
      match_type: 'no_match',
      match_score: 0,
      match_factors: {},
      status: 'pending',
    });

    if (error) {
      console.error('Error flagging unregistered listing:', error);
    }
  }
}
