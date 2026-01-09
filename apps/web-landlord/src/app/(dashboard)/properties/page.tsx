import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Property } from '@teranga/types';

const propertyTypeLabels: Record<string, string> = {
  hotel: 'Hotel',
  meuble: 'Meuble',
  guesthouse: "Maison d'hotes",
  short_term: 'Location courte duree',
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
  suspended: { label: 'Suspendu', className: 'bg-red-100 text-red-800' },
  rejected: { label: 'Rejete', className: 'bg-gray-100 text-gray-800' },
};

export default async function PropertiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: landlord } = await supabase
    .from('landlords')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('landlord_id', landlord?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes proprietes</h1>
          <p className="text-gray-600">Gerez vos hebergements</p>
        </div>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 rounded-lg bg-teranga-green px-4 py-2 font-medium text-white transition-colors hover:bg-teranga-green/90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle propriete
        </Link>
      </div>

      {/* Properties Grid */}
      {properties && properties.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property: Property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="group rounded-xl border bg-white transition-shadow hover:shadow-lg"
            >
              {/* Property Image Placeholder */}
              <div className="relative h-40 overflow-hidden rounded-t-xl bg-gray-100">
                <div className="flex h-full items-center justify-center">
                  <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="absolute right-2 top-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabels[property.status]?.className}`}>
                    {statusLabels[property.status]?.label || property.status}
                  </span>
                </div>
              </div>

              {/* Property Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-teranga-green">
                  {property.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{property.address}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {propertyTypeLabels[property.type] || property.type}
                  </span>
                  {property.license_number && (
                    <span className="text-xs font-medium text-teranga-green">
                      {property.license_number}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Aucune propriete
          </h3>
          <p className="mb-6 text-gray-500">
            Ajoutez votre premiere propriete pour commencer.
          </p>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teranga-green px-6 py-3 font-medium text-white transition-colors hover:bg-teranga-green/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une propriete
          </Link>
        </div>
      )}
    </div>
  );
}
