import { SupabaseClient } from '@supabase/supabase-js';
import {
  WeeklyReport,
  ReportSummary,
  KeyMetric,
  ComplianceMetrics,
  RevenueHighlights,
  EnforcementAction,
  Alert,
} from '../types';
import { ComplianceTrendsAnalyzer } from '../analytics/compliance-trends';
import { RevenueForecastingEngine } from '../analytics/revenue-forecasting';

export class WeeklyReportGenerator {
  private supabase: SupabaseClient;
  private complianceAnalyzer: ComplianceTrendsAnalyzer;
  private revenueEngine: RevenueForecastingEngine;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.complianceAnalyzer = new ComplianceTrendsAnalyzer(supabaseClient);
    this.revenueEngine = new RevenueForecastingEngine(supabaseClient);
  }

  /**
   * Generate comprehensive weekly report
   */
  async generateReport(): Promise<WeeklyReport> {
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const complianceMetrics = await this.getWeeklyComplianceMetrics(weekStart, weekEnd);
    const revenueHighlights = await this.getRevenueHighlights(weekStart, weekEnd);
    const enforcementActions = await this.getEnforcementActions(weekStart, weekEnd);
    const alerts = await this.generateAlerts(complianceMetrics, revenueHighlights);
    const summary = this.generateSummary(complianceMetrics, revenueHighlights, alerts);

    const report: WeeklyReport = {
      id: `weekly-${weekStart.toISOString().split('T')[0]}`,
      weekStart,
      weekEnd,
      generatedAt: now,
      summary,
      complianceMetrics,
      revenueHighlights,
      enforcementActions,
      alerts,
    };

    // Store the report
    await this.storeReport(report);

    return report;
  }

  /**
   * Get compliance metrics for the week
   */
  private async getWeeklyComplianceMetrics(
    weekStart: Date,
    weekEnd: Date
  ): Promise<ComplianceMetrics> {
    return await this.complianceAnalyzer.getComplianceMetrics({
      startDate: weekStart,
      endDate: weekEnd,
    });
  }

  /**
   * Get revenue highlights for the week
   */
  private async getRevenueHighlights(
    weekStart: Date,
    weekEnd: Date
  ): Promise<RevenueHighlights> {
    // Get collected revenue this week
    const { data: collected, error: collectedError } = await this.supabase
      .from('tpt_payments')
      .select('amount')
      .gte('payment_date', weekStart.toISOString())
      .lte('payment_date', weekEnd.toISOString())
      .eq('status', 'completed');

    const collectedAmount = (collected || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    // Get outstanding payments
    const { data: outstanding, error: outstandingError } = await this.supabase
      .from('tpt_payments')
      .select('amount')
      .eq('status', 'pending')
      .lt('due_date', weekEnd.toISOString());

    const outstandingAmount = (outstanding || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    // Get projected weekly revenue
    const monthlyRevenue = await this.revenueEngine.getCurrentMonthRevenue();
    const projectedWeekly = monthlyRevenue / 4;

    // Calculate collection rate
    const totalDue = collectedAmount + outstandingAmount;
    const collectionRate = totalDue > 0 ? (collectedAmount / totalDue) * 100 : 100;

    return {
      collected: collectedAmount,
      projected: projectedWeekly,
      outstanding: outstandingAmount,
      collectionRate,
    };
  }

  /**
   * Get enforcement actions for the week
   */
  private async getEnforcementActions(
    weekStart: Date,
    weekEnd: Date
  ): Promise<EnforcementAction[]> {
    const { data, error } = await this.supabase
      .from('enforcement_actions')
      .select('id, action_type, target_id, status, outcome')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching enforcement actions:', error);
      return [];
    }

    return (data || []).map((action) => ({
      id: action.id,
      type: action.action_type,
      target: action.target_id,
      status: action.status,
      outcome: action.outcome,
    }));
  }

  /**
   * Generate alerts based on metrics
   */
  private async generateAlerts(
    compliance: ComplianceMetrics,
    revenue: RevenueHighlights
  ): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // Compliance rate alerts
    if (compliance.currentRate < 70) {
      alerts.push({
        id: `alert-compliance-${Date.now()}`,
        severity: 'critical',
        message: `Compliance rate dropped to ${compliance.currentRate.toFixed(1)}%`,
        category: 'compliance',
        actionRequired: true,
      });
    } else if (compliance.changePercent < -5) {
      alerts.push({
        id: `alert-compliance-drop-${Date.now()}`,
        severity: 'warning',
        message: `Compliance rate decreased by ${Math.abs(compliance.changePercent).toFixed(1)}%`,
        category: 'compliance',
        actionRequired: true,
      });
    }

    // Revenue alerts
    if (revenue.collectionRate < 80) {
      alerts.push({
        id: `alert-collection-${Date.now()}`,
        severity: 'warning',
        message: `Collection rate at ${revenue.collectionRate.toFixed(1)}% - action needed`,
        category: 'revenue',
        actionRequired: true,
      });
    }

    if (revenue.outstanding > revenue.collected) {
      alerts.push({
        id: `alert-outstanding-${Date.now()}`,
        severity: 'critical',
        message: `Outstanding payments ($${revenue.outstanding.toLocaleString()}) exceed collections`,
        category: 'revenue',
        actionRequired: true,
      });
    }

    // Check for new unregistered listings surge
    const { count: newUnregistered } = await this.supabase
      .from('scraped_listings')
      .select('id', { count: 'exact' })
      .eq('matched_registration', false)
      .gte('first_scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if ((newUnregistered || 0) > 50) {
      alerts.push({
        id: `alert-new-listings-${Date.now()}`,
        severity: 'warning',
        message: `${newUnregistered} new unregistered listings detected this week`,
        category: 'enforcement',
        actionRequired: true,
      });
    }

    return alerts;
  }

  /**
   * Generate report summary
   */
  private generateSummary(
    compliance: ComplianceMetrics,
    revenue: RevenueHighlights,
    alerts: Alert[]
  ): ReportSummary {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    const warningAlerts = alerts.filter((a) => a.severity === 'warning').length;

    // Generate headline
    let headline: string;
    if (criticalAlerts > 0) {
      headline = `Critical attention needed: ${criticalAlerts} critical alert(s) require immediate action`;
    } else if (compliance.changePercent > 0) {
      headline = `Positive week: Compliance improved by ${compliance.changePercent.toFixed(1)}%`;
    } else if (revenue.collected > revenue.projected) {
      headline = `Revenue on track: Collected $${revenue.collected.toLocaleString()} this week`;
    } else {
      headline = 'Weekly operations summary - steady state';
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
        name: 'Revenue Collected',
        value: revenue.collected,
        unit: '$',
        change: ((revenue.collected - revenue.projected) / revenue.projected) * 100,
        trend: revenue.collected >= revenue.projected ? 'up' : 'down',
      },
      {
        name: 'Collection Rate',
        value: revenue.collectionRate,
        unit: '%',
        change: 0,
        trend: revenue.collectionRate >= 90 ? 'up' : revenue.collectionRate >= 80 ? 'stable' : 'down',
      },
      {
        name: 'Outstanding',
        value: revenue.outstanding,
        unit: '$',
        change: 0,
        trend: revenue.outstanding > revenue.collected ? 'down' : 'up',
      },
    ];

    // Highlights and concerns
    const highlights: string[] = [];
    const concerns: string[] = [];

    if (compliance.changePercent > 2) {
      highlights.push(`Compliance improved ${compliance.changePercent.toFixed(1)}% this week`);
    }
    if (revenue.collected >= revenue.projected) {
      highlights.push(`Revenue target met: $${revenue.collected.toLocaleString()}`);
    }
    if (revenue.collectionRate >= 95) {
      highlights.push('Excellent collection rate maintained');
    }

    if (compliance.changePercent < -2) {
      concerns.push(`Compliance declined ${Math.abs(compliance.changePercent).toFixed(1)}%`);
    }
    if (revenue.outstanding > 50000) {
      concerns.push(`$${revenue.outstanding.toLocaleString()} in outstanding payments`);
    }

    alerts.forEach((alert) => {
      if (alert.severity === 'critical') {
        concerns.push(alert.message);
      }
    });

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
  private async storeReport(report: WeeklyReport): Promise<void> {
    const { error } = await this.supabase.from('weekly_reports').upsert({
      id: report.id,
      week_start: report.weekStart.toISOString(),
      week_end: report.weekEnd.toISOString(),
      generated_at: report.generatedAt.toISOString(),
      summary: report.summary,
      compliance_metrics: report.complianceMetrics,
      revenue_highlights: report.revenueHighlights,
      enforcement_actions: report.enforcementActions,
      alerts: report.alerts,
    });

    if (error) {
      console.error('Error storing weekly report:', error);
    }
  }

  /**
   * Get latest weekly report
   */
  async getLatestReport(): Promise<WeeklyReport | null> {
    const { data, error } = await this.supabase
      .from('weekly_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      weekStart: new Date(data.week_start),
      weekEnd: new Date(data.week_end),
      generatedAt: new Date(data.generated_at),
      summary: data.summary,
      complianceMetrics: data.compliance_metrics,
      revenueHighlights: data.revenue_highlights,
      enforcementActions: data.enforcement_actions,
      alerts: data.alerts,
    };
  }

  /**
   * Get report by ID
   */
  async getReportById(reportId: string): Promise<WeeklyReport | null> {
    const { data, error } = await this.supabase
      .from('weekly_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      weekStart: new Date(data.week_start),
      weekEnd: new Date(data.week_end),
      generatedAt: new Date(data.generated_at),
      summary: data.summary,
      complianceMetrics: data.compliance_metrics,
      revenueHighlights: data.revenue_highlights,
      enforcementActions: data.enforcement_actions,
      alerts: data.alerts,
    };
  }
}
