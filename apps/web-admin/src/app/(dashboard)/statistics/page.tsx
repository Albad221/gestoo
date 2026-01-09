import { createClient } from '@/lib/supabase/server';

export default async function StatisticsPage() {
  const supabase = await createClient();

  // Get date ranges
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const thisYear = new Date(today.getFullYear(), 0, 1);

  // Fetch all statistics in parallel
  const [
    { count: totalProperties },
    { count: activeProperties },
    { count: pendingProperties },
    { count: totalGuests },
    { count: thisMonthGuests },
    { count: totalStays },
    { count: activeStays },
    { data: staysByRegion },
    { data: guestsByNationality },
    { data: revenueData },
    { data: monthlyStays },
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('guests').select('*', { count: 'exact', head: true }),
    supabase.from('guests').select('*', { count: 'exact', head: true }).gte('created_at', thisMonth.toISOString()),
    supabase.from('stays').select('*', { count: 'exact', head: true }),
    supabase.from('stays').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('properties').select('region'),
    supabase.from('guests').select('nationality'),
    supabase.from('payments').select('amount, created_at').eq('status', 'completed'),
    supabase.from('stays').select('check_in, nights, num_guests').gte('check_in', thisYear.toISOString()),
  ]);

  // Process region data
  const regionCounts: Record<string, number> = {};
  (staysByRegion || []).forEach((p: any) => {
    regionCounts[p.region] = (regionCounts[p.region] || 0) + 1;
  });
  const topRegions = Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Process nationality data
  const nationalityCounts: Record<string, number> = {};
  (guestsByNationality || []).forEach((g: any) => {
    nationalityCounts[g.nationality] = (nationalityCounts[g.nationality] || 0) + 1;
  });
  const topNationalities = Object.entries(nationalityCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  // Calculate total revenue
  const totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const thisMonthRevenue = (revenueData || [])
    .filter((p: any) => new Date(p.created_at) >= thisMonth)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate total guest nights
  const totalGuestNights = (monthlyStays || []).reduce(
    (sum, s) => sum + ((s.nights || 1) * (s.num_guests || 1)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-gray-600">Analyse du secteur hebergement touristique</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exporter rapport
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Proprietes</p>
              <p className="text-3xl font-bold text-gray-900">{totalProperties || 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-green-600">{activeProperties || 0} actives</span>
            <span className="text-yellow-600">{pendingProperties || 0} en attente</span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Voyageurs enregistres</p>
              <p className="text-3xl font-bold text-gray-900">{totalGuests || 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-blue-600">+{thisMonthGuests || 0} ce mois</span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Nuits-voyageurs</p>
              <p className="text-3xl font-bold text-gray-900">{totalGuestNights.toLocaleString('fr-FR')}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-gray-500">{activeStays || 0} sejours en cours</span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Recettes TPT</p>
              <p className="text-3xl font-bold text-gray-900">{(totalRevenue / 1000000).toFixed(1)}M</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm">
            <span className="text-green-600">+{(thisMonthRevenue / 1000).toFixed(0)}K ce mois</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Regions */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Proprietes par region</h2>
          <div className="space-y-4">
            {topRegions.length > 0 ? (
              topRegions.map(([region, count], index) => {
                const percentage = Math.round((count / (totalProperties || 1)) * 100);
                return (
                  <div key={region}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{region}</span>
                      <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">Aucune donnee disponible</p>
            )}
          </div>
        </div>

        {/* Top Nationalities */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Voyageurs par nationalite</h2>
          <div className="space-y-3">
            {topNationalities.length > 0 ? (
              topNationalities.map(([nationality, count], index) => {
                const percentage = Math.round((count / (totalGuests || 1)) * 100);
                const colors = [
                  'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
                  'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-gray-500'
                ];
                return (
                  <div key={nationality} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${colors[index]}`} />
                    <span className="flex-1 text-sm text-gray-700">{nationality}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                    <span className="text-xs text-gray-500 w-12 text-right">{percentage}%</span>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">Aucune donnee disponible</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Stats Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Occupancy Trends */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Indicateurs cles</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-gray-600">Taux d'occupation moyen</span>
              <span className="text-lg font-semibold text-gray-900">
                {activeStays && totalProperties ? Math.round((activeStays / totalProperties) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-gray-600">Duree moyenne de sejour</span>
              <span className="text-lg font-semibold text-gray-900">
                {totalStays && totalGuestNights ? (totalGuestNights / totalStays).toFixed(1) : 0} nuits
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-gray-600">TPT moyen par sejour</span>
              <span className="text-lg font-semibold text-gray-900">
                {totalStays && totalRevenue ? Math.round(totalRevenue / totalStays).toLocaleString('fr-FR') : 0} FCFA
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">Proprietes en conformite</span>
              <span className="text-lg font-semibold text-green-600">
                {activeProperties && totalProperties ? Math.round((activeProperties / totalProperties) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Rapports disponibles</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Rapport mensuel complet</p>
                <p className="text-xs text-gray-500">Statistiques detaillees du mois</p>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Rapport recettes TPT</p>
                <p className="text-xs text-gray-500">Analyse des revenus fiscaux</p>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Rapport par nationalite</p>
                <p className="text-xs text-gray-500">Analyse des flux touristiques</p>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Rapport conformite</p>
                <p className="text-xs text-gray-500">Etat des licences et declarations</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
