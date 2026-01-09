import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/etablissements - Get all hotels from Google Places
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get hotels (google_places platform)
    const { data: hotels, error } = await supabase
      .from('scraped_listings')
      .select('*')
      .eq('platform', 'google_places')
      .order('city', { ascending: true })
      .order('title', { ascending: true });

    if (error) throw error;

    const hotelsList = hotels || [];

    // Calculate stats
    const withPhone = hotelsList.filter(
      (h) => h.raw_data?.phone
    ).length;

    const byCity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    hotelsList.forEach((h) => {
      // By city
      const city = h.city || 'Autre';
      byCity[city] = (byCity[city] || 0) + 1;

      // By type
      const type = h.raw_data?.property_type || 'Lodging';
      byType[type] = (byType[type] || 0) + 1;
    });

    return NextResponse.json({
      hotels: hotelsList,
      stats: {
        total: hotelsList.length,
        withPhone,
        byCity,
        byType,
      },
    });
  } catch (error) {
    console.error('Get hotels error:', error);
    return NextResponse.json({ error: 'Failed to get hotels' }, { status: 500 });
  }
}
