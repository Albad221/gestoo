import { SupabaseClient } from '@supabase/supabase-js';
import { SeasonalPattern, SeasonalAnalytics } from '../types';

interface BookingData {
  booking_date: string;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  revenue: number;
}

export class SeasonalPatternAnalyzer {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get comprehensive seasonal analytics
   */
  async getSeasonalAnalytics(yearsOfData: number = 2): Promise<SeasonalAnalytics> {
    const patterns = await this.analyzeSeasonalPatterns(yearsOfData);
    const peakMonths = this.identifyPeakMonths(patterns);
    const lowMonths = this.identifyLowMonths(patterns);
    const seasonalityIndex = this.calculateSeasonalityIndex(patterns);
    const yearOverYearTrend = await this.calculateYearOverYearTrend();

    return {
      patterns,
      peakMonths,
      lowMonths,
      seasonalityIndex,
      yearOverYearTrend,
    };
  }

  /**
   * Analyze seasonal patterns from historical booking data
   */
  async analyzeSeasonalPatterns(yearsOfData: number): Promise<SeasonalPattern[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - yearsOfData);

    const { data: bookings, error } = await this.supabase
      .from('bookings')
      .select('booking_date, check_in_date, check_out_date, total_nights, revenue')
      .gte('check_in_date', startDate.toISOString())
      .lte('check_in_date', endDate.toISOString());

    if (error) {
      console.error('Error fetching booking data:', error);
      return this.getDefaultPatterns();
    }

    // Group bookings by month
    const monthlyData = this.aggregateByMonth(bookings || []);

    // Calculate patterns for each month
    const patterns: SeasonalPattern[] = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Calculate overall averages for normalization
    const allOccupancy = Array.from(monthlyData.values()).flatMap(m => m.occupancy);
    const allBookings = Array.from(monthlyData.values()).flatMap(m => m.bookingCounts);
    const allRevenue = Array.from(monthlyData.values()).flatMap(m => m.revenues);

    const avgOccupancy = allOccupancy.length > 0
      ? allOccupancy.reduce((a, b) => a + b, 0) / allOccupancy.length
      : 50;
    const avgBookings = allBookings.length > 0
      ? allBookings.reduce((a, b) => a + b, 0) / allBookings.length
      : 100;
    const avgRevenue = allRevenue.length > 0
      ? allRevenue.reduce((a, b) => a + b, 0) / allRevenue.length
      : 10000;

    for (let month = 0; month < 12; month++) {
      const data = monthlyData.get(month) || {
        occupancy: [],
        bookingCounts: [],
        revenues: [],
      };

      const avgMonthOccupancy = data.occupancy.length > 0
        ? data.occupancy.reduce((a, b) => a + b, 0) / data.occupancy.length
        : 50;

      const avgMonthBookings = data.bookingCounts.length > 0
        ? data.bookingCounts.reduce((a, b) => a + b, 0) / data.bookingCounts.length
        : 100;

      const avgMonthRevenue = data.revenues.length > 0
        ? data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length
        : 10000;

      const revenueIndex = avgRevenue > 0 ? avgMonthRevenue / avgRevenue : 1;

      patterns.push({
        month,
        monthName: monthNames[month],
        averageOccupancy: avgMonthOccupancy,
        averageBookings: avgMonthBookings,
        revenueIndex,
        isHighSeason: revenueIndex >= 1.15,
      });
    }

