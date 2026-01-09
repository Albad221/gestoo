import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/alerts/[id] - Get single alert details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: alert, error } = await supabase
      .from('alerts')
      .select(`
        *,
        properties (id, name, address, city, region, registration_number, landlords(first_name, last_name, phone, email)),
        guests (id, first_name, last_name, nationality, date_of_birth, phone, email, passport_number, national_id_number, id_document_type),
        stays (id, check_in, check_out, status, room_number, num_guests)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching alert:', error);
      return NextResponse.json({ error: 'Alert not found', details: error.message }, { status: 404 });
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

/**
 * PATCH /api/alerts/[id] - Update alert status/details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const {
      status,
      severity,
      assigned_to,
      resolution_notes,
      metadata,
    } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
      // If resolving or dismissing, set resolved_at
      if (status === 'resolved' || status === 'dismissed') {
        updates.resolved_at = new Date().toISOString();
      }
    }
    if (severity) updates.severity = severity;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
    if (metadata) {
      // Merge with existing metadata
      const { data: existing } = await supabase
        .from('alerts')
        .select('metadata')
        .eq('id', id)
        .single();
      updates.metadata = { ...(existing?.metadata || {}), ...metadata };
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        properties (id, name, address, city),
        guests (id, first_name, last_name)
      `)
      .single();

    if (error) {
      console.error('Error updating alert:', error);
      return NextResponse.json({ error: 'Failed to update alert', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/alerts/[id] - Delete an alert
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting alert:', error);
      return NextResponse.json({ error: 'Failed to delete alert', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
