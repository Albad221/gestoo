/**
 * Enforcement Alerts Edge Function
 * Generates and sends alerts to enforcement teams about priority targets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnforcementTarget {
  id: string;
  priority: number;
  listing: {
    platform: string;
    url: string;
    title: string;
    hostName: string;
    location: string;
    pricePerNight: number;
  };
  report: {
    id: string;
    type: string;
    severity: string;
    description: string;
  };
  estimatedImpact: {
    monthlyRevenue: number;
    annualTaxLoss: number;
    guestsPerMonth: number;
  };
  suggestedAction: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { city = 'Dakar', limit = 20, sendNotifications = false } = await req.json();

    // Get open reports ordered by severity
    const { data: reports, error: reportsError } = await supabase
      .from('illegal_listing_reports')
      .select(`
        *,
        scraped_listing:scraped_listings (
          id,
          platform,
          url,
          title,
          host_name,
          neighborhood,
          city,
          price_per_night,
          review_count,
          rating
        )
      `)
      .in('status', ['new', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (reportsError) throw reportsError;

    // Filter by city if specified
    const filteredReports = (reports || []).filter(
      (r) => !city || r.scraped_listing?.city === city
    );

    // Calculate priority scores and create targets
    const targets: EnforcementTarget[] = filteredReports.map((report) => {
      const listing = report.scraped_listing;
      const evidence = report.evidence || {};

      // Calculate priority score (0-100)
      let priority = 0;

      // Severity contribution (max 40 points)
      const severityScores: Record<string, number> = {
        critical: 40,
        high: 30,
        medium: 20,
        low: 10,
      };
      priority += severityScores[report.severity] || 10;

      // Review count indicates established operation (max 20 points)
      const reviewCount = listing?.review_count || 0;
      priority += Math.min(20, reviewCount);

      // High-volume operators get priority (max 20 points)
      const hostPropertyCount = evidence.hostPropertyCount || 1;
      priority += Math.min(20, hostPropertyCount * 4);

      // High price = more tax loss (max 20 points)
      const pricePerNight = listing?.price_per_night || 0;
      if (pricePerNight > 100000) priority += 20;
      else if (pricePerNight > 50000) priority += 15;
      else if (pricePerNight > 25000) priority += 10;
      else priority += 5;

      // Estimate impact
      const occupancyRate = 0.5;
      const avgGuests = 2;
      const daysPerMonth = 30;
      const monthlyOccupiedNights = daysPerMonth * occupancyRate;

      const monthlyRevenue = pricePerNight * monthlyOccupiedNights;
      const annualTaxLoss = monthlyOccupiedNights * 12 * avgGuests * 1000; // 1000 FCFA TPT per guest per night
      const guestsPerMonth = monthlyOccupiedNights * avgGuests;

      // Suggest action based on severity and evidence
      let suggestedAction = 'Monitor and gather more evidence';
      if (report.severity === 'critical') {
        suggestedAction = 'Immediate inspection recommended. Consider formal notice.';
      } else if (report.severity === 'high') {
        suggestedAction = 'Schedule inspection within 1 week. Prepare compliance notice.';
      } else if (report.severity === 'medium') {
        suggestedAction = 'Send registration reminder. Schedule follow-up in 2 weeks.';
      }

      return {
        id: report.id,
        priority,
        listing: {
          platform: listing?.platform || 'unknown',
          url: listing?.url || '',
          title: listing?.title || 'Unknown Listing',
          hostName: listing?.host_name || 'Unknown',
          location: listing?.neighborhood || listing?.city || 'Unknown',
          pricePerNight: pricePerNight,
        },
        report: {
          id: report.id,
          type: report.report_type,
          severity: report.severity,
          description: report.description,
        },
        estimatedImpact: {
          monthlyRevenue,
          annualTaxLoss,
          guestsPerMonth: Math.round(guestsPerMonth),
        },
        suggestedAction,
      };
    });

    // Sort by priority
    targets.sort((a, b) => b.priority - a.priority);
    const prioritizedTargets = targets.slice(0, limit);

    // Calculate summary stats
    const totalAnnualTaxLoss = targets.reduce((sum, t) => sum + t.estimatedImpact.annualTaxLoss, 0);
    const totalMonthlyRevenue = targets.reduce((sum, t) => sum + t.estimatedImpact.monthlyRevenue, 0);

    // Send notifications if requested
    if (sendNotifications && prioritizedTargets.length > 0) {
      // Get admin users who should receive alerts
      const { data: admins } = await supabase
        .from('admin_users')
        .select('user_id, role, email')
        .in('role', ['admin', 'ministry', 'tax_authority']);

      // Create alert notifications
      const criticalCount = prioritizedTargets.filter((t) => t.report.severity === 'critical').length;
      const highCount = prioritizedTargets.filter((t) => t.report.severity === 'high').length;

      if (criticalCount > 0 || highCount > 0) {
        await supabase.from('alerts').insert({
          type: 'enforcement_priority',
          message: `Enforcement Alert: ${criticalCount} critical, ${highCount} high priority targets identified in ${city}`,
          data: {
            city,
            criticalCount,
            highCount,
            totalTargets: prioritizedTargets.length,
            estimatedAnnualTaxLoss: totalAnnualTaxLoss,
          },
          is_read: false,
        });
      }
    }

    const response = {
      city,
      generatedAt: new Date().toISOString(),
      summary: {
        totalReports: filteredReports.length,
        prioritizedCount: prioritizedTargets.length,
        bySeverity: {
          critical: targets.filter((t) => t.report.severity === 'critical').length,
          high: targets.filter((t) => t.report.severity === 'high').length,
          medium: targets.filter((t) => t.report.severity === 'medium').length,
          low: targets.filter((t) => t.report.severity === 'low').length,
        },
        estimatedTotalAnnualTaxLoss: totalAnnualTaxLoss,
        estimatedTotalMonthlyRevenue: totalMonthlyRevenue,
      },
      targets: prioritizedTargets,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Enforcement alerts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
