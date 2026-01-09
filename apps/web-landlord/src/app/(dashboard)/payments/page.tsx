import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Paye', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'En retard', className: 'bg-red-100 text-red-800' },
};

const paymentStatusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'En cours', className: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Complete', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Echoue', className: 'bg-red-100 text-red-800' },
};

export default async function PaymentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: landlord } = await supabase
    .from('landlords')
    .select('id')
    .eq('user_id', user?.id)
    .single();

  // Get all tax liabilities for this landlord
  const { data: liabilities } = await supabase
    .from('tax_liabilities')
    .select('*, properties(name), stays(check_in, check_out, guests(first_name, last_name))')
    .eq('landlord_id', landlord?.id)
    .order('created_at', { ascending: false });

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('*, tax_liabilities(amount, properties(name))')
    .eq('landlord_id', landlord?.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Calculate totals
  const pendingLiabilities = (liabilities || []).filter(l => l.status === 'pending' || l.status === 'overdue');
  const totalPending = pendingLiabilities.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalPaid = (liabilities || []).filter(l => l.status === 'paid').reduce((sum, l) => sum + (l.amount || 0), 0);
  const overdueCount = pendingLiabilities.filter(l => l.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiements TPT</h1>
          <p className="text-gray-600">Gerez vos taxes de promotion touristique</p>
        </div>
        {totalPending > 0 && (
          <Link
            href="/payments/pay"
            className="flex items-center gap-2 rounded-lg bg-teranga-green px-4 py-2 font-medium text-white transition-colors hover:bg-teranga-green/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Payer maintenant
          </Link>
        )}
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Pending Balance */}
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Solde a payer</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="mt-4 rounded-lg bg-red-50 p-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">{overdueCount}</span> paiement(s) en retard
              </p>
            </div>
          )}
        </div>

        {/* Total Paid */}
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total paye</p>
              <p className="text-2xl font-bold text-gray-900">{totalPaid.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>
        </div>

        {/* Total Declarations */}
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total declarations</p>
              <p className="text-2xl font-bold text-gray-900">{(liabilities || []).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Liabilities */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Taxes en attente ({pendingLiabilities.length})
          </h2>
        </div>
        {pendingLiabilities.length > 0 ? (
          <div className="divide-y">
            {pendingLiabilities.map((liability) => (
              <div key={liability.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teranga-green/10">
                    <svg className="h-5 w-5 text-teranga-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {liability.properties?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {liability.stays?.guests?.first_name} {liability.stays?.guests?.last_name} - {liability.guest_nights} nuit(s)-personne
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {(liability.amount || 0).toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className="text-xs text-gray-500">
                      Echeance: {liability.due_date ? new Date(liability.due_date).toLocaleDateString('fr-FR') : 'N/A'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabels[liability.status]?.className || 'bg-gray-100 text-gray-800'}`}>
                    {statusLabels[liability.status]?.label || liability.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-gray-500">Aucune taxe en attente</p>
            <p className="text-sm text-gray-400">Toutes vos taxes sont a jour!</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Historique des paiements
          </h2>
        </div>
        {(payments || []).length > 0 ? (
          <div className="divide-y">
            {(payments || []).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    payment.status === 'completed' ? 'bg-green-100' :
                    payment.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <svg className={`h-5 w-5 ${
                      payment.status === 'completed' ? 'text-green-600' :
                      payment.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Paiement {payment.provider === 'wave' ? 'Wave' : payment.provider === 'orange_money' ? 'Orange Money' : payment.provider}
                    </p>
                    <p className="text-sm text-gray-500">
                      {payment.tax_liabilities?.properties?.name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {(payment.amount || 0).toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(payment.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStatusLabels[payment.status]?.className || 'bg-gray-100 text-gray-800'}`}>
                    {paymentStatusLabels[payment.status]?.label || payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Aucun paiement effectue
          </div>
        )}
      </div>
    </div>
  );
}
