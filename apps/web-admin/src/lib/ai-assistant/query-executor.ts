import { createClient } from '@supabase/supabase-js';
import {
  CountPropertiesParams,
  CountScrapedListingsParams,
  GetPropertyDetailsParams,
  GetGuestCountParams,
  GetTaxLiabilityParams,
  GetRevenueStatsParams,
  GetOccupancyRateParams,
  GetNonDeclarersParams,
  GetAlertsSummaryParams,
  SearchPropertiesParams,
  QueryResult,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function executeQuery(
  functionName: string,
  params: Record<string, unknown>
): Promise<QueryResult> {
  switch (functionName) {
    case 'count_properties':
      return countProperties(params as CountPropertiesParams);
    case 'count_scraped_listings':
      return countScrapedListings(params as CountScrapedListingsParams);
    case 'get_property_details':
      return getPropertyDetails(params as GetPropertyDetailsParams);
    case 'get_guest_count':
      return getGuestCount(params as GetGuestCountParams);
    case 'get_tax_liability':
      return getTaxLiability(params as GetTaxLiabilityParams);
    case 'get_revenue_stats':
      return getRevenueStats(params as GetRevenueStatsParams);
    case 'get_occupancy_rate':
      return getOccupancyRate(params as GetOccupancyRateParams);
    case 'get_non_declarers':
      return getNonDeclarers(params as GetNonDeclarersParams);
    case 'get_alerts_summary':
      return getAlertsSummary(params as GetAlertsSummaryParams);
    case 'search_properties':
      return searchProperties(params as SearchPropertiesParams);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

async function countProperties(params: CountPropertiesParams): Promise<QueryResult> {
  const supabase = getSupabase();
  let query = supabase.from('properties').select('*', { count: 'exact', head: true });

  if (params.type) {
    query = query.eq('type', params.type);
  }
  if (params.city) {
    query = query.ilike('city', `%${params.city}%`);
  }
  if (params.region) {
    query = query.ilike('region', `%${params.region}%`);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { count, error } = await query;

  if (error) throw error;

  const filters = [];
  if (params.type) filters.push(`type: ${params.type}`);
  if (params.city) filters.push(`ville: ${params.city}`);
  if (params.region) filters.push(`région: ${params.region}`);
  if (params.status) filters.push(`statut: ${params.status}`);

  return {
    type: 'count',
    title: `Propriétés${filters.length > 0 ? ` (${filters.join(', ')})` : ''}`,
    value: count || 0,
  };
}

async function countScrapedListings(params: CountScrapedListingsParams): Promise<QueryResult> {
  const supabase = getSupabase();
  let query = supabase.from('scraped_listings').select('*', { count: 'exact', head: true });

  if (params.platform) {
    query = query.eq('platform', params.platform.toLowerCase());
  }
  if (params.city) {
    query = query.ilike('city', `%${params.city}%`);
  }
  if (params.is_compliant !== undefined) {
    query = query.eq('is_compliant', params.is_compliant);
  }

  const { count, error } = await query;

  if (error) throw error;

  const filters = [];
  if (params.platform) filters.push(`plateforme: ${params.platform}`);
  if (params.city) filters.push(`ville: ${params.city}`);
  if (params.is_compliant !== undefined) {
    filters.push(params.is_compliant ? 'conformes' : 'non conformes');
  }

  return {
    type: 'count',
    title: `Annonces détectées${filters.length > 0 ? ` (${filters.join(', ')})` : ''}`,
    value: count || 0,
  };
}

async function getPropertyDetails(params: GetPropertyDetailsParams): Promise<QueryResult> {
  const supabase = getSupabase();
  let query = supabase.from('properties').select('*');

  if (params.id) {
    query = query.eq('id', params.id);
  } else if (params.name) {
    query = query.ilike('name', `%${params.name}%`);
  } else {
    throw new Error('Veuillez fournir un nom ou ID de propriété');
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        type: 'details',
        title: 'Propriété non trouvée',
        items: [],
      };
    }
    throw error;
  }

  return {
    type: 'details',
    title: `Détails: ${data.name}`,
    items: [data],
    columns: ['name', 'type', 'city', 'region', 'address', 'num_rooms', 'status', 'registration_number'],
  };
}

async function getGuestCount(params: GetGuestCountParams): Promise<QueryResult> {
  const supabase = getSupabase();

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;

  switch (params.period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  let query = supabase.from('stays').select('num_guests, property_id');

  query = query.gte('check_in', startDate.toISOString());

  // If property_name provided, first get the property ID
  if (params.property_name) {
    const { data: property } = await supabase
      .from('properties')
      .select('id')
      .ilike('name', `%${params.property_name}%`)
      .limit(1)
      .single();

    if (property) {
      query = query.eq('property_id', property.id);
    }
  } else if (params.property_id) {
    query = query.eq('property_id', params.property_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  const totalGuests = data?.reduce((sum, stay) => sum + (stay.num_guests || 1), 0) || 0;

  const periodLabels: Record<string, string> = {
    today: "aujourd'hui",
    week: 'cette semaine',
    month: 'ce mois',
    year: 'cette année',
  };

  return {
    type: 'count',
    title: `Clients ${periodLabels[params.period || 'today']}${params.property_name ? ` - ${params.property_name}` : ''}`,
    value: totalGuests,
  };
}

async function getTaxLiability(params: GetTaxLiabilityParams): Promise<QueryResult> {
  const supabase = getSupabase();

  // Get property ID if name provided
  let propertyId = params.property_id;
  let propertyName = '';

  if (params.property_name) {
    const { data: property } = await supabase
      .from('properties')
      .select('id, name')
      .ilike('name', `%${params.property_name}%`)
      .limit(1)
      .single();

    if (property) {
      propertyId = property.id;
      propertyName = property.name;
    } else {
      return {
        type: 'stats',
        title: 'Propriété non trouvée',
        value: 0,
      };
    }
  }

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (params.period) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get tax from payments
  let query = supabase
    .from('payments')
    .select('tax_amount, status')
    .gte('created_at', startDate.toISOString());

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const totalTax = data?.reduce((sum, payment) => sum + (payment.tax_amount || 0), 0) || 0;
  const paidTax = data?.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.tax_amount || 0), 0) || 0;

  const periodLabels: Record<string, string> = {
    month: 'ce mois',
    quarter: 'ce trimestre',
    year: 'cette année',
  };

  return {
    type: 'stats',
    title: `Taxes ${periodLabels[params.period || 'month']}${propertyName ? ` - ${propertyName}` : ''}`,
    value: `${totalTax.toLocaleString('fr-FR')} XOF (payé: ${paidTax.toLocaleString('fr-FR')} XOF)`,
  };
}

async function getRevenueStats(params: GetRevenueStatsParams): Promise<QueryResult> {
  const supabase = getSupabase();

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (params.period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // First get property IDs for the city/region filter
  let propertyIds: string[] = [];

  if (params.city || params.region) {
    let propertyQuery = supabase.from('properties').select('id');

    if (params.city) {
      propertyQuery = propertyQuery.ilike('city', `%${params.city}%`);
    }
    if (params.region) {
      propertyQuery = propertyQuery.ilike('region', `%${params.region}%`);
    }

    const { data: properties } = await propertyQuery;
    propertyIds = properties?.map(p => p.id) || [];

    if (propertyIds.length === 0) {
      return {
        type: 'stats',
        title: 'Aucune propriété trouvée dans cette zone',
        value: '0 XOF',
      };
    }
  }

  let query = supabase
    .from('payments')
    .select('amount, tax_amount, status')
    .eq('status', 'completed')
    .gte('paid_at', startDate.toISOString());

  if (propertyIds.length > 0) {
    query = query.in('property_id', propertyIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const totalRevenue = data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const totalTax = data?.reduce((sum, p) => sum + (p.tax_amount || 0), 0) || 0;

  const periodLabels: Record<string, string> = {
    today: "aujourd'hui",
    week: 'cette semaine',
    month: 'ce mois',
    year: 'cette année',
  };

  const location = params.city || params.region || 'Sénégal';

  return {
    type: 'stats',
    title: `Revenus ${periodLabels[params.period || 'month']} - ${location}`,
    value: `${totalRevenue.toLocaleString('fr-FR')} XOF (taxes: ${totalTax.toLocaleString('fr-FR')} XOF)`,
  };
}

async function getOccupancyRate(params: GetOccupancyRateParams): Promise<QueryResult> {
  const supabase = getSupabase();

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let days: number;

  switch (params.period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      days = 7;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      days = now.getDate();
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      days = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      days = 30;
  }

  // Get properties
  let propertyQuery = supabase.from('properties').select('id, num_rooms');

  if (params.city) {
    propertyQuery = propertyQuery.ilike('city', `%${params.city}%`);
  }
  if (params.property_id) {
    propertyQuery = propertyQuery.eq('id', params.property_id);
  }

  const { data: properties, error: propError } = await propertyQuery;

  if (propError) throw propError;

  if (!properties || properties.length === 0) {
    return {
      type: 'stats',
      title: 'Aucune propriété trouvée',
      value: '0%',
    };
  }

  const totalRooms = properties.reduce((sum, p) => sum + (p.num_rooms || 1), 0);
  const totalCapacity = totalRooms * days;

  // Get stays in period
  const propertyIds = properties.map(p => p.id);

  const { data: stays, error: stayError } = await supabase
    .from('stays')
    .select('check_in, check_out')
    .in('property_id', propertyIds)
    .gte('check_out', startDate.toISOString())
    .lte('check_in', now.toISOString());

  if (stayError) throw stayError;

  // Calculate occupied room-nights (simplified)
  let occupiedNights = 0;
  stays?.forEach(stay => {
    const checkIn = new Date(stay.check_in);
    const checkOut = new Date(stay.check_out);
    const stayStart = checkIn < startDate ? startDate : checkIn;
    const stayEnd = checkOut > now ? now : checkOut;
    const nights = Math.max(0, Math.floor((stayEnd.getTime() - stayStart.getTime()) / (24 * 60 * 60 * 1000)));
    occupiedNights += nights;
  });

  const occupancyRate = totalCapacity > 0 ? ((occupiedNights / totalCapacity) * 100).toFixed(1) : 0;

  const periodLabels: Record<string, string> = {
    week: 'cette semaine',
    month: 'ce mois',
    year: 'cette année',
  };

  return {
    type: 'stats',
    title: `Taux d'occupation ${periodLabels[params.period || 'month']}${params.city ? ` - ${params.city}` : ''}`,
    value: `${occupancyRate}%`,
  };
}

async function getNonDeclarers(params: GetNonDeclarersParams): Promise<QueryResult> {
  const supabase = getSupabase();

  const daysSince = params.days_since_declaration || 30;
  const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);

  // Get properties with recent payments
  let propertyQuery = supabase.from('properties').select('id, name, city, type');

  if (params.city) {
    propertyQuery = propertyQuery.ilike('city', `%${params.city}%`);
  }
  propertyQuery = propertyQuery.eq('status', 'active');

  const { data: properties, error: propError } = await propertyQuery;

  if (propError) throw propError;

  if (!properties || properties.length === 0) {
    return {
      type: 'list',
      title: 'Aucune propriété trouvée',
      items: [],
    };
  }

  // Get recent payments
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('property_id')
    .gte('created_at', cutoffDate.toISOString());

  const propertiesWithPayments = new Set(recentPayments?.map(p => p.property_id) || []);

  // Filter properties without recent payments
  const nonDeclarers = properties.filter(p => !propertiesWithPayments.has(p.id));

  return {
    type: 'table',
    title: `Établissements sans déclaration depuis ${daysSince} jours${params.city ? ` - ${params.city}` : ''}`,
    items: nonDeclarers.slice(0, 20),
    columns: ['name', 'type', 'city'],
    value: nonDeclarers.length,
  };
}

async function getAlertsSummary(params: GetAlertsSummaryParams): Promise<QueryResult> {
  const supabase = getSupabase();

  let query = supabase.from('alerts').select('*');

  if (params.severity) {
    query = query.eq('severity', params.severity);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  } else {
    // By default, show non-resolved alerts
    query = query.neq('status', 'resolved');
  }

  query = query.order('created_at', { ascending: false }).limit(20);

  const { data, error } = await query;

  if (error) throw error;

  const alerts = data || [];

  // Group by severity
  const bySeverity = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  };

  const filters = [];
  if (params.severity) filters.push(`sévérité: ${params.severity}`);
  if (params.status) filters.push(`statut: ${params.status}`);

  return {
    type: 'table',
    title: `Alertes${filters.length > 0 ? ` (${filters.join(', ')})` : ''}`,
    items: alerts.map(a => ({
      title: a.title,
      severity: a.severity,
      status: a.status,
      type: a.type,
      created_at: a.created_at,
    })),
    columns: ['title', 'severity', 'status', 'type'],
    value: `${alerts.length} alertes (${bySeverity.critical} critiques, ${bySeverity.high} hautes)`,
  };
}

async function searchProperties(params: SearchPropertiesParams): Promise<QueryResult> {
  const supabase = getSupabase();

  if (!params.query) {
    throw new Error('Veuillez fournir un terme de recherche');
  }

  let query = supabase.from('properties').select('*');

  // Search in name or address
  query = query.or(`name.ilike.%${params.query}%,address.ilike.%${params.query}%`);

  if (params.city) {
    query = query.ilike('city', `%${params.city}%`);
  }
  if (params.type) {
    query = query.eq('type', params.type);
  }

  query = query.limit(20);

  const { data, error } = await query;

  if (error) throw error;

  return {
    type: 'table',
    title: `Résultats pour "${params.query}"${params.city ? ` à ${params.city}` : ''}`,
    items: data || [],
    columns: ['name', 'type', 'city', 'address', 'num_rooms', 'status'],
    value: data?.length || 0,
  };
}
