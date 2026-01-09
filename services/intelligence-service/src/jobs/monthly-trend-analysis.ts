import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportGenerator } from '../reports/monthly-report';
import { ComplianceTrendsAnalyzer } from '../analytics/compliance-trends';
import { SeasonalPatternAnalyzer } from '../analytics/seasonal-patterns';
import { AreaRiskAssessor } from '../risk/area-risk';
import { JobResult, JobError } from '../types';

export class MonthlyTrendAnalysisJob {
  private supabase: SupabaseClient;
  private monthlyReportGenerator: MonthlyReportGenerator;
  private complianceAnalyzer: ComplianceTrendsAnalyzer;
  private seasonalAnalyzer: SeasonalPatternAnalyzer;
  private areaRiskAssessor: AreaRiskAssessor;
  private jobName = 'monthly-trend-analysis';

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.monthlyReportGenerator = new MonthlyReportGenerator(supabaseClient);
    this.complianceAnalyzer = new ComplianceTrendsAnalyzer(supabaseClient);
    this.seasonalAnalyzer = new SeasonalPatternAnalyzer(supabaseClient);
    this.areaRiskAssessor = new AreaRiskAssessor(supabaseClient);
  }

  /**
   * Execute the monthly trend analysis job
   */
  async execute(): Promise<JobResult> {
    const startTime = new Date();
    const errors: JobError[] = [];
    let recordsProcessed = 0;

    console.log(`[${this.jobName}] Starting monthly trend analysis...`);

    try {
      // Generate comprehensive monthly report
      console.log(`[${this.jobName}] Generating monthly report...`);
      const monthlyReport = await this.monthlyReportGenerator.generateReport();
      recordsProcessed++;
      console.log(`[${this.jobName}] Monthly report generated: ${monthlyReport.id}`);

      // Update seasonal patterns
      console.log(`[${this.jobName}] Updating seasonal patterns...`);
      const seasonalAnalytics = await this.seasonalAnalyzer.getSeasonalAnalytics(3);
      await this.storeSeasonalPatterns(seasonalAnalytics);
      recordsProcessed++;
      console.log(`[${this.jobName}] Seasonal patterns updated`);

      // Update area risk rankings
      console.log(`[${this.jobName}] Updating area risk rankings...`);
      const rankedAreas = await this.areaRiskAssessor.getRankedCities();
      await this.storeAreaRankings(rankedAreas);
      recordsProcessed += rankedAreas.length;
      console.log(`[${this.jobName}] ${rankedAreas.length} area rankings updated`);

      // Calculate long-term trends
      console.log(`[${this.jobName}] Calculating long-term trends...`);
      const longTermTrends = await this.calculateLongTermTrends();
      await this.storeLongTermTrends(longTermTrends);
      recordsProcessed++;
      console.log(`[${this.jobName}] Long-term trends calculated`);

      // Generate insights
      const insights = this.generateInsights(monthlyReport, seasonalAnalytics, rankedAreas);
      await this.storeInsights(insights);

      const endTime = new Date();
      const result: JobResult = {
        jobId: `${this.jobName}-${startTime.toISOString()}`,
        jobName: this.jobName,
        status: 'success',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        recordsProcessed,
        errors,
      };

      await this.storeJobResult(result);

      console.log(
        `[${this.jobName}] Completed in ${result.duration}ms. Records processed: ${recordsProcessed}`
      );

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      errors.push({
        timestamp: new Date(),
        message: errorMessage,
      });

      const result: JobResult = {
        jobId: `${this.jobName}-${startTime.toISOString()}`,
        jobName: this.jobName,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        recordsProcessed,
        errors,
      };

      await this.storeJobResult(result);

      console.error(`[${this.jobName}] Failed:`, errorMessage);

      return result;
    }
  }

  /**
   * Calculate long-term trends (12 months)
   */
  private async calculateLongTermTrends(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const metrics = await this.complianceAnalyzer.getComplianceMetrics({
      startDate,
      endDate,
    });

    // Calculate year-over-year changes
    const currentYearRate = metrics.currentRate;

    // Get previous year's rate
    const prevYearEnd = new Date(startDate);
    const prevYearStart = new Date(startDate);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);

    const prevYearMetrics = await this.complianceAnalyzer.getComplianceMetrics({
      startDate: prevYearStart,
      endDate: prevYearEnd,
    });

    const yearOverYearChange =
      prevYearMetrics.currentRate > 0
        ? ((currentYearRate - prevYearMetrics.currentRate) / prevYearMetrics.currentRate) * 100
        : 0;

    return {
      period: '12_months',
      currentComplianceRate: currentYearRate,
      previousYearRate: prevYearMetrics.currentRate,
      yearOverYearChange,
      trendDirection:
        yearOverYearChange > 2 ? 'improving' : yearOverYearChange < -2 ? 'declining' : 'stable',
      generatedAt: new Date(),
    };
  }

  /**
   * Store seasonal patterns
   */
  private async storeSeasonalPatterns(analytics: any): Promise<void> {
    try {
      await this.supabase.from('seasonal_patterns').upsert({
        id: 'current',
        patterns: analytics.patterns,
        peak_months: analytics.peakMonths,
        low_months: analytics.lowMonths,
        seasonality_index: analytics.seasonalityIndex,
        year_over_year_trend: analytics.yearOverYearTrend,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store seasonal patterns:`, error);
    }
  }

  /**
   * Store area rankings
   */
  private async storeAreaRankings(rankings: any[]): Promise<void> {
    try {
      const records = rankings.map((area, index) => ({
        city: area.city,
        rank: index + 1,
        overall_score: area.overallScore,
        risk_level: area.riskLevel,
        compliance_rate: area.complianceRate,
        unregistered_estimate: area.unregisteredEstimate,
        enforcement_priority: area.enforcementPriority,
        updated_at: new Date().toISOString(),
      }));

      await this.supabase.from('area_rankings').upsert(records, {
        onConflict: 'city',
      });
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store area rankings:`, error);
    }
  }

  /**
   * Store long-term trends
   */
  private async storeLongTermTrends(trends: any): Promise<void> {
    try {
      await this.supabase.from('long_term_trends').insert({
        period: trends.period,
        current_compliance_rate: trends.currentComplianceRate,
        previous_year_rate: trends.previousYearRate,
        year_over_year_change: trends.yearOverYearChange,
        trend_direction: trends.trendDirection,
        generated_at: trends.generatedAt.toISOString(),
      });
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store long-term trends:`, error);
    }
  }

  /**
   * Generate insights from analysis
   */
  private generateInsights(
    monthlyReport: any,
    seasonalAnalytics: any,
    rankedAreas: any[]
  ): any[] {
    const insights: any[] = [];

    // Compliance insights
    if (monthlyReport.complianceMetrics.changePercent > 5) {
      insights.push({
        type: 'compliance',
        title: 'Significant Compliance Improvement',
        description: `Compliance rate improved by ${monthlyReport.complianceMetrics.changePercent.toFixed(1)}% this month`,
        impact: 'positive',
        priority: 'info',
      });
    } else if (monthlyReport.complianceMetrics.changePercent < -5) {
      insights.push({
        type: 'compliance',
        title: 'Compliance Rate Decline',
        description: `Compliance rate declined by ${Math.abs(monthlyReport.complianceMetrics.changePercent).toFixed(1)}% - investigation recommended`,
        impact: 'negative',
        priority: 'high',
      });
    }

    // Seasonal insights
    const currentMonth = new Date().getMonth();
    if (seasonalAnalytics.peakMonths.includes(currentMonth)) {
      insights.push({
        type: 'seasonal',
        title: 'Peak Season Active',
        description: 'Currently in peak tourism season - increase monitoring frequency',
        impact: 'neutral',
        priority: 'medium',
      });
    }

    // Area insights
    const criticalAreas = rankedAreas.filter((a) => a.riskLevel === 'critical');
    if (criticalAreas.length > 0) {
      insights.push({
        type: 'area',
        title: 'Critical Areas Identified',
        description: `${criticalAreas.length} area(s) require immediate attention: ${criticalAreas.map((a) => a.city).join(', ')}`,
        impact: 'negative',
        priority: 'high',
      });
    }

    return insights;
  }

  /**
   * Store generated insights
   */
  private async storeInsights(insights: any[]): Promise<void> {
    if (insights.length === 0) return;

    try {
      const records = insights.map((insight) => ({
        ...insight,
        generated_at: new Date().toISOString(),
        status: 'active',
      }));

      await this.supabase.from('monthly_insights').insert(records);
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store insights:`, error);
    }
  }

  /**
   * Store job result in database
   */
  private async storeJobResult(result: JobResult): Promise<void> {
    try {
      await this.supabase.from('job_history').insert({
        job_id: result.jobId,
        job_name: result.jobName,
        status: result.status,
        start_time: result.startTime.toISOString(),
        end_time: result.endTime.toISOString(),
        duration_ms: result.duration,
        records_processed: result.recordsProcessed,
        errors: result.errors,
      });
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store job result:`, error);
    }
  }
}
