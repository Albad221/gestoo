import { createClient } from '@/lib/supabase/server';

export default async function RevenuePage() {
  const supabase = await createClient();

  // Get date ranges
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Fetch all revenue data
  const [
    { data: allPayments },
    { data: allLiabilities },
    { data: topLandlords },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from('payments').select('amount, created_at, status, provider'),
    supabase.from('tax_liabilities').select('amount, status, created_at, properties(name, city, region)'),
    supabase.from('payments')
      .select('amount, landlord_id, landlords(full_name)')
      .eq('status', 'completed')
      .order('amount', { ascending: false })
      .limit(10),
    supabase.from('payments')
      .select('*, landlords(full_name), properties(name)')
      .eq('status', 'completed')
      .order('paid_at', { ascending: false })
      .limit(20),
  ]);

  // Calculate totals
  const completedPayments = (allPayments || []).filter(p => p.status === 'completed');
  const totalCollected = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const thisMonthPayments = completedPayments.filter(p => new Date(p.created_at) >= thisMonth);
  const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const lastMonthPayments = completedPayments.filter(p => {
    const date = new Date(p.created_at);
    return date >= lastMonth && date <= endLastMonth;
  });
  const lastMonthTotal = lastMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate pending
  const pendingLiabilities = (allLiabilities || []).filter(l => l.status === 'pending' || l.status === 'overdue');
  const totalPending = pendingLiabilities.reduce((sum, l) => sum + (l.amount || 0), 0);
  const overdueCount = pendingLiabilities.filter(l => l.status === 'overdue').length;

  // Payment provider breakdown
  const providerTotals: Record<string, number> = {};
  completedPayments.forEach(p => {
    providerTotals[p.provider || 'other'] = (providerTotals[p.provider || 'other'] || 0) + (p.amount || 0);
  });

  // Revenue by region
  const regionTotals: Record<string, number> = {};
  (allLiabilities || []).filter(l => l.status === 'paid').forEach((l: any) => {
    const region = l.properties?.region || 'Autre';
    regionTotals[region] = (regionTotals[region] || 0) + (l.amount || 0);
  });
  const topRegions = Object.entries(regionTotals).sort(([, a], [, b]) => b - a).slice(0, 5);

  // Month over month change
  const monthChange = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recettes TPT</h1>
          <p className="text-gray-600">Suivi des taxes de promotion touristique</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exporter
        </button>
      </div>

      {/* Revenue Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total collecte</p>
              <p className="text-3xl font-bold text-gray-900">
                {(totalCollected / 1000000).toFixed(2)}M
              </p>
              <p className="text-xs text-gray-400">FCFA</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ce mois</p>
              <p className="text-3xl font-bold text-gray-900">
                {(thisMonthTotal / 1000).toFixed(0)}K
              </p>
              <p className={`text-xs ${Number(monthChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(monthChange) >= 0 ? '+' : ''}{monthChange}% vs mois dernier
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-3xl font-bold text-yellow-600">
                {(totalPending / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-gray-400">FCFA a collecter</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En retard</p>
              <p className="text-3xl font-bold text-red-600">{overdueCount}</p>
              <p className="text-xs text-gray-400">paiements</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Providers */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Moyens de paiement</h2>
          <div className="space-y-4">
            {Object.entries(providerTotals).map(([provider, amount]) => {
              const percentage = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
              const config: Record<string, { label: string; color: string; bg: string }> = {
                wave: { label: 'Wave', color: 'bg-blue-500', bg: 'bg-blue-100' },
                orange_money: { label: 'Orange Money', color: 'bg-orange-500', bg: 'bg-orange-100' },
                other: { label: 'Autre', color: 'bg-gray-500', bg: 'bg-gray-100' },
              };
              const providerConfig = config[provider] || config.other;

              return (
                <div key={provider}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg ${providerConfig.bg} flex items-center justify-center`}>
                        <span className="text-xs font-bold">{providerConfig.label[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{providerConfig.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{amount.toLocaleString('fr-FR')} FCFA</p>
                      <p className="text-xs text-gray-500">{percentage}%</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full ${providerConfig.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Region */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recettes par region</h2>
          <div className="space-y-4">
            {topRegions.length > 0 ? topRegions.map(([region, amount], index) => {
              const percentage = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500'];

              return (
                <div key={region}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{region}</span>
                    <span className="text-sm text-gray-600">{amount.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full ${colors[index]}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-gray-500 py-4">Aucune donnee disponible</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">Paiements recents</h2>
        </div>
        {(recentPayments || []).length > 0 ? (
          <div className="divide-y">
            {(recentPayments || []).map((payment: any) => (
              <div key={payment.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    payment.provider === 'wave' ? 'bg-blue-100' : 'bg-orange-100'
                  }`}>
                    <span className={`text-sm font-bold ${
                      payment.provider === 'wave' ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {payment.provider === 'wave' ? 'W' : 'OM'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{payment.landlords?.full_name}</p>
                    <p className="text-sm text-gray-500">{payment.properties?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">+{payment.amount?.toLocaleString('fr-FR')} FCFA</p>
                  <p className="text-xs text-gray-400">
                    {new Date(payment.paid_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-gray-500">
            Aucun paiement recent
          </div>
        )}
      </div>

      {/* Top Contributors */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Top contributeurs</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Rang</th>
                <th className="pb-3 font-medium">Proprietaire</th>
                <th className="pb-3 font-medium text-right">Montant total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(topLandlords || []).slice(0, 5).map((item: any, index) => (
                <tr key={index}>
                  <td className="py-3">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-gray-900">{item.landlords?.full_name || 'N/A'}</td>
                  <td className="py-3 text-right font-semibold text-gray-900">
                    {item.amount?.toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