    return patterns;
  }

  /**
   * Aggregate booking data by month
   */
  private aggregateByMonth(bookings: BookingData[]): Map<number, {
    occupancy: number[];
    bookingCounts: number[];
    revenues: number[];
  }> {
    const monthlyData = new Map<number, {
      occupancy: number[];
      bookingCounts: number[];
      revenues: number[];
    }>();

    // Initialize all months
    for (let i = 0; i < 12; i++) {
      monthlyData.set(i, { occupancy: [], bookingCounts: [], revenues: [] });
    }

    // Group bookings by year-month
    const yearMonthBookings = new Map<string, BookingData[]>();

    bookings.forEach((booking) => {
      const checkIn = new Date(booking.check_in_date);
      const key = `${checkIn.getFullYear()}-${checkIn.getMonth()}`;
      const existing = yearMonthBookings.get(key) || [];
      existing.push(booking);
      yearMonthBookings.set(key, existing);
    });

    // Calculate metrics for each year-month and aggregate by month
    yearMonthBookings.forEach((monthBookings, key) => {
      const month = parseInt(key.split('-')[1]);
      const data = monthlyData.get(month)!;

      // Calculate total nights booked in this month
      const totalNights = monthBookings.reduce(
        (sum, b) => sum + (b.total_nights || 1),
        0
      );

      // Estimate occupancy (assume 30 days in month, 100 properties)
      const estimatedCapacity = 30 * 100;
      const occupancy = Math.min(100, (totalNights / estimatedCapacity) * 100);

      data.occupancy.push(occupancy);
      data.bookingCounts.push(monthBookings.length);
      data.revenues.push(
        monthBookings.reduce((sum, b) => sum + (b.revenue || 0), 0)
      );
    });

    return monthlyData;
  }

  /**
   * Identify peak season months
   */
  private identifyPeakMonths(patterns: SeasonalPattern[]): number[] {
    return patterns
      .filter((p) => p.isHighSeason)
      .map((p) => p.month)
      .sort((a, b) => a - b);
  }

  /**
   * Identify low season months
   */
  private identifyLowMonths(patterns: SeasonalPattern[]): number[] {
    const sortedByRevenue = [...patterns].sort(
      (a, b) => a.revenueIndex - b.revenueIndex
    );
    return sortedByRevenue.slice(0, 3).map((p) => p.month);
  }

  /**
   * Calculate seasonality index (variance measure)
   */
  private calculateSeasonalityIndex(patterns: SeasonalPattern[]): number {
    const revenueIndices = patterns.map((p) => p.revenueIndex);
    const mean = revenueIndices.reduce((a, b) => a + b, 0) / revenueIndices.length;
    const variance =
      revenueIndices.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      revenueIndices.length;

    // Return coefficient of variation (higher = more seasonal)
    return Math.sqrt(variance) / mean;
  }

  /**
   * Calculate year-over-year trend
   */
  async calculateYearOverYearTrend(): Promise<number> {
    const now = new Date();
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const { data: thisYear, error: thisError } = await this.supabase
      .from('bookings')
      .select('revenue')
      .gte('check_in_date', thisYearStart.toISOString())
      .lte('check_in_date', now.toISOString());

    const { data: lastYear, error: lastError } = await this.supabase
      .from('bookings')
      .select('revenue')
      .gte('check_in_date', lastYearStart.toISOString())
      .lte('check_in_date', lastYearEnd.toISOString());

    if (thisError || lastError) {
      console.error('Error calculating YoY trend');
      return 0;
    }

    const thisYearRevenue = (thisYear || []).reduce(
      (sum, b) => sum + (b.revenue || 0),
      0
    );
    const lastYearRevenue = (lastYear || []).reduce(
      (sum, b) => sum + (b.revenue || 0),
      0
    );

    if (lastYearRevenue === 0) return 0;

    return ((thisYearRevenue - lastYearRevenue) / lastYearRevenue) * 100;
  }

  /**
   * Get default patterns when no data is available
   */
  private getDefaultPatterns(): SeasonalPattern[] {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Arizona tourism patterns
    const defaultIndices = [
      0.85, 0.90, 1.05, 1.10, 1.00, 0.80,
      0.75, 0.70, 0.85, 1.05, 1.15, 1.00
    ];

    return monthNames.map((name, month) => ({
      month,
      monthName: name,
      averageOccupancy: 50 * defaultIndices[month],
      averageBookings: 100 * defaultIndices[month],
      revenueIndex: defaultIndices[month],
      isHighSeason: defaultIndices[month] >= 1.05,
    }));
  }

  /**
   * Predict demand for a specific future date
   */
  async predictDemand(date: Date): Promise<number> {
    const patterns = await this.analyzeSeasonalPatterns(2);
    const month = date.getMonth();
    const pattern = patterns.find((p) => p.month === month);

    if (!pattern) return 50;

    // Base prediction on historical pattern
    const basePrediction = pattern.averageOccupancy;

    // Adjust for day of week (weekends typically higher)
    const dayOfWeek = date.getDay();
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.2 : 1.0;

    // Adjust for holidays (simplified)
    const isHolidayPeriod = this.isHolidayPeriod(date);
    const holidayMultiplier = isHolidayPeriod ? 1.3 : 1.0;

    return Math.min(100, basePrediction * weekendMultiplier * holidayMultiplier);
  }

  /**
   * Check if date falls in a holiday period
   */
  private isHolidayPeriod(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    // Major US holiday periods
    const holidays = [
      { month: 11, start: 20, end: 31 }, // Christmas/New Year
      { month: 0, start: 1, end: 3 },    // New Year
      { month: 2, start: 10, end: 20 },  // Spring Break
      { month: 6, start: 1, end: 7 },    // July 4th
      { month: 10, start: 20, end: 30 }, // Thanksgiving
    ];

    return holidays.some(
      (h) => h.month === month && day >= h.start && day <= h.end
    );
  }

  /**
   * Get seasonal recommendations for enforcement timing
   */
  async getEnforcementRecommendations(): Promise<string[]> {
    const analytics = await this.getSeasonalAnalytics();
    const recommendations: string[] = [];

    // Recommend enforcement during low seasons when resources are less strained
    const lowSeasonNames = analytics.lowMonths.map(
      (m) => analytics.patterns[m].monthName
    );

    recommendations.push(
      `Consider intensive enforcement campaigns during low season months: ${lowSeasonNames.join(', ')}`
    );

    // Recommend pre-peak season registration drives
    const prePeakMonths = analytics.peakMonths
      .map((m) => (m === 0 ? 11 : m - 1))
      .map((m) => analytics.patterns[m].monthName);

    recommendations.push(
      `Launch registration drives in: ${prePeakMonths.join(', ')} to maximize compliance before peak season`
    );

    // Trend-based recommendations
    if (analytics.yearOverYearTrend > 10) {
      recommendations.push(
        'Market is growing rapidly - prioritize outreach to new operators'
      );
    } else if (analytics.yearOverYearTrend < -10) {
      recommendations.push(
        'Market is contracting - focus on retention of registered properties'
      );
    }

    return recommendations;
  }
}
