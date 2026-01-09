import { SupabaseClient } from '@supabase/supabase-js';
import { AreaRiskAssessment, RiskFactor, AreaTrend } from '../types';

interface AreaData {
  city: string;
  neighborhood?: string;
  total_properties: number;
  registered_properties: number;
  scraped_listings: number;
  unmatched_listings: number;
  total_revenue: number;
  enforcement_actions: number;
}

export class AreaRiskAssessor {
  private supabase: SupabaseClient;

  // Risk factor weights
  private readonly WEIGHTS = {
    complianceRate: 0.30,
    unregisteredDensity: 0.25,
    revenueImpact: 0.20,
    enforcementHistory: 0.15,
    growthTrend: 0.10,
  };

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get risk assessment for a specific city
   */
  async assessAreaRisk(city: string, neighborhood?: string): Promise<AreaRiskAssessment> {
    const areaData = await this.getAreaData(city, neighborhood);
    const factors = await this.calculateRiskFactors(areaData);
    const trends = await this.getAreaTrends(city, neighborhood);

    const overallScore = 100 - factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0
    );

    const riskLevel = this.determineRiskLevel(overallScore);
    const enforcementPriority = this.calculateEnforcementPriority(
      overallScore,
      areaData
    );
    const recommendations = this.generateRecommendations(areaData, factors, riskLevel);

