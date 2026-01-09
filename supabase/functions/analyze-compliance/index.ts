/**
 * Analyze Compliance Edge Function
 * Analyzes scraped listings against registered properties to calculate compliance metrics
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplianceReport {
  city: string;
  totalScrapedListings: number;
  likelyRegistered: number;
  likelyUnregistered: number;
  complianceRate: number;
  estimatedTaxLoss: number;
  topUnregisteredNeighborhoods: Array<{ neighborhood: string; count: number }>;
  platformBreakdown: Array<{ platform: string; total: number; registered: number; complianceRate: number }>;
  recommendations: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { city = 'Dakar' } = await req.json();

    // Get all active scraped listings for the city
    const { data: scrapedListings, error: scrapedError } = await supabase
      .from('scraped_listings')
      .select(`
        id,
        platform,
        neighborhood,
        price_per_night,
        listing_matches (
          match_type,
          match_score,
          status
        )
      `)
      .eq('city', city)
      .eq('is_active', true);

    if (scrapedError) throw scrapedError;

    // Get registered property count
    const { count: registeredCount, error: registeredError } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('city', city)
      .eq('status', 'active');

    if (registeredError) throw registeredError;

    // Analyze listings
    const listings = scrapedListings || [];
    let likelyRegistered = 0;
    let likelyUnregistered = 0;
    const neighborhoodCounts: Record<string, number> = {};
    const platformStats: Record<string, { total: number; registered: number }> = {};

    for (const listing of listings) {
      const matches = listing.listing_matches || [];
      const bestMatch = matches[0];

      // Determine if likely registered
      const isRegistered =
        bestMatch &&
        (bestMatch.match_type === 'exact' || bestMatch.match_type === 'probable') &&
        bestMatch.status !== 'verified_different';

      if (isRegistered) {
        likelyRegistered++;
      } else {
        likelyUnregistered++;

        // Track unregistered by neighborhood
        const neighborhood = listing.neighborhood || 'Unknown';
        neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1;
      }

      // Track by platform
      if (!platformStats[listing.platform]) {
        platformStats[listing.platform] = { total: 0, registered: 0 };
      }
      platformStats[listing.platform].total++;
      if (isRegistered) {
        platformStats[listing.platform].registered++;
      }
    }

    // Calculate compliance rate
    const totalListings = listings.length;
    const complianceRate = totalListings > 0 ? likelyRegistered / totalListings : 1;

    // Estimate tax loss (assuming 1000 FCFA TPT per night, 50% occupancy, average 2 guests)
    const avgPrice = listings.reduce((sum, l) => sum + (l.price_per_night || 0), 0) / (totalListings || 1);
    const estimatedNightsPerYear = 365 * 0.5; // 50% occupancy
    const estimatedTaxLoss = likelyUnregistered * 1000 * estimatedNightsPerYear * 2; // 2 guests avg

    // Top unregistered neighborhoods
    const topNeighborhoods = Object.entries(neighborhoodCounts)
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Platform breakdown
    const platformBreakdown = Object.entries(platformStats).map(([platform, stats]) => ({
      platform,
      total: stats.total,
      registered: stats.registered,
      complianceRate: stats.total > 0 ? stats.registered / stats.total : 0,
    }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (complianceRate < 0.5) {
      recommendations.push(
        `Critical: Only ${(complianceRate * 100).toFixed(1)}% compliance rate. Immediate enforcement action needed.`
      );
    }

    if (topNeighborhoods.length > 0) {
      recommendations.push(
        `Focus enforcement on ${topNeighborhoods[0].neighborhood} with ${topNeighborhoods[0].count} unregistered listings.`
      );
    }

    const lowestPlatform = platformBreakdown.sort((a, b) => a.complianceRate - b.complianceRate)[0];
    if (lowestPlatform && lowestPlatform.complianceRate < 0.4) {
      recommendations.push(
        `Engage with ${lowestPlatform.platform} - lowest compliance at ${(lowestPlatform.complianceRate * 100).toFixed(1)}%.`
      );
    }

    if (estimatedTaxLoss > 100000000) {
      recommendations.push(
        `Estimated annual tax loss: ${(estimatedTaxLoss / 1000000).toFixed(1)}M FCFA. Consider awareness campaign.`
      );
    }

    const report: ComplianceReport = {
      city,
      totalScrapedListings: totalListings,
      likelyRegistered,
      likelyUnregistered,
      complianceRate,
      estimatedTaxLoss,
      topUnregisteredNeighborhoods: topNeighborhoods,
      platformBreakdown,
      recommendations,
    };

    // Save to market intelligence table
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);

    await supabase.from('market_intelligence').upsert({
      period_start: periodStart.toISOString().split('T')[0],
      period_end: now.toISOString().split('T')[0],
      city,
      neighborhood: null,
      metrics: {
        ...report,
        generatedAt: now.toISOString(),
      },
    });

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Compliance analysis error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
