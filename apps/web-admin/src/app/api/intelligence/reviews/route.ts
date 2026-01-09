import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/intelligence/reviews - Get pending reviews (matches that need human verification)
 *
 * Query params:
 * - status: Filter by match status (pending, verified_match, verified_different)
 * - match_type: Filter by match type (exact, probable, possible, no_match)
 * - limit: Number of results (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || 'pending';
    const matchType = searchParams.get('match_type');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get matches with their associated scraped listings and properties
    let query = supabase
      .from('listing_matches')
      .select(`
        *,
        scraped_listing:scraped_listings (
          id,
          platform,
          url,
          title,
          host_name,
          city,
          neighborhood,
          location_text,
          price_per_night,
          currency,
          bedrooms,
          max_guests,
          photos,
          latitude,
          longitude
        ),
        property:properties (
          id,
          name,
          address,
          city,
          neighborhood,
          latitude,
          longitude,
          total_rooms,
          capacity_guests,
          landlord:landlords (
            full_name,
            phone,
            email
          )
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by match type if specified
    if (matchType) {
      query = query.eq('match_type', matchType);
    } else {
      // By default, show probable and possible matches for review
      query = query.in('match_type', ['probable', 'possible']);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const stats = {
      total: reviews?.length || 0,
      exact: reviews?.filter(r => r.match_type === 'exact').length || 0,
      probable: reviews?.filter(r => r.match_type === 'probable').length || 0,
      possible: reviews?.filter(r => r.match_type === 'possible').length || 0,
      no_match: reviews?.filter(r => r.match_type === 'no_match').length || 0,
    };

    return NextResponse.json({
      reviews: reviews || [],
      stats,
    });

  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intelligence/reviews - Submit a review decision
 *
 * Body: {
 *   matchId: string,
 *   decision: 'approved' | 'rejected' | 'escalated',
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const { matchId, decision, notes } = body;

    if (!matchId || !decision) {
      return NextResponse.json(
        { error: 'matchId and decision are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'escalated'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be: approved, rejected, or escalated' },
        { status: 400 }
      );
    }

    // Map decision to database status
    const statusMap: Record<string, string> = {
      approved: 'verified_match',
      rejected: 'verified_different',
      escalated: 'escalated',
    };

    // Update the listing match
    const { error: updateError } = await supabase
      .from('listing_matches')
      .update({
        status: statusMap[decision],
        verified: decision === 'approved',
        rejected: decision === 'rejected',
        verified_at: new Date().toISOString(),
        notes,
      })
      .eq('id', matchId);

    if (updateError) {
      console.error('Error updating match:', updateError);
      return NextResponse.json(
        { error: 'Failed to update match', details: updateError.message },
        { status: 500 }
      );
    }

    // If approved, update the scraped_listing to mark as compliant
    if (decision === 'approved') {
      const { data: match } = await supabase
        .from('listing_matches')
        .select('scraped_listing_id, property_id')
        .eq('id', matchId)
        .single();

      if (match) {
        await supabase
          .from('scraped_listings')
          .update({
            matched_property_id: match.property_id,
            is_compliant: true,
            compliance_checked_at: new Date().toISOString(),
          })
          .eq('id', match.scraped_listing_id);
      }
    }

    // If rejected (confirmed unregistered), create an alert
    if (decision === 'rejected') {
      const { data: match } = await supabase
        .from('listing_matches')
        .select(`
          scraped_listing_id,
          scraped_listing:scraped_listings (
            title,
            host_name,
            platform,
            url,
            city
          )
        `)
        .eq('id', matchId)
        .single();

      if (match?.scraped_listing) {
        const listing = match.scraped_listing as any;
        await supabase
          .from('alerts')
          .insert({
            severity: 'medium',
            type: 'unregistered_property',
            title: `Propriété non enregistrée confirmée: ${listing.title || 'Sans titre'}`,
            description: `Hôte: ${listing.host_name || 'Inconnu'} | Plateforme: ${listing.platform} | Ville: ${listing.city || 'Non spécifiée'}`,
            metadata: {
              scraped_listing_id: match.scraped_listing_id,
              platform: listing.platform,
              url: listing.url,
              host_name: listing.host_name,
              reviewer_notes: notes,
            },
            status: 'new',
            auto_generated: false,
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Review ${decision} successfully`,
    });

  } catch (error) {
    console.error('Review submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
