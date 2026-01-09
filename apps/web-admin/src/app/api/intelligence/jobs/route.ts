import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/intelligence/jobs - Get scrape jobs history
 *
 * Query params:
 * - status: Filter by status (pending, running, completed, failed)
 * - platform: Filter by platform
 * - limit: Number of results (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('scrape_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const stats = {
      total: jobs?.length || 0,
      pending: jobs?.filter(j => j.status === 'pending').length || 0,
      running: jobs?.filter(j => j.status === 'running').length || 0,
      completed: jobs?.filter(j => j.status === 'completed').length || 0,
      failed: jobs?.filter(j => j.status === 'failed').length || 0,
    };

    // Get last successful scrape per platform
    const lastScrapes: Record<string, string | null> = {};
    const platforms = ['airbnb', 'booking', 'expat_dakar', 'jumia_house', 'coinafrique', 'mamaison', 'keur_immo'];

    for (const p of platforms) {
      const lastJob = jobs?.find(j => j.platform === p && j.status === 'completed');
      lastScrapes[p] = lastJob?.completed_at || null;
    }

    return NextResponse.json({
      jobs: jobs || [],
      stats,
      lastScrapes,
    });

  } catch (error) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
