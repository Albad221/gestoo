/**
 * Flag Suspicious Listings Edge Function
 * Automatically flags listings that meet certain criteria for investigation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuspiciousFlags {
  highVolume: boolean;
  inconsistentPricing: boolean;
  noMatchFound: boolean;
  multipleProperties: boolean;
  newButHighActivity: boolean;
}

interface FlaggedListing {
  id: string;
  platform: string;
  url: string;
  title: string;
  hostName: string;
  neighborhood: string;
  flags: SuspiciousFlags;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
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

    const { city = 'Dakar', createReports = true } = await req.json();

    // Get all unmatched listings
    const { data: listings, error: listingsError } = await supabase
      .from('scraped_listings')
      .select(`
        *,
        listing_matches (
          match_type,
          match_score,
          status
        )
      `)
      .eq('city', city)
      .eq('is_active', true);

    if (listingsError) throw listingsError;

    // Get average price for the city
    const prices = (listings || [])
      .map((l) => l.price_per_night)
      .filter((p) => p && p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 50000;
    const priceStdDev = Math.sqrt(
      prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / (prices.length || 1)
    );

    // Group listings by host
    const hostListings: Record<string, any[]> = {};
    for (const listing of listings || []) {
      const hostKey = listing.host_name?.toLowerCase() || listing.host_id || 'unknown';
      if (!hostListings[hostKey]) {
        hostListings[hostKey] = [];
      }
      hostListings[hostKey].push(listing);
    }

    const flaggedListings: FlaggedListing[] = [];

    for (const listing of listings || []) {
      const flags: SuspiciousFlags = {
        highVolume: false,
        inconsistentPricing: false,
        noMatchFound: false,
        multipleProperties: false,
        newButHighActivity: false,
      };

      const reasons: string[] = [];

      // Check for no match
      const matches = listing.listing_matches || [];
      const bestMatch = matches[0];
      if (!bestMatch || bestMatch.match_type === 'no_match') {
        flags.noMatchFound = true;
        reasons.push('No registered property match found');
      }

      // Check for multiple properties from same host
      const hostKey = listing.host_name?.toLowerCase() || listing.host_id || 'unknown';
      const hostPropertyCount = hostListings[hostKey]?.length || 0;
      if (hostPropertyCount >= 3) {
        flags.multipleProperties = true;
        reasons.push(`Host has ${hostPropertyCount} listings without full registration`);
      }
      if (hostPropertyCount >= 5) {
        flags.highVolume = true;
        reasons.push('High-volume operator');
      }

      // Check for pricing anomalies (unusually low might indicate unreported activity)
      if (listing.price_per_night) {
        const deviation = Math.abs(listing.price_per_night - avgPrice) / (priceStdDev || 1);
        if (deviation > 2) {
          flags.inconsistentPricing = true;
          reasons.push(
            listing.price_per_night < avgPrice
              ? 'Suspiciously low pricing'
              : 'Premium pricing without registration'
          );
        }
      }

      // Check for new listings with high review count (operating before registration)
      const daysSinceFirstSeen = listing.first_seen_at
        ? (Date.now() - new Date(listing.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      if (daysSinceFirstSeen < 30 && (listing.review_count || 0) > 20) {
        flags.newButHighActivity = true;
        reasons.push('Recently discovered but has significant review history');
      }

      // Calculate severity
      const flagCount = Object.values(flags).filter(Boolean).length;
      let severity: FlaggedListing['severity'] = 'low';
      if (flagCount >= 4) {
        severity = 'critical';
      } else if (flagCount >= 3) {
        severity = 'high';
      } else if (flagCount >= 2) {
        severity = 'medium';
      }

      // Only flag if there's at least one issue beyond "no match"
      if (flagCount > 1 || (flagCount === 1 && !flags.noMatchFound)) {
        flaggedListings.push({
          id: listing.id,
          platform: listing.platform,
          url: listing.url,
          title: listing.title,
          hostName: listing.host_name,
          neighborhood: listing.neighborhood,
          flags,
          severity,
          reason: reasons.join('; '),
        });

        // Create investigation report if requested
        if (createReports && severity !== 'low') {
          await supabase.from('illegal_listing_reports').upsert(
            {
              scraped_listing_id: listing.id,
              report_type: 'unregistered',
              severity,
              description: reasons.join('\n'),
              evidence: {
                flags,
                hostPropertyCount,
                priceDeviation: listing.price_per_night
                  ? Math.abs(listing.price_per_night - avgPrice) / avgPrice
                  : null,
                reviewCount: listing.review_count,
                daysSinceFirstSeen,
              },
              status: 'new',
            },
            {
              onConflict: 'scraped_listing_id',
              ignoreDuplicates: true,
            }
          );
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    flaggedListings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const summary = {
      city,
      totalAnalyzed: listings?.length || 0,
      totalFlagged: flaggedListings.length,
      bySeverity: {
        critical: flaggedListings.filter((l) => l.severity === 'critical').length,
        high: flaggedListings.filter((l) => l.severity === 'high').length,
        medium: flaggedListings.filter((l) => l.severity === 'medium').length,
        low: flaggedListings.filter((l) => l.severity === 'low').length,
      },
      flaggedListings: flaggedListings.slice(0, 50), // Return top 50
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Flag suspicious error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
