import { SupabaseClient } from '@supabase/supabase-js';
import {
  RevenueForecast,
  RevenueAnalytics,
  CityRevenue,
  TimeRange,
} from '../types';

export class RevenueForecastingEngine {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get comprehensive revenue analytics
   */
  async getRevenueAnalytics(months: number = 12): Promise<RevenueAnalytics> {
    const currentMonthRevenue = await this.getCurrentMonthRevenue();
    const previousMonthRevenue = await this.getPreviousMonthRevenue();
    const yearToDate = await this.getYearToDateRevenue();
    const byCity = await this.getRevenueByCity();
    const forecasts = await this.generateForecasts(6); // 6 months ahead

    const projectedAnnual = await this.projectAnnualRevenue();
    const growthRate =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 0;

    return {
      currentMonthRevenue,
      previousMonthRevenue,
      yearToDate,
      projectedAnnual,
      growthRate,
      forecasts,
      byCity,
    };
  }

  /**
   * Get current month's TPT revenue
   */
  async getCurrentMonthRevenue(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data, error } = await this.supabase
      .from('tpt_payments')
      .select('amount')
      .gte('payment_date', startOfMonth.toISOString())
      .lte('payment_date', endOfMonth.toISOString())
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching current month revenue:', error);
      return 0;
    }

    return (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }

  /**
   * Get previous month's TPT revenue
   */
  async getPreviousMonthRevenue(): Promise<number> {
    const now = new Date();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const { data, error } = await this.supabase
      .from('tpt_payments')
      .select('amount')
      .gte('payment_date', startOfPrevMonth.toISOString())
      .lte('payment_date', endOfPrevMonth.toISOString())
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching previous month revenue:', error);
      return 0;
    }

    return (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }

  /**
   * Get year-to-date revenue
   */
  async getYearToDateRevenue(): Promise<number> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const { data, error } = await this.supabase
      .from('tpt_payments')
      .select('amount')
      .gte('payment_date', startOfYear.toISOString())
      .lte('payment_date', now.toISOString())
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching YTD revenue:', error);
      return 0;
    }

    return (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }

  /**
   * Get historical monthly revenue data
   */
  async getHistoricalRevenue(months: number): Promise<Map<string, number>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await this.supabase
      .from('tpt_payments')
      .select('amount, payment_date')
      .gte('payment_date', startDate.toISOString())
      .lte('payment_date', endDate.toISOString())
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching historical revenue:', error);
      return new Map();
    }

    const monthlyRevenue = new Map<string, number>();

    (data || []).forEach((payment) => {
      const date = new Date(payment.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthlyRevenue.get(monthKey) || 0;
      monthlyRevenue.set(monthKey, current + (payment.amount || 0));
    });

    return monthlyRevenue;
  }

  /**
   * Generate revenue forecasts using exponential smoothing
   */
  async generateForecasts(monthsAhead: number): Promise<RevenueForecast[]> {
    const historicalData = await this.getHistoricalRevenue(24);
    const values = Array.from(historicalData.values());

    if (values.length < 3) {
      // Not enough data for meaningful forecast
      return [];
    }

    const forecasts: RevenueForecast[] = [];
    const alpha = 0.3; // Smoothing factor

    // Calculate exponentially smoothed values
    let smoothedValue = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothedValue = alpha * values[i] + (1 - alpha) * smoothedValue;
    }

    // Calculate trend
    const recentValues = values.slice(-6);
    const trend = this.calculateTrend(recentValues);

    // Calculate standard deviation for confidence intervals
    const stdDev = this.calculateStdDev(values);

    const now = new Date();
    for (let i = 1; i <= monthsAhead; i++) {
      const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;

      // Apply seasonal adjustment based on historical patterns
      const seasonalFactor = await this.getSeasonalFactor(forecastDate.getMonth());
      const predictedRevenue = (smoothedValue + trend * i) * seasonalFactor;

      // Confidence decreases with time
      const confidence = Math.max(0.5, 0.95 - i * 0.05);
      const marginOfError = stdDev * (1 + i * 0.1) * 1.96; // 95% CI

      forecasts.push({
        period,
        predictedRevenue: Math.max(0, predictedRevenue),
        lowerBound: Math.max(0, predictedRevenue - marginOfError),
        upperBound: predictedRevenue + marginOfError,
        confidence,
      });
    }

    return forecasts;
  }

  /**
   * Get revenue breakdown by city
   */
  async getRevenueByCity(): Promise<CityRevenue[]> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    const { data: currentYear, error: currentError } = await this.supabase
      .from('tpt_payments')
      .select('amount, city')
      .gte('payment_date', startOfYear.toISOString())
      .eq('status', 'completed');

    const { data: prevYear, error: prevError } = await this.supabase
      .from('tpt_payments')
      .select('amount, city')
      .gte('payment_date', prevYearStart.toISOString())
      .lte('payment_date', prevYearEnd.toISOString())
      .eq('status', 'completed');

    if (currentError || prevError) {
      console.error('Error fetching revenue by city');
      return [];
    }

    // Calculate current year revenue by city
    const currentCityRevenue = new Map<string, number>();
    (currentYear || []).forEach((payment) => {
      const city = payment.city || 'Unknown';
      const current = currentCityRevenue.get(city) || 0;
      currentCityRevenue.set(city, current + (payment.amount || 0));
    });

    // Calculate previous year revenue by city
    const prevCityRevenue = new Map<string, number>();
    (prevYear || []).forEach((payment) => {
      const city = payment.city || 'Unknown';
      const current = prevCityRevenue.get(city) || 0;
      prevCityRevenue.set(city, current + (payment.amount || 0));
    });

    const totalRevenue = Array.from(currentCityRevenue.values()).reduce(
      (sum, val) => sum + val,
      0
    );

    return Array.from(currentCityRevenue.entries())
      .map(([city, revenue]) => {
        const prevRevenue = prevCityRevenue.get(city) || 0;
        const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

        return {
          city,
          revenue,
          percentOfTotal: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
          growth,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Project annual revenue based on current trajectory
   */
  async projectAnnualRevenue(): Promise<number> {
    const yearToDate = await this.getYearToDateRevenue();
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const daysInYear = 365;

    // Simple linear projection
    const dailyAverage = yearToDate / dayOfYear;
    return dailyAverage * daysInYear;
  }

  /**
   * Calculate linear trend from values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Get seasonal adjustment factor for a given month
   */
  private async getSeasonalFactor(month: number): Promise<number> {
    // Typical tourism seasonality factors (can be refined with actual data)
    const seasonalFactors: Record<number, number> = {
      0: 0.85, // January - low
      1: 0.90, // February
      2: 1.00, // March
      3: 1.10, // April - spring break
      4: 1.05, // May
      5: 1.20, // June - summer start
      6: 1.30, // July - peak
      7: 1.35, // August - peak
      8: 1.15, // September
      9: 1.00, // October
      10: 0.85, // November
      11: 0.95, // December - holidays
    };

    return seasonalFactors[month] || 1.0;
  }
}
