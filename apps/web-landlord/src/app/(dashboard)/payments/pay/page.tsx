'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface TaxLiability {
  id: string;
  amount: number;
  status: string;
  guest_nights: number;
  due_date: string;
  properties: {
    name: string;
  };
  stays: {
    guests: {
      first_name: string;
      last_name: string;
    };
  };
}

type PaymentProvider = 'wave' | 'orange_money';

export default function PayPage() {
  const router = useRouter();
  const [liabilities, setLiabilities] = useState<TaxLiability[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'provider' | 'confirm'>('select');

  useEffect(() => {
    const fetchLiabilities = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: landlord } = await supabase
        .from('landlords')
        .select('id, phone')
        .eq('user_id', user.id)
        .single();

      if (landlord?.phone) {
        setPhone(landlord.phone);
      }

      const { data } = await supabase
        .from('tax_liabilities')
        .select('*, properties(name), stays(guests(first_name, last_name))')
        .eq('landlord_id', landlord?.id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      setLiabilities((data as TaxLiability[]) || []);
      if (data && data.length > 0) {
        setSelectedIds(data.map((l: TaxLiability) => l.id));
      }
      setLoading(false);
    };

    fetchLiabilities();
  }, [router]);

  const selectedLiabilities = liabilities.filter(l => selectedIds.includes(l.id));
  const totalAmount = selectedLiabilities.reduce((sum, l) => sum + (l.amount || 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(liabilities.map(l => l.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleInitiatePayment = async () => {
    if (!provider || selectedIds.length === 0) return;

    setProcessing(true);
    setError('');

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          landlord_id: landlord?.id,
          tax_liability_id: selectedIds[0], // Primary liability (for now, single payment)
          amount: totalAmount,
          provider,
          status: 'pending',
          metadata: {
            liability_ids: selectedIds,
            phone,
            initiated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // In production, this would call the Wave/Orange Money API
      // For now, simulate the payment initiation
      if (provider === 'wave') {
        // Wave API would return a checkout URL
        // window.location.href = waveCheckoutUrl;

        // Simulate success for demo
        await supabase
          .from('payments')
          .update({ status: 'completed', paid_at: new Date().toISOString() })
          .eq('id', payment.id);

        // Update liabilities status
        await supabase
          .from('tax_liabilities')
          .update({ status: 'paid' })
          .in('id', selectedIds);

        router.push('/payments?success=true');
      } else if (provider === 'orange_money') {
        // Orange Money USSD flow
        // Would typically send USSD push to user's phone

        // Simulate success for demo
        await supabase
          .from('payments')
          .update({ status: 'completed', paid_at: new Date().toISOString() })
          .eq('id', payment.id);

        await supabase
          .from('tax_liabilities')
          .update({ status: 'paid' })
          .in('id', selectedIds);

        router.push('/payments?success=true');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Erreur lors de l\'initiation du paiement. Veuillez reessayer.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teranga-green border-t-transparent" />
      </div>
    );
  }

  if (liabilities.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Aucune taxe a payer</h2>
        <p className="mt-2 text-gray-600">Vous etes a jour dans vos paiements!</p>
        <Link
          href="/payments"
          className="mt-4 inline-flex items-center gap-2 text-teranga-green hover:underline"
        >
          Retour aux paiements
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/payments"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux paiements
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Payer les taxes TPT</h1>
        <p className="text-gray-600">Selectionnez les taxes a payer et le mode de paiement</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {['Selectionner', 'Mode de paiement', 'Confirmer'].map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              i === 0 && step === 'select' ? 'bg-teranga-green text-white' :
              i === 1 && step === 'provider' ? 'bg-teranga-green text-white' :
              i === 2 && step === 'confirm' ? 'bg-teranga-green text-white' :
              i < ['select', 'provider', 'confirm'].indexOf(step) ? 'bg-green-100 text-green-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className={`ml-2 text-sm ${
              ['select', 'provider', 'confirm'][i] === step ? 'font-medium text-gray-900' : 'text-gray-500'
            }`}>
              {label}
            </span>
            {i < 2 && (
              <svg className="mx-2 h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Liabilities */}
      {step === 'select' && (
        <>
          <div className="rounded-xl border bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-semibold text-gray-900">Taxes a payer</h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-teranga-green hover:underline"
                >
                  Tout selectionner
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Tout deselectionner
                </button>
              </div>
            </div>
            <div className="divide-y">
              {liabilities.map((liability) => (
                <label
                  key={liability.id}
                  className="flex cursor-pointer items-center gap-4 px-6 py-4 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(liability.id)}
                    onChange={() => toggleSelect(liability.id)}
                    className="h-5 w-5 rounded border-gray-300 text-teranga-green focus:ring-teranga-green"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {liability.properties?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {liability.stays?.guests?.first_name} {liability.stays?.guests?.last_name} - {liability.guest_nights} nuit(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {(liability.amount || 0).toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className={`text-xs ${liability.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {liability.status === 'overdue' ? 'En retard' : `Echeance: ${new Date(liability.due_date).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-xl bg-gray-50 p-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{selectedIds.length} taxe(s) selectionnee(s)</span>
              <span className="text-2xl font-bold text-gray-900">
                {totalAmount.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep('provider')}
            disabled={selectedIds.length === 0}
            className="w-full rounded-lg bg-teranga-green py-3 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
          >
            Continuer
          </button>
        </>
      )}

      {/* Step 2: Select Provider */}
      {step === 'provider' && (
        <>
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Choisissez votre mode de paiement</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Wave */}
              <button
                onClick={() => setProvider('wave')}
                className={`flex flex-col items-center rounded-xl border-2 p-6 transition-all ${
                  provider === 'wave'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
                  <span className="text-2xl font-bold text-white">W</span>
                </div>
                <span className="text-lg font-medium text-gray-900">Wave</span>
                <span className="mt-1 text-sm text-gray-500">Paiement instantane</span>
                {provider === 'wave' && (
                  <svg className="mt-2 h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Orange Money */}
              <button
                onClick={() => setProvider('orange_money')}
                className={`flex flex-col items-center rounded-xl border-2 p-6 transition-all ${
                  provider === 'orange_money'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500">
                  <span className="text-2xl font-bold text-white">OM</span>
                </div>
                <span className="text-lg font-medium text-gray-900">Orange Money</span>
                <span className="mt-1 text-sm text-gray-500">Paiement USSD</span>
                {provider === 'orange_money' && (
                  <svg className="mt-2 h-6 w-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Phone number */}
          <div className="rounded-xl border bg-white p-6">
            <label className="block text-sm font-medium text-gray-700">
              Numero de telephone
            </label>
            <div className="mt-2 flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
                +221
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="77 123 45 67"
                className="flex-1 rounded-r-lg border border-gray-300 px-4 py-2 focus:border-teranga-green focus:outline-none focus:ring-1 focus:ring-teranga-green"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {provider === 'wave'
                ? 'Vous recevrez une notification Wave pour confirmer le paiement'
                : 'Vous recevrez un message USSD pour confirmer le paiement'}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('select')}
              className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Retour
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!provider || phone.length < 9}
              className="flex-1 rounded-lg bg-teranga-green py-3 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
            >
              Continuer
            </button>
          </div>
        </>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <>
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Recapitulatif</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-600">Nombre de taxes</dt>
                <dd className="font-medium text-gray-900">{selectedIds.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Mode de paiement</dt>
                <dd className="font-medium text-gray-900">
                  {provider === 'wave' ? 'Wave' : 'Orange Money'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Telephone</dt>
                <dd className="font-medium text-gray-900">+221 {phone}</dd>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <dt className="text-lg font-semibold text-gray-900">Total a payer</dt>
                  <dd className="text-xl font-bold text-teranga-green">
                    {totalAmount.toLocaleString('fr-FR')} FCFA
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Payment provider info */}
          <div className={`rounded-xl p-4 ${provider === 'wave' ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${provider === 'wave' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                <span className="text-lg font-bold text-white">{provider === 'wave' ? 'W' : 'OM'}</span>
              </div>
              <div>
                <p className={`font-medium ${provider === 'wave' ? 'text-blue-900' : 'text-orange-900'}`}>
                  {provider === 'wave' ? 'Paiement via Wave' : 'Paiement via Orange Money'}
                </p>
                <p className={`text-sm ${provider === 'wave' ? 'text-blue-700' : 'text-orange-700'}`}>
                  {provider === 'wave'
                    ? 'Apres confirmation, ouvrez votre application Wave pour valider le paiement.'
                    : 'Apres confirmation, composez *144# pour valider le paiement USSD.'}
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep('provider')}
              disabled={processing}
              className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Retour
            </button>
            <button
              onClick={handleInitiatePayment}
              disabled={processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teranga-green py-3 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Traitement...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmer le paiement
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
