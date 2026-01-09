import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get landlord with properties count
  const { data: landlord } = await supabase
    .from('landlords')
    .select('*')
    .eq('user_id', user?.id)
    .single();

  // Get properties
  const { data: properties, count: propertiesCount } = await supabase
    .from('properties')
    .select('*', { count: 'exact' })
    .eq('landlord_id', landlord?.id);

  // Get active stays
  const { count: activeStaysCount } = await supabase
    .from('stays')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .in(
      'property_id',
      (properties || []).map((p) => p.id)
    );

  // Get pending tax
  const { data: taxLiabilities } = await supabase
    .from('tax_liabilities')
    .select('amount, paid_amount')
    .eq('landlord_id', landlord?.id)
    .eq('status', 'pending');

  const pendingTax = (taxLiabilities || []).reduce(
    (sum, t) => sum + (t.amount - t.paid_amount),
    0
  );

  const stats = [
    {
      name: 'Propriétés',
      value: propertiesCount || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      href: '/properties',
      color: 'bg-blue-500',
    },
    {
      name: 'Locataires actifs',
      value: activeStaysCount || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      href: '/guests',
      color: 'bg-green-500',
    },
    {
      name: 'TPT à payer',
      value: `${pendingTax.toLocaleString()} F`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      href: '/payments',
      color: pendingTax > 0 ? 'bg-orange-500' : 'bg-gray-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenue, {landlord?.full_name?.split(' ')[0]} !
        </h1>
        <p className="text-gray-600">
          Voici un aperçu de votre activité sur Teranga Safe.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="flex items-center gap-4 rounded-xl border bg-white p-6 transition-shadow hover:shadow-md"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color} text-white`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.name}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions rapides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/properties/new"
            className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 transition-colors hover:border-teranga-green hover:bg-teranga-green/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teranga-green/10">
              <svg className="h-5 w-5 text-teranga-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Nouvelle propriété</p>
              <p className="text-xs text-gray-500">Ajouter un hébergement</p>
            </div>
          </Link>

          <Link
            href="/guests/checkin"
            className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 transition-colors hover:border-teranga-green hover:bg-teranga-green/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Nouveau locataire</p>
              <p className="text-xs text-gray-500">Enregistrer une arrivée</p>
            </div>
          </Link>

          <Link
            href="/payments"
            className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 transition-colors hover:border-teranga-green hover:bg-teranga-green/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Payer TPT</p>
              <p className="text-xs text-gray-500">Régler la taxe</p>
            </div>
          </Link>

          <Link
            href="/help"
            className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 transition-colors hover:border-teranga-green hover:bg-teranga-green/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Aide</p>
              <p className="text-xs text-gray-500">Centre d&apos;assistance</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Properties */}
      {properties && properties.length > 0 ? (
        <div className="rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Mes propriétés</h2>
            <Link
              href="/properties"
              className="text-sm font-medium text-teranga-green hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {properties.slice(0, 3).map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{property.name}</p>
                    <p className="text-sm text-gray-500">{property.address}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    property.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : property.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {property.status === 'active'
                    ? 'Actif'
                    : property.status === 'pending'
                    ? 'En attente'
                    : property.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Aucune propriété enregistrée
          </h3>
          <p className="mb-6 text-gray-500">
            Commencez par ajouter votre première propriété pour gérer vos locataires et payer la TPT.
          </p>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teranga-green px-6 py-3 font-medium text-white transition-colors hover:bg-teranga-green/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter ma première propriété
          </Link>
        </div>
      )}
    </div>
  );
}
