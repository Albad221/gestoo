import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/alerts - Fetch alerts with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    // Get filter parameters
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    let query = supabase
      .from('alerts')
      .select(`
        *,
        properties (id, name, address, city, region, registration_number),
        guests (id, first_name, last_name, nationality, date_of_birth, phone, email, passport_number, national_id_number),
        stays (id, check_in, check_out, status, room_number)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts', details: error.message }, { status: 500 });
    }

    // Filter by search term if provided (client-side filter for now)
    let filteredAlerts = alerts || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAlerts = filteredAlerts.filter(alert => {
        const guestName = `${alert.guests?.first_name || ''} ${alert.guests?.last_name || ''}`.toLowerCase();
        const propertyName = (alert.properties?.name || '').toLowerCase();
        const title = (alert.title || '').toLowerCase();
        return guestName.includes(searchLower) || propertyName.includes(searchLower) || title.includes(searchLower);
      });
    }

    // Calculate stats
    const stats = {
      total: filteredAlerts.length,
      open: filteredAlerts.filter(a => a.status === 'open').length,
      investigating: filteredAlerts.filter(a => a.status === 'investigating').length,
      critical: filteredAlerts.filter(a => a.severity === 'critical' && a.status !== 'resolved' && a.status !== 'dismissed').length,
      minorGuests: filteredAlerts.filter(a => a.type === 'minor_guest' && a.status !== 'resolved' && a.status !== 'dismissed').length,
    };

    return NextResponse.json({ alerts: filteredAlerts, stats });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/alerts - Create a new alert
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const {
      type,
      severity = 'medium',
      title,
      description,
      property_id,
      guest_id,
      stay_id,
      metadata = {},
    } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'Type and title are required' }, { status: 400 });
    }

    // Create the alert
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        type,
        severity,
        status: 'open',
        title,
        description,
        property_id,
        guest_id,
        stay_id,
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        properties (id, name, address, city),
        guests (id, first_name, last_name)
      `)
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json({ error: 'Failed to create alert', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
