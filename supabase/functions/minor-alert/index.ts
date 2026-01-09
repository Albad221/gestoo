import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Determine alert severity based on circumstances
function determineSeverity(data: {
  age: number;
  hasGuardian: boolean;
  guardianVerified: boolean;
  isNightCheckin: boolean;
}): 'low' | 'medium' | 'high' | 'critical' {
  const { age, hasGuardian, guardianVerified, isNightCheckin } = data;

  // Critical: Very young minor (under 14) without verified guardian
  if (age < 14 && (!hasGuardian || !guardianVerified)) {
    return 'critical';
  }

  // High: Minor (14-17) without guardian, or night check-in without verified guardian
  if (!hasGuardian || (isNightCheckin && !guardianVerified)) {
    return 'high';
  }

  // Medium: Minor with unverified guardian
  if (!guardianVerified) {
    return 'medium';
  }

  // Low: Minor with verified guardian (routine tracking)
  return 'low';
}

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

    const { stay_id, action } = await req.json();

    if (!stay_id) {
      return new Response(
        JSON.stringify({ error: 'stay_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get stay with guest and property info
    const { data: stay, error: stayError } = await supabaseClient
      .from('stays')
      .select(`
        *,
        guests(*),
        properties(*, landlords(full_name, phone))
      `)
      .eq('id', stay_id)
      .single();

    if (stayError || !stay) {
      return new Response(
        JSON.stringify({ error: 'Stay not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const guest = stay.guests;
    const property = stay.properties;

    // Check if guest is a minor
    const age = calculateAge(guest.date_of_birth);
    if (age >= 18) {
      return new Response(
        JSON.stringify({ message: 'Guest is not a minor, no alert needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if it's a night check-in (between 10 PM and 6 AM)
    const checkInHour = new Date(stay.check_in).getHours();
    const isNightCheckin = checkInHour >= 22 || checkInHour < 6;

    // Check guardian info
    const hasGuardian = stay.is_accompanied && stay.guardian_name && stay.guardian_phone;
    const guardianVerified = stay.guardian_verified || false;

    // Determine severity
    const severity = determineSeverity({
      age,
      hasGuardian,
      guardianVerified,
      isNightCheckin,
    });

    // Build alert description
    let description = `Mineur de ${age} ans (${guest.first_name} ${guest.last_name}) `;
    description += `enregistre a ${property.name}, ${property.address}, ${property.city}. `;

    if (!hasGuardian) {
      description += 'AUCUN ACCOMPAGNATEUR DECLARE. ';
    } else {
      description += `Accompagnateur: ${stay.guardian_name} (${stay.guardian_relationship || 'relation non specifiee'}). `;
      if (!guardianVerified) {
        description += 'Identite de l\'accompagnateur NON VERIFIEE. ';
      }
    }

    if (isNightCheckin) {
      description += 'Arrivee de nuit (horaire inhabituel). ';
    }

    description += `Proprietaire: ${property.landlords?.full_name} (${property.landlords?.phone}).`;

    // Check if alert already exists for this stay
    const { data: existingAlert } = await supabaseClient
      .from('alerts')
      .select('id')
      .eq('stay_id', stay_id)
      .eq('type', 'minor_protection')
      .single();

    let alertId: string;

    if (existingAlert) {
      // Update existing alert
      const { data: updated, error: updateError } = await supabaseClient
        .from('alerts')
        .update({
          severity,
          description,
          metadata: {
            guest_name: `${guest.first_name} ${guest.last_name}`,
            guest_age: age,
            guest_nationality: guest.nationality,
            guest_document: `${guest.document_type}: ${guest.document_number}`,
            property_name: property.name,
            property_address: `${property.address}, ${property.city}`,
            property_license: property.license_number,
            landlord_name: property.landlords?.full_name,
            landlord_phone: property.landlords?.phone,
            guardian_name: stay.guardian_name,
            guardian_phone: stay.guardian_phone,
            guardian_relationship: stay.guardian_relationship,
            guardian_document: stay.guardian_document_number,
            guardian_verified: guardianVerified,
            check_in_date: stay.check_in,
            is_night_checkin: isNightCheckin,
          },
        })
        .eq('id', existingAlert.id)
        .select()
        .single();

      if (updateError) throw updateError;
      alertId = existingAlert.id;
    } else {
      // Create new alert
      const { data: alert, error: insertError } = await supabaseClient
        .from('alerts')
        .insert({
          type: 'minor_protection',
          severity,
          property_id: stay.property_id,
          stay_id: stay.id,
          guest_id: stay.guest_id,
          description,
          status: 'open',
          metadata: {
            guest_name: `${guest.first_name} ${guest.last_name}`,
            guest_age: age,
            guest_nationality: guest.nationality,
            guest_document: `${guest.document_type}: ${guest.document_number}`,
            property_name: property.name,
            property_address: `${property.address}, ${property.city}`,
            property_license: property.license_number,
            landlord_name: property.landlords?.full_name,
            landlord_phone: property.landlords?.phone,
            guardian_name: stay.guardian_name,
            guardian_phone: stay.guardian_phone,
            guardian_relationship: stay.guardian_relationship,
            guardian_document: stay.guardian_document_number,
            guardian_verified: guardianVerified,
            check_in_date: stay.check_in,
            is_night_checkin: isNightCheckin,
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;
      alertId = alert.id;
    }

    // For high/critical alerts, send notifications
    if (severity === 'high' || severity === 'critical') {
      // In production, this would:
      // 1. Send SMS to local police station
      // 2. Send push notification to police app
      // 3. Send email to child protection unit
      // 4. Log to audit trail

      console.log(`[URGENT] Minor protection alert (${severity}):`, {
        alert_id: alertId,
        guest: `${guest.first_name} ${guest.last_name}`,
        age,
        property: property.name,
        location: `${property.city}, ${property.region}`,
      });

      // Create notification record
      await supabaseClient
        .from('notifications')
        .insert({
          type: 'minor_alert',
          recipient_type: 'police',
          title: `Alerte protection mineur - ${severity.toUpperCase()}`,
          message: description,
          metadata: { alert_id: alertId, severity },
          status: 'pending',
        });
    }

    return new Response(
      JSON.stringify({
        alert_id: alertId,
        severity,
        age,
        has_guardian: hasGuardian,
        guardian_verified: guardianVerified,
        is_night_checkin: isNightCheckin,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing minor alert:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