    return {
      city,
      neighborhood,
      overallScore,
      riskLevel,
      complianceRate: areaData.total_properties > 0
        ? (areaData.registered_properties / areaData.total_properties) * 100
        : 0,
      unregisteredEstimate: areaData.unmatched_listings,
      enforcementPriority,
      factors,
      trends,
      recommendations,
    };
  }

  /**
   * Get aggregated data for an area
   */
  private async getAreaData(city: string, neighborhood?: string): Promise<AreaData> {
    // Get registered properties
    let propertiesQuery = this.supabase
      .from('properties')
      .select('id, registration_status', { count: 'exact' })
      .eq('city', city);

    if (neighborhood) {
      propertiesQuery = propertiesQuery.eq('neighborhood', neighborhood);
    }

    const { data: properties, count: totalProperties } = await propertiesQuery;

    const registeredProperties = (properties || []).filter(
      (p) => p.registration_status === 'registered'
    ).length;

    // Get scraped listings
    let listingsQuery = this.supabase
      .from('scraped_listings')
      .select('id, matched_registration', { count: 'exact' })
      .eq('city', city);

    if (neighborhood) {
      listingsQuery = listingsQuery.eq('neighborhood', neighborhood);
    }

    const { data: listings, count: totalListings } = await listingsQuery;

    const unmatchedListings = (listings || []).filter(
      (l) => !l.matched_registration
    ).length;

    // Get revenue data
    let revenueQuery = this.supabase
      .from('tpt_payments')
      .select('amount')
      .eq('city', city)
      .eq('status', 'completed');

    const { data: payments } = await revenueQuery;
    const totalRevenue = (payments || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    // Get enforcement actions
    let enforcementQuery = this.supabase
      .from('enforcement_actions')
      .select('id', { count: 'exact' })
      .eq('city', city);

    const { count: enforcementActions } = await enforcementQuery;

    return {
      city,
      neighborhood,
      total_properties: totalProperties || 0,
      registered_properties: registeredProperties,
      scraped_listings: totalListings || 0,
      unmatched_listings: unmatchedListings,
      total_revenue: totalRevenue,
      enforcement_actions: enforcementActions || 0,
    };
  }

  /**
   * Calculate risk factors for area
   */
  private async calculateRiskFactors(areaData: AreaData): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Compliance Rate Factor
    const complianceRate = areaData.total_properties > 0
      ? (areaData.registered_properties / areaData.total_properties) * 100
      : 50;
    const complianceScore = complianceRate; // Direct mapping

    factors.push({
      name: 'Compliance Rate',
      weight: this.WEIGHTS.complianceRate,
      score: complianceScore,
      description: `${complianceRate.toFixed(1)}% of properties registered`,
    });

    // Unregistered Density Factor
    const unregisteredDensity = areaData.unmatched_listings;
    let densityScore: number;
    let densityDescription: string;

    if (unregisteredDensity >= 100) {
      densityScore = 10;
      densityDescription = `High density: ${unregisteredDensity} unregistered listings`;
    } else if (unregisteredDensity >= 50) {
      densityScore = 30;
      densityDescription = `Significant: ${unregisteredDensity} unregistered listings`;
    } else if (unregisteredDensity >= 20) {
      densityScore = 50;
      densityDescription = `Moderate: ${unregisteredDensity} unregistered listings`;
    } else if (unregisteredDensity >= 5) {
      densityScore = 70;
      densityDescription = `Low: ${unregisteredDensity} unregistered listings`;
    } else {
      densityScore = 90;
      densityDescription = `Minimal: ${unregisteredDensity} unregistered listings`;
    }

    factors.push({
      name: 'Unregistered Density',
      weight: this.WEIGHTS.unregisteredDensity,
      score: densityScore,
      description: densityDescription,
    });

    // Revenue Impact Factor
    const estimatedLostRevenue = await this.estimateLostRevenue(areaData);
    let revenueScore: number;

    if (estimatedLostRevenue >= 500000) {
      revenueScore = 10;
    } else if (estimatedLostRevenue >= 200000) {
      revenueScore = 25;
    } else if (estimatedLostRevenue >= 100000) {
      revenueScore = 45;
    } else if (estimatedLostRevenue >= 50000) {
      revenueScore = 65;
    } else {
      revenueScore = 85;
    }

    factors.push({
      name: 'Revenue Impact',
      weight: this.WEIGHTS.revenueImpact,
      score: revenueScore,
      description: `Estimated lost TPT: $${estimatedLostRevenue.toLocaleString()}`,
    });

    // Enforcement History Factor
    const enforcementScore = this.calculateEnforcementHistoryScore(
      areaData.enforcement_actions,
      areaData.unmatched_listings
    );

    factors.push({
      name: 'Enforcement History',
      weight: this.WEIGHTS.enforcementHistory,
      score: enforcementScore.score,
      description: enforcementScore.description,
    });

    // Growth Trend Factor
    const growthTrend = await this.calculateGrowthTrend(areaData.city);

    factors.push({
      name: 'Growth Trend',
      weight: this.WEIGHTS.growthTrend,
      score: growthTrend.score,
      description: growthTrend.description,
    });

    return factors;
  }

  /**
   * Estimate lost revenue from unregistered properties
   */
  private async estimateLostRevenue(areaData: AreaData): Promise<number> {
    // Get average revenue per registered property
    const avgRevenuePerProperty = areaData.registered_properties > 0
      ? areaData.total_revenue / areaData.registered_properties
      : 10000; // Default estimate

    // Estimate TPT from unregistered (5.5% rate)
    const estimatedGrossRevenue = areaData.unmatched_listings * avgRevenuePerProperty;
    return estimatedGrossRevenue * 0.055;
  }

  /**
   * Calculate enforcement history score
   */
  private calculateEnforcementHistoryScore(
    enforcementActions: number,
    unregisteredCount: number
  ): { score: number; description: string } {
    if (unregisteredCount === 0) {
      return { score: 90, description: 'No unregistered properties to enforce' };
    }

    const ratio = enforcementActions / unregisteredCount;

    if (ratio >= 0.5) {
      return {
        score: 80,
        description: 'Active enforcement history',
      };
    } else if (ratio >= 0.2) {
      return {
        score: 60,
        description: 'Moderate enforcement activity',
      };
    } else if (ratio >= 0.05) {
      return {
        score: 40,
        description: 'Limited enforcement actions',
      };
    } else {
      return {
        score: 20,
        description: 'Minimal enforcement - high opportunity',
      };
    }
  }

  /**
   * Calculate growth trend for area
   */
  private async calculateGrowthTrend(
    city: string
  ): Promise<{ score: number; description: string }> {
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get listings count at different points
    const { count: currentCount } = await this.supabase
      .from('scraped_listings')
      .select('id', { count: 'exact' })
      .eq('city', city)
      .eq('matched_registration', false);

    const { count: threeMonthsCount } = await this.supabase
      .from('scraped_listings')
      .select('id', { count: 'exact' })
      .eq('city', city)
      .eq('matched_registration', false)
      .lte('first_scraped_at', threeMonthsAgo.toISOString());

    if (!threeMonthsCount || threeMonthsCount === 0) {
      return { score: 50, description: 'Insufficient data for trend analysis' };
    }

    const growthRate = ((currentCount || 0) - threeMonthsCount) / threeMonthsCount * 100;

    if (growthRate >= 50) {
      return {
        score: 15,
        description: `Rapid growth: ${growthRate.toFixed(0)}% increase in unregistered`,
      };
    } else if (growthRate >= 20) {
      return {
        score: 35,
        description: `Significant growth: ${growthRate.toFixed(0)}% increase`,
      };
    } else if (growthRate >= 0) {
      return {
        score: 55,
        description: `Moderate growth: ${growthRate.toFixed(0)}% increase`,
      };
    } else if (growthRate >= -20) {
      return {
        score: 75,
        description: `Slight decline: ${Math.abs(growthRate).toFixed(0)}% decrease`,
      };
    } else {
      return {
        score: 90,
        description: `Declining: ${Math.abs(growthRate).toFixed(0)}% decrease`,
      };
    }
  }

  /**
   * Get historical trends for area
   */
  private async getAreaTrends(
    city: string,
    neighborhood?: string
  ): Promise<AreaTrend[]> {
    const trends: AreaTrend[] = [];
    const now = new Date();

    // Get monthly compliance trends
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Get property counts at this point
      let query = this.supabase
        .from('properties')
        .select('id, registration_status', { count: 'exact' })
        .eq('city', city)
        .lte('created_at', endDate.toISOString());

      if (neighborhood) {
        query = query.eq('neighborhood', neighborhood);
      }

      const { data: properties, count } = await query;

      const registered = (properties || []).filter(
        (p) => p.registration_status === 'registered'
      ).length;

      const complianceRate = (count || 0) > 0 ? (registered / (count || 1)) * 100 : 0;

      const prevTrend = trends[trends.length - 1];
      const change = prevTrend ? complianceRate - prevTrend.value : 0;

      trends.push({
        date,
        metric: 'compliance_rate',
        value: complianceRate,
        change,
      });
    }

    return trends;
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
   * Calculate enforcement priority
   */
  private calculateEnforcementPriority(
    overallScore: number,
    areaData: AreaData
  ): number {
    const baseScore = overallScore;
    const volumeBonus = Math.min(20, areaData.unmatched_listings / 5);
    return Math.min(100, baseScore + volumeBonus);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    areaData: AreaData,
    factors: RiskFactor[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push(
        `Prioritize ${areaData.city} for enforcement campaign`
      );
    }

    const complianceFactor = factors.find((f) => f.name === 'Compliance Rate');
    if (complianceFactor && complianceFactor.score < 50) {
      recommendations.push(
        'Launch targeted registration outreach campaign'
      );
    }

    const densityFactor = factors.find((f) => f.name === 'Unregistered Density');
    if (densityFactor && densityFactor.score < 30) {
      recommendations.push(
        'Deploy field inspectors for ground verification'
      );
    }

    const growthFactor = factors.find((f) => f.name === 'Growth Trend');
    if (growthFactor && growthFactor.score < 40) {
      recommendations.push(
        'Increase monitoring frequency - rapid growth detected'
      );
    }

    const enforcementFactor = factors.find((f) => f.name === 'Enforcement History');
    if (enforcementFactor && enforcementFactor.score < 40) {
      recommendations.push(
        'Increase enforcement actions to deter non-compliance'
      );
    }

    return recommendations;
  }

  /**
   * Get all cities ranked by risk
   */
  async getRankedCities(): Promise<AreaRiskAssessment[]> {
    const { data: cities, error } = await this.supabase
      .from('scraped_listings')
      .select('city')
      .not('city', 'is', null);

    if (error || !cities) {
      return [];
    }

    // Get unique cities
    const uniqueCities = [...new Set(cities.map((c) => c.city))];

    const assessments: AreaRiskAssessment[] = [];

    for (const city of uniqueCities) {
      try {
        const assessment = await this.assessAreaRisk(city);
        assessments.push(assessment);
      } catch (err) {
        console.error(`Error assessing ${city}:`, err);
      }
    }

    // Sort by enforcement priority (descending)
    return assessments.sort((a, b) => b.enforcementPriority - a.enforcementPriority);
  }
}
