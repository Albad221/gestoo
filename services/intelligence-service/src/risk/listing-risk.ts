import { SupabaseClient } from '@supabase/supabase-js';
import { ListingRiskScore, RiskFactor } from '../types';

interface ScrapedListing {
  id: string;
  source_url: string;
  platform: string;
  title: string;
  description: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  price_per_night?: number;
  bedrooms?: number;
  host_name?: string;
  host_id?: string;
  review_count?: number;
  rating?: number;
  first_scraped_at: string;
  last_scraped_at: string;
  matched_registration: boolean;
  matched_landlord_id?: string;
}

export class ListingRiskScorer {
  private supabase: SupabaseClient;

  // Risk factor weights
  private readonly WEIGHTS = {
    matchStatus: 0.25,
    activityLevel: 0.20,
    revenueEstimate: 0.20,
    listingAge: 0.10,
    hostProfile: 0.15,
    location: 0.10,
  };

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Calculate risk score for a scraped listing
   */
  async calculateRiskScore(listingId: string): Promise<ListingRiskScore> {
    const listing = await this.getListingData(listingId);

    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }

    const factors: RiskFactor[] = [];

    // Match Status Factor (unmatched = high priority)
    const matchScore = this.calculateMatchScore(listing);
    factors.push({
      name: 'Registration Match Status',
      weight: this.WEIGHTS.matchStatus,
      score: matchScore,
      description: listing.matched_registration
        ? 'Matched to registered property'
        : 'No registration match found',
    });

    // Activity Level Factor
    const activityScore = await this.calculateActivityScore(listing);
    factors.push({
      name: 'Activity Level',
      weight: this.WEIGHTS.activityLevel,
      score: activityScore.score,
      description: activityScore.description,
    });

    // Revenue Estimate Factor
    const revenueScore = this.calculateRevenueScore(listing);
    factors.push({
      name: 'Estimated Revenue',
      weight: this.WEIGHTS.revenueEstimate,
      score: revenueScore.score,
      description: revenueScore.description,
    });

    // Listing Age Factor (older = more established)
    const ageScore = this.calculateAgeScore(listing);
    factors.push({
      name: 'Listing Age',
      weight: this.WEIGHTS.listingAge,
      score: ageScore,
      description: this.getAgeDescription(listing.first_scraped_at),
    });

    // Host Profile Factor
    const hostScore = await this.calculateHostScore(listing);
    factors.push({
      name: 'Host Profile',
      weight: this.WEIGHTS.hostProfile,
      score: hostScore.score,
      description: hostScore.description,
    });

    // Location Factor
    const locationScore = await this.calculateLocationScore(listing);
    factors.push({
      name: 'Location Risk',
      weight: this.WEIGHTS.location,
      score: locationScore.score,
      description: locationScore.description,
    });

