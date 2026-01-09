import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'En cours', className: 'bg-green-100 text-green-800' },
  completed: { label: 'Termine', className: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Annule', className: 'bg-red-100 text-red-800' },
};

export default async function GuestsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: landlord } = await supabase
    .from('landlords')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  // Get properties for this landlord
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('landlord_id', landlord?.id);

  const propertyIds = (properties || []).map(p => p.id);
  const propertyMap = Object.fromEntries((properties || []).map(p => [p.id, p.name]));

  // Get stays with guest info
  const { data: stays } = await supabase
    .from('stays')
    .select('*, guests(first_name, last_name, nationality, document_type)')
    .in('property_id', propertyIds.length > 0 ? propertyIds : ['none'])
    .order('check_in', { ascending: false })
    .limit(50);

  const activeStays = (stays || []).filter(s => s.status === 'active');
  const pastStays = (stays || []).filter(s => s.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locataires</h1>
          <p className="text-gray-600">Gerez vos locataires et declarations</p>
        </div>
        <Link
          href="/guests/checkin"
          className="flex items-center gap-2 rounded-lg bg-teranga-green px-4 py-2 font-medium text-white transition-colors hover:bg-teranga-green/90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Nouveau locataire
        </Link>
      </div>

      {/* Active Stays */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Locataires actifs ({activeStays.length})
          </h2>
        </div>
        {activeStays.length > 0 ? (
          <div className="divide-y">
            {activeStays.map((stay) => (
              <div key={stay.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teranga-green/10">
                    <span className="text-sm font-medium text-teranga-green">
                      {stay.guests?.first_name?.[0]}{stay.guests?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {stay.guests?.first_name} {stay.guests?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {propertyMap[stay.property_id]} - {stay.guests?.nationality || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {stay.nights || '?'} nuit(s)
                    </p>
                    <p className="text-xs text-gray-500">
                      Depuis le {new Date(stay.check_in).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Link
                    href={`/guests/checkout?stay=${stay.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Check-out
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2 text-gray-500">Aucun locataire actif</p>
            <Link
              href="/guests/checkin"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teranga-green hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Enregistrer un locataire
            </Link>
          </div>
        )}
      </div>

      {/* Past Stays */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Historique ({pastStays.length})
          </h2>
        </div>
        {pastStays.length > 0 ? (
          <div className="divide-y">
            {pastStays.slice(0, 10).map((stay) => (
              <div key={stay.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-sm font-medium text-gray-500">
                      {stay.guests?.first_name?.[0]}{stay.guests?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {stay.guests?.first_name} {stay.guests?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {propertyMap[stay.property_id]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {stay.nights || '?'} nuit(s)
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(stay.check_in).toLocaleDateString('fr-FR')} - {stay.check_out ? new Date(stay.check_out).toLocaleDateString('fr-FR') : 'N/A'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabels[stay.status]?.className || 'bg-gray-100 text-gray-800'}`}>
                    {statusLabels[stay.status]?.label || stay.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Aucun historique
          </div>
        )}
      </div>
    </div>
  );
}
