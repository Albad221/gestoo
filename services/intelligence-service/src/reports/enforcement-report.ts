import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnforcementReport,
  EnforcementTarget,
  CityEnforcementSummary,
  ResourceRecommendation,
  EnforcementOutcome,
} from '../types';
import { LandlordRiskScorer } from '../risk/landlord-risk';
import { ListingRiskScorer } from '../risk/listing-risk';
import { AreaRiskAssessor } from '../risk/area-risk';

export class EnforcementReportGenerator {
  private supabase: SupabaseClient;
  private landlordRiskScorer: LandlordRiskScorer;
  private listingRiskScorer: ListingRiskScorer;
  private areaRiskAssessor: AreaRiskAssessor;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.landlordRiskScorer = new LandlordRiskScorer(supabaseClient);
    this.listingRiskScorer = new ListingRiskScorer(supabaseClient);
    this.areaRiskAssessor = new AreaRiskAssessor(supabaseClient);
  }

  /**
   * Generate enforcement priority report
   */
  async generateReport(): Promise<EnforcementReport> {
    const priorityTargets = await this.getPriorityTargets();
    const byCity = await this.getCityEnforcementSummaries(priorityTargets);
    const resourceAllocation = this.calculateResourceAllocation(byCity);
    const expectedOutcome = this.calculateExpectedOutcome(priorityTargets);

    const report: EnforcementReport = {
      id: `enforcement-${new Date().toISOString().split('T')[0]}`,
      generatedAt: new Date(),
      priorityTargets,
      byCity,
      resourceAllocation,
      expectedOutcome,
    };

    // Store the report
    await this.storeReport(report);

    return report;
  }

  /**
   * Get priority enforcement targets
   */
  private async getPriorityTargets(): Promise<EnforcementTarget[]> {
    const targets: EnforcementTarget[] = [];

    // Get high-risk landlords
    const { data: landlords, error: landlordError } = await this.supabase
      .from('landlord_risk_scores')
      .select('landlord_id, overall_score, risk_level')
      .in('risk_level', ['high', 'critical'])
      .order('overall_score', { ascending: true })
      .limit(20);

    if (!landlordError && landlords) {
      for (const landlord of landlords) {
        const { data: landlordDetails } = await this.supabase
          .from('landlords')
          .select('name, city')
          .eq('id', landlord.landlord_id)
          .single();

        const estimatedRevenue = await this.estimateLandlordLostRevenue(landlord.landlord_id);

        targets.push({
          id: landlord.landlord_id,
          type: 'landlord',
          name: landlordDetails?.name || 'Unknown',
          city: landlordDetails?.city || 'Unknown',
          riskScore: 100 - landlord.overall_score, // Invert for priority
          estimatedLostRevenue: estimatedRevenue,
          priority: this.calculatePriority(100 - landlord.overall_score, estimatedRevenue),
          recommendedAction: this.getRecommendedAction('landlord', landlord.risk_level),
        });
      }
    }

    // Get high-priority listings
    const { data: listings, error: listingError } = await this.supabase
      .from('listing_risk_scores')
      .select('listing_id, overall_score, risk_level, estimated_revenue')
      .in('risk_level', ['high', 'critical'])
      .order('investigation_priority', { ascending: false })
      .limit(30);

    if (!listingError && listings) {
      for (const listing of listings) {
        const { data: listingDetails } = await this.supabase
          .from('scraped_listings')
          .select('title, city, host_name')
          .eq('id', listing.listing_id)
          .single();

        targets.push({
          id: listing.listing_id,
          type: 'listing',
          name: listingDetails?.title || 'Unknown Listing',
          city: listingDetails?.city || 'Unknown',
          riskScore: listing.overall_score,
          estimatedLostRevenue: (listing.estimated_revenue || 0) * 0.055, // TPT
          priority: this.calculatePriority(listing.overall_score, listing.estimated_revenue || 0),
          recommendedAction: this.getRecommendedAction('listing', listing.risk_level),
        });
      }
    }

    // Get high-risk areas
    const rankedAreas = await this.areaRiskAssessor.getRankedCities();
    const highRiskAreas = rankedAreas
      .filter((a) => a.riskLevel === 'high' || a.riskLevel === 'critical')
      .slice(0, 10);

    for (const area of highRiskAreas) {
      const estimatedRevenue = area.unregisteredEstimate * 10000 * 0.055; // Rough estimate

      targets.push({
        id: `area-${area.city}`,
        type: 'area',
        name: area.city,
        city: area.city,
        riskScore: area.overallScore,
        estimatedLostRevenue: estimatedRevenue,
        priority: area.enforcementPriority,
        recommendedAction: this.getRecommendedAction('area', area.riskLevel),
      });
    }

    // Sort by priority
    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Estimate lost revenue for a landlord
   */
  private async estimateLandlordLostRevenue(landlordId: string): Promise<number> {
    const { data: properties, error } = await this.supabase
      .from('properties')
      .select('id, registration_status')
      .eq('landlord_id', landlordId)
      .eq('registration_status', 'unregistered');

    if (error || !properties) return 0;

    // Estimate $15,000 annual revenue per unregistered property
    const avgAnnualRevenue = 15000;
    const tptRate = 0.055;

    return properties.length * avgAnnualRevenue * tptRate;
  }

  /**
   * Calculate enforcement priority
   */
  private calculatePriority(riskScore: number, estimatedRevenue: number): number {
    const riskWeight = 0.6;
    const revenueWeight = 0.4;

    const revenueScore = Math.min(100, (estimatedRevenue / 50000) * 100);

    return Math.round(riskScore * riskWeight + revenueScore * revenueWeight);
  }

  /**
   * Get recommended action based on target type and risk level
   */
  private getRecommendedAction(type: string, riskLevel: string): string {
    const actions: Record<string, Record<string, string>> = {
      landlord: {
        critical: 'Immediate enforcement notice and compliance deadline',
        high: 'Send formal warning letter with 30-day compliance window',
        medium: 'Schedule compliance consultation call',
        low: 'Add to monitoring list for next review',
      },
      listing: {
        critical: 'Urgent investigation - potential commercial operation',
        high: 'Priority verification and owner identification',
        medium: 'Standard verification process',
        low: 'Monitor for activity changes',
      },
      area: {
        critical: 'Deploy field enforcement team immediately',
        high: 'Schedule targeted compliance sweep',
        medium: 'Increase monitoring frequency',
        low: 'Include in routine patrol schedule',
      },
    };

    return actions[type]?.[riskLevel] || 'Review and assess';
  }

  /**
   * Get enforcement summaries by city
   */
  private async getCityEnforcementSummaries(
    targets: EnforcementTarget[]
  ): Promise<CityEnforcementSummary[]> {
    const cityMap = new Map<string, { count: number; revenue: number }>();

    targets.forEach((target) => {
      const current = cityMap.get(target.city) || { count: 0, revenue: 0 };
      cityMap.set(target.city, {
        count: current.count + 1,
        revenue: current.revenue + target.estimatedLostRevenue,
      });
    });

    return Array.from(cityMap.entries())
      .map(([city, data]) => ({
        city,
        targetCount: data.count,
        estimatedRecovery: data.revenue,
        resourcesNeeded: Math.ceil(data.count / 10), // 1 inspector per 10 targets
      }))
      .sort((a, b) => b.estimatedRecovery - a.estimatedRecovery);
  }

  /**
   * Calculate resource allocation recommendations
   */
  private calculateResourceAllocation(
    citySummaries: CityEnforcementSummary[]
  ): ResourceRecommendation[] {
    return citySummaries.map((city, index) => ({
      city: city.city,
      inspectorsNeeded: city.resourcesNeeded,
      estimatedHours: city.targetCount * 2, // 2 hours per target
      priority: index + 1,
    }));
  }

  /**
   * Calculate expected outcomes from enforcement
   */
  private calculateExpectedOutcome(targets: EnforcementTarget[]): EnforcementOutcome {
    const totalLostRevenue = targets.reduce(
      (sum, t) => sum + t.estimatedLostRevenue,
      0
    );

    // Assume 60% recovery rate from enforcement
    const estimatedRecovery = totalLostRevenue * 0.6;

    // Estimate new registrations (30% of targets)
    const newRegistrationsExpected = Math.round(targets.length * 0.3);

    // Estimate compliance rate increase
    const { count: totalProperties } = { count: 1000 }; // Placeholder
    const complianceRateIncrease = (newRegistrationsExpected / totalProperties) * 100;

    return {
      estimatedRecovery,
      newRegistrationsExpected,
      complianceRateIncrease,
    };
  }

  /**
   * Store report in database
   */
  private async storeReport(report: EnforcementReport): Promise<void> {
    const { error } = await this.supabase.from('enforcement_reports').upsert({
      id: report.id,
      generated_at: report.generatedAt.toISOString(),
      priority_targets: report.priorityTargets,
      by_city: report.byCity,
      resource_allocation: report.resourceAllocation,
      expected_outcome: report.expectedOutcome,
    });

    if (error) {
      console.error('Error storing enforcement report:', error);
    }
  }

  /**
   * Get latest enforcement report
   */
  async getLatestReport(): Promise<EnforcementReport | null> {
    const { data, error } = await this.supabase
      .from('enforcement_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      generatedAt: new Date(data.generated_at),
      priorityTargets: data.priority_targets,
      byCity: data.by_city,
      resourceAllocation: data.resource_allocation,
      expectedOutcome: data.expected_outcome,
    };
  }

  /**
   * Get top N priority targets
   */
  async getTopPriorityTargets(limit: number = 10): Promise<EnforcementTarget[]> {
    const targets = await this.getPriorityTargets();
    return targets.slice(0, limit);
  }

  /**
   * Get targets for a specific city
   */
  async getTargetsByCity(city: string): Promise<EnforcementTarget[]> {
    const targets = await this.getPriorityTargets();
    return targets.filter(
      (t) => t.city.toLowerCase() === city.toLowerCase()
    );
  }
}
