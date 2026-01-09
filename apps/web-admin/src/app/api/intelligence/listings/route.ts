import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/intelligence/listings - Get all scraped listings
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listings, error } = await supabase
      .from('scraped_listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    return NextResponse.json({
      listings: listings || [],
    });

  } catch (error) {
    console.error('Get listings error:', error);
    return NextResponse.json({ error: 'Failed to get listings' }, { status: 500 });
  }
}
