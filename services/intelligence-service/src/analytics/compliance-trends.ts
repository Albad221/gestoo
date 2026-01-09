import { SupabaseClient } from '@supabase/supabase-js';
import {
  ComplianceTrend,
  ComplianceMetrics,
  CityCompliance,
  PropertyTypeCompliance,
  TimeRange,
} from '../types';

export class ComplianceTrendsAnalyzer {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get compliance metrics for a given time range
   */
  async getComplianceMetrics(timeRange: TimeRange): Promise<ComplianceMetrics> {
    const trends = await this.getComplianceTrends(timeRange);
    const byCity = await this.getComplianceByCity();
    const byPropertyType = await this.getComplianceByPropertyType();

    const currentRate = trends.length > 0 ? trends[trends.length - 1].complianceRate : 0;
    const previousRate = trends.length > 1 ? trends[trends.length - 2].complianceRate : currentRate;
    const changePercent = previousRate > 0
      ? ((currentRate - previousRate) / previousRate) * 100
      : 0;

    return {
      currentRate,
      previousRate,
      changePercent,
      trends,
      byCity,
      byPropertyType,
    };
  }

  /**
   * Get daily compliance trends over a time period
   */
  async getComplianceTrends(timeRange: TimeRange): Promise<ComplianceTrend[]> {
    const { data: registrations, error: regError } = await this.supabase
      .from('property_registrations')
      .select('id, created_at, status')
      .gte('created_at', timeRange.startDate.toISOString())
      .lte('created_at', timeRange.endDate.toISOString());

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return [];
    }

    const { data: properties, error: propError } = await this.supabase
      .from('properties')
      .select('id, created_at, registration_status');

    if (propError) {
      console.error('Error fetching properties:', propError);
      return [];
    }

    // Group by date and calculate trends
    const trendMap = new Map<string, ComplianceTrend>();
    const startDate = new Date(timeRange.startDate);
    const endDate = new Date(timeRange.endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const dateObj = new Date(dateKey);

      // Count properties and registrations up to this date
      const totalProperties = (properties || []).filter(
        (p) => new Date(p.created_at) <= dateObj
      ).length;

      const registeredProperties = (properties || []).filter(
        (p) =>
          new Date(p.created_at) <= dateObj &&
          p.registration_status === 'registered'
      ).length;

      const unregisteredProperties = totalProperties - registeredProperties;

      // Count new registrations on this date
      const newRegistrations = (registrations || []).filter((r) => {
        const regDate = new Date(r.created_at).toISOString().split('T')[0];
        return regDate === dateKey && r.status === 'active';
      }).length;

      // Count deregistrations on this date
      const deregistrations = (registrations || []).filter((r) => {
        const regDate = new Date(r.created_at).toISOString().split('T')[0];
        return regDate === dateKey && r.status === 'cancelled';
      }).length;

      const complianceRate =
        totalProperties > 0 ? (registeredProperties / totalProperties) * 100 : 0;

      trendMap.set(dateKey, {
        date: dateObj,
        complianceRate,
        totalProperties,
        registeredProperties,
        unregisteredProperties,
        newRegistrations,
        deregistrations,
      });
    }

    return Array.from(trendMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Get compliance breakdown by city
   */
  async getComplianceByCity(): Promise<CityCompliance[]> {
    const { data: properties, error } = await this.supabase
      .from('properties')
      .select('id, city, registration_status');

    if (error) {
      console.error('Error fetching properties by city:', error);
      return [];
    }

    const cityMap = new Map<string, { total: number; registered: number }>();

    (properties || []).forEach((property) => {
      const city = property.city || 'Unknown';
      const current = cityMap.get(city) || { total: 0, registered: 0 };
      current.total++;
      if (property.registration_status === 'registered') {
        current.registered++;
      }
      cityMap.set(city, current);
    });

    return Array.from(cityMap.entries())
      .map(([city, data]) => ({
        city,
        totalProperties: data.total,
        registeredCount: data.registered,
        complianceRate: data.total > 0 ? (data.registered / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.totalProperties - a.totalProperties);
  }

  /**
   * Get compliance breakdown by property type
   */
  async getComplianceByPropertyType(): Promise<PropertyTypeCompliance[]> {
    const { data: properties, error } = await this.supabase
      .from('properties')
      .select('id, property_type, registration_status');

    if (error) {
      console.error('Error fetching properties by type:', error);
      return [];
    }

    const typeMap = new Map<string, { total: number; registered: number }>();

    (properties || []).forEach((property) => {
      const propertyType = property.property_type || 'Unknown';
      const current = typeMap.get(propertyType) || { total: 0, registered: 0 };
      current.total++;
      if (property.registration_status === 'registered') {
        current.registered++;
      }
      typeMap.set(propertyType, current);
    });

    return Array.from(typeMap.entries())
      .map(([propertyType, data]) => ({
        propertyType,
        count: data.total,
        complianceRate: data.total > 0 ? (data.registered / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate compliance velocity (rate of change)
   */
  async getComplianceVelocity(days: number = 30): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await this.getComplianceTrends({ startDate, endDate });

    if (trends.length < 2) {
      return 0;
    }

    const firstRate = trends[0].complianceRate;
    const lastRate = trends[trends.length - 1].complianceRate;

    return (lastRate - firstRate) / days; // Daily change rate
  }

  /**
   * Predict future compliance rate based on current trends
   */
  async predictComplianceRate(daysAhead: number): Promise<number> {
    const velocity = await this.getComplianceVelocity(30);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const recentTrends = await this.getComplianceTrends({ startDate, endDate });
    const currentRate =
      recentTrends.length > 0 ? recentTrends[recentTrends.length - 1].complianceRate : 0;

    // Simple linear prediction
    const predictedRate = currentRate + velocity * daysAhead;

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, predictedRate));
  }
}
