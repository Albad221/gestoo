import { SupabaseClient } from '@supabase/supabase-js';
import {
  MonthlyReport,
  ReportSummary,
  KeyMetric,
  ComplianceMetrics,
  RevenueAnalytics,
  HotspotAnalytics,
  SeasonalAnalytics,
  RiskAssessmentSummary,
  Recommendation,
} from '../types';
import { ComplianceTrendsAnalyzer } from '../analytics/compliance-trends';
import { RevenueForecastingEngine } from '../analytics/revenue-forecasting';
import { HotspotDetectionEngine } from '../analytics/hotspot-detection';
import { SeasonalPatternAnalyzer } from '../analytics/seasonal-patterns';
import { LandlordRiskScorer } from '../risk/landlord-risk';
import { ListingRiskScorer } from '../risk/listing-risk';
import { AreaRiskAssessor } from '../risk/area-risk';

export class MonthlyReportGenerator {
  private supabase: SupabaseClient;
  private complianceAnalyzer: ComplianceTrendsAnalyzer;
  private revenueEngine: RevenueForecastingEngine;
  private hotspotEngine: HotspotDetectionEngine;
  private seasonalAnalyzer: SeasonalPatternAnalyzer;
  private landlordRiskScorer: LandlordRiskScorer;
  private listingRiskScorer: ListingRiskScorer;
  private areaRiskAssessor: AreaRiskAssessor;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.complianceAnalyzer = new ComplianceTrendsAnalyzer(supabaseClient);
    this.revenueEngine = new RevenueForecastingEngine(supabaseClient);
    this.hotspotEngine = new HotspotDetectionEngine(supabaseClient);
    this.seasonalAnalyzer = new SeasonalPatternAnalyzer(supabaseClient);
    this.landlordRiskScorer = new LandlordRiskScorer(supabaseClient);
    this.listingRiskScorer = new ListingRiskScorer(supabaseClient);
    this.areaRiskAssessor = new AreaRiskAssessor(supabaseClient);
  }

  /**
   * Generate comprehensive monthly report
   */
  async generateReport(month?: number, year?: number): Promise<MonthlyReport> {
    const now = new Date();
    const reportMonth = month ?? now.getMonth();
    const reportYear = year ?? now.getFullYear();

    const monthStart = new Date(reportYear, reportMonth, 1);
    const monthEnd = new Date(reportYear, reportMonth + 1, 0);

    // Gather all analytics
    const complianceMetrics = await this.getMonthlyComplianceMetrics(monthStart, monthEnd);
    const revenueAnalytics = await this.revenueEngine.getRevenueAnalytics(12);
    const hotspotAnalysis = await this.hotspotEngine.getHotspotAnalytics();
    const seasonalInsights = await this.seasonalAnalyzer.getSeasonalAnalytics(2);
    const riskAssessment = await this.getRiskAssessmentSummary();
    const recommendations = await this.generateRecommendations(
      complianceMetrics,
      revenueAnalytics,
      hotspotAnalysis,
      riskAssessment
    );
    const summary = this.generateSummary(
      complianceMetrics,
      revenueAnalytics,
      hotspotAnalysis,
      riskAssessment
    );

    const report: MonthlyReport = {
      id: `monthly-${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
      month: reportMonth,
      year: reportYear,
      generatedAt: now,
      summary,
      complianceMetrics,
      revenueAnalytics,
      hotspotAnalysis,
      seasonalInsights,
      riskAssessment,
      recommendations,
    };

    // Store the report
    await this.storeReport(report);

    return report;
  }

  /**
   * Get compliance metrics for the month
   */
  private async getMonthlyComplianceMetrics(
    monthStart: Date,
    monthEnd: Date
  ): Promise<ComplianceMetrics> {
    return await this.complianceAnalyzer.getComplianceMetrics({
      startDate: monthStart,
      endDate: monthEnd,
    });
  }

  /**
   * Get risk assessment summary
   */
  private async getRiskAssessmentSummary(): Promise<RiskAssessmentSummary> {
    // Count high-risk landlords
    const { count: highRiskLandlords } = await this.supabase
      .from('landlord_risk_scores')
      .select('id', { count: 'exact' })
      .in('risk_level', ['high', 'critical']);

    // Count high-risk listings
    const { count: highRiskListings } = await this.supabase
      .from('listing_risk_scores')
      .select('id', { count: 'exact' })
      .in('risk_level', ['high', 'critical']);

    // Get ranked areas and count high-risk ones
    const rankedAreas = await this.areaRiskAssessor.getRankedCities();
    const highRiskAreas = rankedAreas.filter(
      (a) => a.riskLevel === 'high' || a.riskLevel === 'critical'
    ).length;

    // Calculate total risk score
    const totalRiskScore = Math.round(
      ((highRiskLandlords || 0) * 3 +
        (highRiskListings || 0) +
        highRiskAreas * 5) /
        10
    );

    return {
      highRiskLandlords: highRiskLandlords || 0,
      highRiskListings: highRiskListings || 0,
      highRiskAreas,
      totalRiskScore,
    };
  }

  /**
   * Generate strategic recommendations
   */
  private async generateRecommendations(
    compliance: ComplianceMetrics,
    revenue: RevenueAnalytics,
    hotspots: HotspotAnalytics,
    risk: RiskAssessmentSummary
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Compliance-based recommendations
    if (compliance.currentRate < 75) {
      recommendations.push({
        id: `rec-compliance-${Date.now()}`,
        priority: 'high',
        category: 'compliance',
        title: 'Launch Compliance Improvement Campaign',
        description: `Current compliance rate (${compliance.currentRate.toFixed(1)}%) is below target. Implement targeted outreach to unregistered property owners.`,
        expectedImpact: 'Potential 10-15% compliance rate improvement',
      });
    }

    // Revenue-based recommendations
    if (revenue.growthRate < 0) {
      recommendations.push({
        id: `rec-revenue-${Date.now()}`,
        priority: 'high',
        category: 'revenue',
        title: 'Address Revenue Decline',
        description: `Revenue has declined ${Math.abs(revenue.growthRate).toFixed(1)}% compared to last month. Review collection processes and identify gaps.`,
        expectedImpact: 'Stabilize revenue stream and improve collection',
      });
    }

    // Hotspot-based recommendations
    if (hotspots.hotspots.length > 0) {
      const topHotspot = hotspots.hotspots[0];
      recommendations.push({
        id: `rec-hotspot-${Date.now()}`,
        priority: topHotspot.riskLevel === 'critical' ? 'high' : 'medium',
        category: 'enforcement',
        title: `Focus Enforcement on ${topHotspot.city}`,
        description: `${topHotspot.city} has ${topHotspot.unregisteredCount} unregistered properties with estimated $${topHotspot.estimatedLostRevenue.toLocaleString()} in lost revenue.`,
        expectedImpact: `Potential recovery of $${topHotspot.estimatedLostRevenue.toLocaleString()} annually`,
      });
    }

    // Risk-based recommendations
    if (risk.highRiskLandlords > 10) {
      recommendations.push({
        id: `rec-risk-landlords-${Date.now()}`,
        priority: 'medium',
        category: 'risk',
        title: 'Address High-Risk Landlord Portfolio',
        description: `${risk.highRiskLandlords} landlords identified as high-risk. Implement enhanced monitoring and proactive engagement.`,
        expectedImpact: 'Reduce compliance violations and payment defaults',
      });
    }

    if (risk.highRiskListings > 50) {
      recommendations.push({
        id: `rec-risk-listings-${Date.now()}`,
        priority: 'high',
        category: 'enforcement',
        title: 'Prioritize Listing Investigations',
        description: `${risk.highRiskListings} high-priority listings require investigation. Allocate resources for systematic verification.`,
        expectedImpact: 'Significant increase in registration compliance',
      });
    }

    // Seasonal recommendations
    const seasonalRecs = await this.seasonalAnalyzer.getEnforcementRecommendations();
    seasonalRecs.forEach((rec, index) => {
      recommendations.push({
        id: `rec-seasonal-${index}`,
        priority: 'low',
        category: 'strategy',
        title: 'Seasonal Strategy Insight',
        description: rec,
        expectedImpact: 'Optimize resource allocation throughout the year',
      });
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Generate report summary
   */
  private generateSummary(
    compliance: ComplianceMetrics,
    revenue: RevenueAnalytics,
    hotspots: HotspotAnalytics,
    risk: RiskAssessmentSummary
  ): ReportSummary {
    // Determine overall status
    let headline: string;
    if (compliance.currentRate >= 85 && revenue.growthRate >= 0) {
      headline = 'Strong month: Compliance and revenue on target';
    } else if (risk.totalRiskScore > 50) {
      headline = 'Attention required: Elevated risk levels detected';
    } else if (hotspots.totalLostRevenueEstimate > 100000) {
      headline = `Revenue opportunity: $${hotspots.totalLostRevenueEstimate.toLocaleString()} in estimated lost TPT`;
    } else {
      headline = 'Monthly operations summary';
    }

    // Key metrics
    const keyMetrics: KeyMetric[] = [
      {
        name: 'Compliance Rate',
        value: compliance.currentRate,
        unit: '%',
        change: compliance.changePercent,
        trend: compliance.changePercent > 0 ? 'up' : compliance.changePercent < 0 ? 'down' : 'stable',
      },
      {
        name: 'Monthly Revenue',
        value: revenue.currentMonthRevenue,
        unit: '$',
        change: revenue.growthRate,
        trend: revenue.growthRate > 0 ? 'up' : revenue.growthRate < 0 ? 'down' : 'stable',
      },
      {
        name: 'YTD Revenue',
        value: revenue.yearToDate,
        unit: '$',
        change: 0,
        trend: 'stable',
      },
      {
        name: 'Hotspots Identified',
        value: hotspots.hotspots.length,
        unit: '',
        change: 0,
        trend: hotspots.hotspots.length > 10 ? 'down' : 'stable',
      },
      {
        name: 'High-Risk Entities',
        value: risk.highRiskLandlords + risk.highRiskListings,
        unit: '',
        change: 0,
        trend: risk.totalRiskScore > 50 ? 'down' : 'stable',
      },
    ];

    // Highlights
    const highlights: string[] = [];
    if (compliance.changePercent > 0) {
      highlights.push(`Compliance improved ${compliance.changePercent.toFixed(1)}%`);
    }
    if (revenue.growthRate > 5) {
      highlights.push(`Revenue grew ${revenue.growthRate.toFixed(1)}% month-over-month`);
    }
    if (revenue.projectedAnnual > revenue.yearToDate * 1.2) {
      highlights.push(`On track to exceed annual targets`);
    }

    // Concerns
    const concerns: string[] = [];
    if (compliance.changePercent < -2) {
      concerns.push(`Compliance declined ${Math.abs(compliance.changePercent).toFixed(1)}%`);
    }
    if (revenue.growthRate < -5) {
      concerns.push(`Revenue dropped ${Math.abs(revenue.growthRate).toFixed(1)}%`);
    }
    if (hotspots.totalLostRevenueEstimate > 50000) {
      concerns.push(`$${hotspots.totalLostRevenueEstimate.toLocaleString()} estimated lost revenue`);
    }
    if (risk.highRiskLandlords > 20) {
      concerns.push(`${risk.highRiskLandlords} high-risk landlords require attention`);
    }

    return {
      headline,
      keyMetrics,
      highlights,
      concerns,
    };
  }

  /**
   * Store report in database
   */
  private async storeReport(report: MonthlyReport): Promise<void> {
    const { error } = await this.supabase.from('monthly_reports').upsert({
      id: report.id,
      month: report.month,
      year: report.year,
      generated_at: report.generatedAt.toISOString(),
      summary: report.summary,
      compliance_metrics: report.complianceMetrics,
      revenue_analytics: report.revenueAnalytics,
      hotspot_analysis: report.hotspotAnalysis,
      seasonal_insights: report.seasonalInsights,
      risk_assessment: report.riskAssessment,
      recommendations: report.recommendations,
    });

    if (error) {
      console.error('Error storing monthly report:', error);
    }
  }

  /**
   * Get latest monthly report
   */
  async getLatestReport(): Promise<MonthlyReport | null> {
    const { data, error } = await this.supabase
      .from('monthly_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToReport(data);
  }

  /**
   * Get report by month and year
   */
  async getReportByMonth(month: number, year: number): Promise<MonthlyReport | null> {
    const reportId = `monthly-${year}-${String(month + 1).padStart(2, '0')}`;

    const { data, error } = await this.supabase
      .from('monthly_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToReport(data);
  }

  /**
   * Map database record to report object
   */
  private mapDbToReport(data: any): MonthlyReport {
    return {
      id: data.id,
      month: data.month,
      year: data.year,
      generatedAt: new Date(data.generated_at),
      summary: data.summary,
      complianceMetrics: data.compliance_metrics,
      revenueAnalytics: data.revenue_analytics,
      hotspotAnalysis: data.hotspot_analysis,
      seasonalInsights: data.seasonal_insights,
      riskAssessment: data.risk_assessment,
      recommendations: data.recommendations,
    };
  }
}