    // Calculate weighted overall score (inverted - higher score = higher risk for investigation)
    const riskScore = 100 - factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0
    );

    const riskLevel = this.determineRiskLevel(riskScore);
    const investigationPriority = this.calculateInvestigationPriority(
      riskScore,
      revenueScore.estimatedRevenue
    );
    const recommendations = this.generateRecommendations(listing, factors);

    return {
      listingId,
      sourceUrl: listing.source_url,
      overallScore: riskScore,
      riskLevel,
      investigationPriority,
      factors,
      matchedLandlord: listing.matched_landlord_id,
      estimatedRevenue: revenueScore.estimatedRevenue,
      recommendations,
    };
  }

  /**
   * Get listing data from database
   */
  private async getListingData(listingId: string): Promise<ScrapedListing | null> {
    const { data, error } = await this.supabase
      .from('scraped_listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (error) {
      console.error('Error fetching listing:', error);
      return null;
    }

    return data;
  }

  /**
   * Calculate match status score
   */
  private calculateMatchScore(listing: ScrapedListing): number {
    if (listing.matched_registration) {
      return 100; // Matched = low risk
    }
    return 0; // Unmatched = high priority
  }

  /**
   * Calculate activity level score based on reviews and bookings
   */
  private async calculateActivityScore(
    listing: ScrapedListing
  ): Promise<{ score: number; description: string }> {
    const reviewCount = listing.review_count || 0;
    const daysSinceFirstScrape = Math.floor(
      (new Date().getTime() - new Date(listing.first_scraped_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Reviews per month as activity indicator
    const monthsActive = Math.max(1, daysSinceFirstScrape / 30);
    const reviewsPerMonth = reviewCount / monthsActive;

    let score: number;
    let description: string;

    if (reviewsPerMonth >= 10) {
      score = 10; // Very active = high priority
      description = 'Highly active listing with frequent bookings';
    } else if (reviewsPerMonth >= 5) {
      score = 30;
      description = 'Moderately active listing';
    } else if (reviewsPerMonth >= 2) {
      score = 50;
      description = 'Regular activity observed';
    } else if (reviewsPerMonth >= 0.5) {
      score = 70;
      description = 'Low activity level';
    } else {
      score = 90; // Inactive = low priority
      description = 'Minimal or no activity';
    }

    return { score, description };
  }

  /**
   * Calculate revenue estimate score
   */
  private calculateRevenueScore(
    listing: ScrapedListing
  ): { score: number; description: string; estimatedRevenue: number } {
    const pricePerNight = listing.price_per_night || 100;
    const reviewCount = listing.review_count || 0;

    // Estimate nights booked (rough: 2-3 nights per review on average)
    const estimatedNightsPerMonth = Math.min(25, reviewCount * 2.5);
    const estimatedMonthlyRevenue = pricePerNight * estimatedNightsPerMonth;
    const estimatedAnnualRevenue = estimatedMonthlyRevenue * 12;

    // Calculate TPT impact (5.5% in Arizona)
    const estimatedTptLoss = estimatedAnnualRevenue * 0.055;

    let score: number;
    let description: string;

    if (estimatedAnnualRevenue >= 100000) {
      score = 5; // High revenue = very high priority
      description = `High revenue property (~$${Math.round(estimatedAnnualRevenue).toLocaleString()}/year)`;
    } else if (estimatedAnnualRevenue >= 50000) {
      score = 20;
      description = `Significant revenue (~$${Math.round(estimatedAnnualRevenue).toLocaleString()}/year)`;
    } else if (estimatedAnnualRevenue >= 25000) {
      score = 40;
      description = `Moderate revenue (~$${Math.round(estimatedAnnualRevenue).toLocaleString()}/year)`;
    } else if (estimatedAnnualRevenue >= 10000) {
      score = 65;
      description = `Low-moderate revenue (~$${Math.round(estimatedAnnualRevenue).toLocaleString()}/year)`;
    } else {
      score = 85;
      description = `Low revenue property (~$${Math.round(estimatedAnnualRevenue).toLocaleString()}/year)`;
    }

    return { score, description, estimatedRevenue: estimatedAnnualRevenue };
  }

  /**
   * Calculate listing age score
   */
  private calculateAgeScore(listing: ScrapedListing): number {
    const daysSinceFirstScrape = Math.floor(
      (new Date().getTime() - new Date(listing.first_scraped_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Older listings that are still unregistered are higher priority
    if (daysSinceFirstScrape >= 365) return 20; // 1+ year
    if (daysSinceFirstScrape >= 180) return 35; // 6+ months
    if (daysSinceFirstScrape >= 90) return 50;  // 3+ months
    if (daysSinceFirstScrape >= 30) return 70;  // 1+ month
    return 85; // New listing
  }

  /**
   * Calculate host profile score
   */
  private async calculateHostScore(
    listing: ScrapedListing
  ): Promise<{ score: number; description: string }> {
    if (!listing.host_id) {
      return { score: 30, description: 'Unknown host profile' };
    }

    // Check if host has multiple listings
    const { data: hostListings, error } = await this.supabase
      .from('scraped_listings')
      .select('id, matched_registration')
      .eq('host_id', listing.host_id);

    if (error) {
      return { score: 50, description: 'Could not analyze host profile' };
    }

    const totalListings = hostListings?.length || 1;
    const unregisteredListings = hostListings?.filter(
      (l) => !l.matched_registration
    ).length || 0;

    if (totalListings >= 5 && unregisteredListings >= 3) {
      return {
        score: 10,
        description: `Commercial host with ${totalListings} listings (${unregisteredListings} unregistered)`,
      };
    }

    if (totalListings >= 3) {
      return {
        score: 30,
        description: `Multi-property host with ${totalListings} listings`,
      };
    }

    if (totalListings > 1) {
      return {
        score: 50,
        description: 'Host with multiple properties',
      };
    }

    return {
      score: 70,
      description: 'Single property host',
    };
  }

  /**
   * Calculate location-based risk score
   */
  private async calculateLocationScore(
    listing: ScrapedListing
  ): Promise<{ score: number; description: string }> {
    // Check if location is in a known hotspot area
    const { data: hotspots, error } = await this.supabase
      .from('enforcement_hotspots')
      .select('city, risk_level')
      .eq('city', listing.city);

    if (error || !hotspots || hotspots.length === 0) {
      return { score: 50, description: `Location: ${listing.city}` };
    }

    const hotspot = hotspots[0];

    switch (hotspot.risk_level) {
      case 'critical':
        return {
          score: 15,
          description: `Critical enforcement area: ${listing.city}`,
        };
      case 'high':
        return {
          score: 30,
          description: `High priority area: ${listing.city}`,
        };
      case 'medium':
        return {
          score: 50,
          description: `Moderate priority area: ${listing.city}`,
        };
      default:
        return {
          score: 70,
          description: `Lower priority area: ${listing.city}`,
        };
    }
  }

  /**
   * Get age description
   */
  private getAgeDescription(firstScrapedAt: string): string {
    const days = Math.floor(
      (new Date().getTime() - new Date(firstScrapedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (days >= 365) return `Active for ${Math.floor(days / 365)} year(s)`;
    if (days >= 30) return `Active for ${Math.floor(days / 30)} month(s)`;
    return `Active for ${days} day(s)`;
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate investigation priority (1-100)
   */
  private calculateInvestigationPriority(
    riskScore: number,
    estimatedRevenue: number
  ): number {
    // Combine risk score with revenue impact
    const revenueWeight = Math.min(30, (estimatedRevenue / 100000) * 30);
    return Math.min(100, Math.round(riskScore * 0.7 + revenueWeight));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    listing: ScrapedListing,
    factors: RiskFactor[]
  ): string[] {
    const recommendations: string[] = [];

    if (!listing.matched_registration) {
      recommendations.push(
        'Initiate registration verification process'
      );
    }

    const hostFactor = factors.find((f) => f.name === 'Host Profile');
    if (hostFactor && hostFactor.score < 30) {
      recommendations.push(
        'Investigate all properties from this host'
      );
    }

    const revenueFactor = factors.find((f) => f.name === 'Estimated Revenue');
    if (revenueFactor && revenueFactor.score < 30) {
      recommendations.push(
        'High revenue impact - prioritize for enforcement'
      );
    }

    const ageFactor = factors.find((f) => f.name === 'Listing Age');
    if (ageFactor && ageFactor.score < 40) {
      recommendations.push(
        'Long-standing non-compliance - consider penalties'
      );
    }

    return recommendations;
  }

  /**
   * Get prioritized list of unregistered listings
   */
  async getPrioritizedListings(limit: number = 50): Promise<ListingRiskScore[]> {
    const { data: listings, error } = await this.supabase
      .from('scraped_listings')
      .select('id')
      .eq('matched_registration', false)
      .limit(200);

    if (error || !listings) {
      console.error('Error fetching listings:', error);
      return [];
    }

    const scores: ListingRiskScore[] = [];

    for (const listing of listings) {
      try {
        const score = await this.calculateRiskScore(listing.id);
        scores.push(score);
      } catch (err) {
        console.error(`Error scoring listing ${listing.id}:`, err);
      }
    }

    // Sort by investigation priority
    return scores
      .sort((a, b) => b.investigationPriority - a.investigationPriority)
      .slice(0, limit);
  }

  /**
   * Bulk update risk scores for all unregistered listings
   */
  async updateAllRiskScores(): Promise<{ processed: number; errors: number }> {
    const { data: listings, error } = await this.supabase
      .from('scraped_listings')
      .select('id')
      .eq('matched_registration', false);

    if (error) {
      console.error('Error fetching listings:', error);
      return { processed: 0, errors: 1 };
    }

    let processed = 0;
    let errors = 0;

    for (const listing of listings || []) {
      try {
        const score = await this.calculateRiskScore(listing.id);

        await this.supabase.from('listing_risk_scores').upsert({
          listing_id: listing.id,
          overall_score: score.overallScore,
          risk_level: score.riskLevel,
          investigation_priority: score.investigationPriority,
          estimated_revenue: score.estimatedRevenue,
          factors: score.factors,
          recommendations: score.recommendations,
          updated_at: new Date().toISOString(),
        });

        processed++;
      } catch (err) {
        console.error(`Error processing listing ${listing.id}:`, err);
        errors++;
      }
    }

    return { processed, errors };
  }
}
