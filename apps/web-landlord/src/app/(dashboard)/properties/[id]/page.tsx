import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const propertyTypeLabels: Record<string, string> = {
  hotel: 'Hotel',
  meuble: 'Meuble',
  guesthouse: "Maison d'hotes",
  short_term: 'Location courte duree',
};

const statusConfig: Record<string, { label: string; className: string; description: string }> = {
  active: {
    label: 'Actif',
    className: 'bg-green-100 text-green-800',
    description: 'Votre propriete est active et peut accueillir des locataires.',
  },
  pending: {
    label: 'En attente',
    className: 'bg-yellow-100 text-yellow-800',
    description: 'Votre demande est en cours de verification par le Ministere.',
  },
  suspended: {
    label: 'Suspendu',
    className: 'bg-red-100 text-red-800',
    description: 'Votre propriete a ete suspendue. Contactez le support.',
  },
  rejected: {
    label: 'Rejete',
    className: 'bg-gray-100 text-gray-800',
    description: 'Votre demande a ete rejetee.',
  },
};

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select('*, landlords(full_name)')
    .eq('id', params.id)
    .single();

  if (error || !property) {
    notFound();
  }

  // Get active stays count
  const { count: activeStaysCount } = await supabase
    .from('stays')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', property.id)
    .eq('status', 'active');

  // Get total guests count
  const { count: totalGuestsCount } = await supabase
    .from('stays')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', property.id);

  const status = statusConfig[property.status] || statusConfig.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/properties"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour aux proprietes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
          <p className="text-gray-600">{property.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modifier
          </Link>
          <Link
            href={`/guests/checkin?property=${property.id}`}
            className="flex items-center gap-2 rounded-lg bg-teranga-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teranga-green/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Nouveau locataire
          </Link>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 ${property.status === 'active' ? 'bg-green-50' : property.status === 'pending' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>
            {status.label}
          </span>
          <p className="text-sm text-gray-600">{status.description}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Details Card */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {propertyTypeLabels[property.type] || property.type}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Licence</dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {property.license_number || (
                    <span className="text-gray-400">En attente</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Ville</dt>
                <dd className="mt-1 font-medium text-gray-900">{property.city}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Region</dt>
                <dd className="mt-1 font-medium text-gray-900">{property.region}</dd>
              </div>
              {property.capacity_rooms && (
                <div>
                  <dt className="text-sm text-gray-500">Chambres</dt>
                  <dd className="mt-1 font-medium text-gray-900">{property.capacity_rooms}</dd>
                </div>
              )}
              {property.capacity_beds && (
                <div>
                  <dt className="text-sm text-gray-500">Lits</dt>
                  <dd className="mt-1 font-medium text-gray-900">{property.capacity_beds}</dd>
                </div>
              )}
              {property.capacity_guests && (
                <div>
                  <dt className="text-sm text-gray-500">Capacite max</dt>
                  <dd className="mt-1 font-medium text-gray-900">{property.capacity_guests} personnes</dd>
                </div>
              )}
              {property.gps_lat && property.gps_lng && (
                <div>
                  <dt className="text-sm text-gray-500">Coordonnees GPS</dt>
                  <dd className="mt-1 font-medium text-gray-900">
                    {property.gps_lat.toFixed(6)}, {property.gps_lng.toFixed(6)}
                  </dd>
                </div>
              )}
            </dl>

            {property.description && (
              <div className="mt-6 border-t pt-4">
                <dt className="text-sm text-gray-500">Description</dt>
                <dd className="mt-1 text-gray-700">{property.description}</dd>
              </div>
            )}
          </div>

          {/* Photos Placeholder */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Photos</h2>
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">Aucune photo ajoutee</p>
              <button className="mt-4 text-sm font-medium text-teranga-green hover:underline">
                Ajouter des photos
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Statistiques</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Locataires actifs</span>
                <span className="text-xl font-bold text-gray-900">{activeStaysCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total locataires</span>
                <span className="text-xl font-bold text-gray-900">{totalGuestsCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Score conformite</span>
                <span className="text-xl font-bold text-teranga-green">{property.compliance_score || 0}%</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions</h2>
            <div className="space-y-2">
              <Link
                href={`/guests/checkin?property=${property.id}`}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Enregistrer un locataire
              </Link>
              <Link
                href={`/guests?property=${property.id}`}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Voir les locataires
              </Link>
              <Link
                href={`/payments?property=${property.id}`}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Voir les paiements
              </Link>
            </div>
          </div>

          {/* Created Info */}
          <div className="text-center text-xs text-gray-400">
            Cree le {new Date(property.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
