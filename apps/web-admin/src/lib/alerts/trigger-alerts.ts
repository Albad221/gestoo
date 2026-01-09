import { SupabaseClient } from '@supabase/supabase-js';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  is_on_watchlist?: boolean;
  watchlist_reason?: string;
}

interface Property {
  id: string;
  name: string;
  city: string;
  registration_number: string | null;
}

interface Stay {
  id: string;
  check_in: string;
  guest_id: string;
  property_id: string;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check if guest is a minor and create alert if needed
 */
export async function checkMinorGuestAlert(
  supabase: SupabaseClient,
  guest: Guest,
  property: Property,
  stay: Stay
): Promise<void> {
  const age = calculateAge(guest.date_of_birth);

  if (age < 18) {
    // Check if there's already an open alert for this guest/stay
    const { data: existingAlert } = await supabase
      .from('alerts')
      .select('id')
      .eq('guest_id', guest.id)
      .eq('stay_id', stay.id)
      .eq('type', 'minor_guest')
      .in('status', ['open', 'investigating'])
      .single();

    if (!existingAlert) {
      await supabase.from('alerts').insert({
        type: 'minor_guest',
        severity: age < 14 ? 'critical' : 'high',
        status: 'open',
        title: `Mineur de ${age} ans enregistré`,
        description: `${guest.first_name} ${guest.last_name} (${age} ans) a été enregistré à ${property.name}. Vérification de l'accompagnateur requise.`,
        property_id: property.id,
        guest_id: guest.id,
        stay_id: stay.id,
        location_city: property.city,
        metadata: {
          guest_age: age,
          guest_nationality: guest.nationality,
          check_in_date: stay.check_in,
        },
      });
    }
  }
}

/**
 * Check if guest is on watchlist and create alert if needed
 */
export async function checkWatchlistAlert(
  supabase: SupabaseClient,
  guest: Guest,
  property: Property,
  stay: Stay
): Promise<void> {
  if (guest.is_on_watchlist) {
    // Check if there's already an open alert for this guest/stay
    const { data: existingAlert } = await supabase
      .from('alerts')
      .select('id')
      .eq('guest_id', guest.id)
      .eq('stay_id', stay.id)
      .eq('type', 'watchlist_match')
      .in('status', ['open', 'investigating'])
      .single();

    if (!existingAlert) {
      await supabase.from('alerts').insert({
        type: 'watchlist_match',
        severity: 'critical',
        status: 'open',
        title: `Correspondance liste de surveillance`,
        description: `${guest.first_name} ${guest.last_name} correspond à une entrée de la liste de surveillance. Raison: ${guest.watchlist_reason || 'Non spécifiée'}`,
        property_id: property.id,
        guest_id: guest.id,
        stay_id: stay.id,
        location_city: property.city,
        metadata: {
          watchlist_reason: guest.watchlist_reason,
          guest_nationality: guest.nationality,
          check_in_date: stay.check_in,
        },
      });
    }
  }
}

/**
 * Check if property is unregistered and create alert if needed
 */
export async function checkUnregisteredPropertyAlert(
  supabase: SupabaseClient,
  property: Property,
  stay: Stay
): Promise<void> {
  if (!property.registration_number) {
    // Check if there's already an open alert for this property (only one per property)
    const { data: existingAlert } = await supabase
      .from('alerts')
      .select('id')
      .eq('property_id', property.id)
      .eq('type', 'unregistered_property')
      .in('status', ['open', 'investigating'])
      .single();

    if (!existingAlert) {
      await supabase.from('alerts').insert({
        type: 'unregistered_property',
        severity: 'medium',
        status: 'open',
        title: `Propriété non enregistrée en activité`,
        description: `${property.name} à ${property.city} accueille des voyageurs sans numéro d'enregistrement valide.`,
        property_id: property.id,
        stay_id: stay.id,
        location_city: property.city,
        metadata: {
          property_name: property.name,
          first_detected: stay.check_in,
        },
      });
    }
  }
}

/**
 * Run all automatic alert checks for a new stay
 */
export async function triggerAlertsForNewStay(
  supabase: SupabaseClient,
  stayId: string
): Promise<{ alertsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let alertsCreated = 0;

  try {
    // Fetch the stay with guest and property details
    const { data: stay, error: stayError } = await supabase
      .from('stays')
      .select(`
        id,
        check_in,
        guest_id,
        property_id,
        guests (
          id,
          first_name,
          last_name,
          date_of_birth,
          nationality,
          is_on_watchlist,
          watchlist_reason
        ),
        properties (
          id,
          name,
          city,
          registration_number
        )
      `)
      .eq('id', stayId)
      .single();

    if (stayError || !stay) {
      errors.push(`Failed to fetch stay: ${stayError?.message || 'Stay not found'}`);
      return { alertsCreated, errors };
    }

    const guest = stay.guests as unknown as Guest;
    const property = stay.properties as unknown as Property;
    const stayData: Stay = {
      id: stay.id,
      check_in: stay.check_in,
      guest_id: stay.guest_id,
      property_id: stay.property_id,
    };

    // Check for minor guest
    if (guest?.date_of_birth) {
      try {
        const beforeCount = await getOpenAlertCount(supabase);
        await checkMinorGuestAlert(supabase, guest, property, stayData);
        const afterCount = await getOpenAlertCount(supabase);
        if (afterCount > beforeCount) alertsCreated++;
      } catch (e) {
        errors.push(`Minor guest check failed: ${e}`);
      }
    }

    // Check for watchlist match
    if (guest?.is_on_watchlist) {
      try {
        const beforeCount = await getOpenAlertCount(supabase);
        await checkWatchlistAlert(supabase, guest, property, stayData);
        const afterCount = await getOpenAlertCount(supabase);
        if (afterCount > beforeCount) alertsCreated++;
      } catch (e) {
        errors.push(`Watchlist check failed: ${e}`);
      }
    }

    // Check for unregistered property
    if (property) {
      try {
        const beforeCount = await getOpenAlertCount(supabase);
        await checkUnregisteredPropertyAlert(supabase, property, stayData);
        const afterCount = await getOpenAlertCount(supabase);
        if (afterCount > beforeCount) alertsCreated++;
      } catch (e) {
        errors.push(`Unregistered property check failed: ${e}`);
      }
    }

  } catch (e) {
    errors.push(`Alert trigger failed: ${e}`);
  }

  return { alertsCreated, errors };
}

async function getOpenAlertCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');
  return count || 0;
}

/**
 * Create a manual alert
 */
export async function createManualAlert(
  supabase: SupabaseClient,
  data: {
    type: string;
    severity: string;
    title: string;
    description?: string;
    guest_id?: string;
    property_id?: string;
    stay_id?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; alert?: unknown; error?: string }> {
  try {
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        ...data,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, alert };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
