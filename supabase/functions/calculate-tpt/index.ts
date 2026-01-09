import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TPT_RATE_PER_NIGHT = 1000; // FCFA

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stay_id } = await req.json();

    if (!stay_id) {
      return new Response(
        JSON.stringify({ error: 'stay_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the stay with property info
    const { data: stay, error: stayError } = await supabaseClient
      .from('stays')
      .select('*, properties(landlord_id)')
      .eq('id', stay_id)
      .single();

    if (stayError || !stay) {
      return new Response(
        JSON.stringify({ error: 'Stay not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate TPT
    const nights = stay.nights || 1;
    const numGuests = stay.num_guests || 1;
    const amount = TPT_RATE_PER_NIGHT * nights * numGuests;

    // Check if tax liability already exists
    const { data: existingLiability } = await supabaseClient
      .from('tax_liabilities')
      .select('id')
      .eq('stay_id', stay_id)
      .single();

    if (existingLiability) {
      // Update existing
      const { data: updated, error: updateError } = await supabaseClient
        .from('tax_liabilities')
        .update({
          guest_nights: nights * numGuests,
          amount,
        })
        .eq('id', existingLiability.id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update tax liability' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          tax_liability_id: updated.id,
          amount,
          nights,
          num_guests: numGuests,
          rate_per_night: TPT_RATE_PER_NIGHT,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new tax liability
    const { data: liability, error: insertError } = await supabaseClient
      .from('tax_liabilities')
      .insert({
        property_id: stay.property_id,
        landlord_id: stay.properties.landlord_id,
        stay_id: stay.id,
        guest_nights: nights * numGuests,
        rate_per_night: TPT_RATE_PER_NIGHT,
        amount,
        status: 'pending',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tax liability:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create tax liability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        tax_liability_id: liability.id,
        amount,
        nights,
        num_guests: numGuests,
        rate_per_night: TPT_RATE_PER_NIGHT,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
