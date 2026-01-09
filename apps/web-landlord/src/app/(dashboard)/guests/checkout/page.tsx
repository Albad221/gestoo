'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Stay {
  id: string;
  check_in: string;
  nights: number;
  num_guests: number;
  status: string;
  property_id: string;
  guest_id: string;
  guests: {
    first_name: string;
    last_name: string;
    nationality: string;
    document_type: string;
    document_number: string;
  };
  properties: {
    name: string;
    address: string;
  };
}

interface TaxLiability {
  id: string;
  amount: number;
  status: string;
  guest_nights: number;
  rate_per_night: number;
}

const TPT_RATE = 1000; // FCFA per night per guest

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stayId = searchParams.get('stay');

  const [stay, setStay] = useState<Stay | null>(null);
  const [taxLiability, setTaxLiability] = useState<TaxLiability | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [actualNights, setActualNights] = useState(0);

  useEffect(() => {
    if (!stayId) {
      router.push('/guests');
      return;
    }

    const fetchStay = async () => {
      const supabase = createClient();

      // Fetch stay with guest and property info
      const { data: stayData, error: stayError } = await supabase
        .from('stays')
        .select('*, guests(first_name, last_name, nationality, document_type, document_number), properties(name, address)')
        .eq('id', stayId)
        .single();

      if (stayError || !stayData) {
        setError('Sejour non trouve');
        setLoading(false);
        return;
      }

      if (stayData.status !== 'active') {
        setError('Ce sejour est deja termine');
        setLoading(false);
        return;
      }

      setStay(stayData as Stay);

      // Calculate actual nights from check-in to today
      const checkInDate = new Date(stayData.check_in);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - checkInDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setActualNights(Math.max(1, diffDays));

      // Fetch existing tax liability
      const { data: taxData } = await supabase
        .from('tax_liabilities')
        .select('*')
        .eq('stay_id', stayId)
        .single();

      if (taxData) {
        setTaxLiability(taxData);
      }

      setLoading(false);
    };

    fetchStay();
  }, [stayId, router]);

  const calculateTotalTPT = () => {
    if (!stay) return 0;
    return TPT_RATE * actualNights * (stay.num_guests || 1);
  };

  const handleCheckout = async () => {
    if (!stay || !stayId) return;

    setSubmitting(true);
    setError('');

    try {
      const supabase = createClient();
      const checkOutDate = new Date().toISOString();
      const totalTPT = calculateTotalTPT();

      // Update stay with checkout info
      const { error: stayError } = await supabase
        .from('stays')
        .update({
          check_out: checkOutDate,
          nights: actualNights,
          status: 'completed',
        })
        .eq('id', stayId);

      if (stayError) throw stayError;

      // Update or create tax liability with final amount
      if (taxLiability) {
        await supabase
          .from('tax_liabilities')
          .update({
            guest_nights: actualNights * (stay.num_guests || 1),
            amount: totalTPT,
          })
          .eq('id', taxLiability.id);
      } else {
        // Get property's landlord_id
        const { data: property } = await supabase
          .from('properties')
          .select('landlord_id')
          .eq('id', stay.property_id)
          .single();

        if (property) {
          await supabase.from('tax_liabilities').insert({
            property_id: stay.property_id,
            landlord_id: property.landlord_id,
            stay_id: stayId,
            guest_nights: actualNights * (stay.num_guests || 1),
            rate_per_night: TPT_RATE,
            amount: totalTPT,
            status: 'pending',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          });
        }
      }

      // Redirect to guests page with success message
      router.push('/guests?checkout=success');
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Erreur lors du check-out. Veuillez reessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teranga-green border-t-transparent" />
      </div>
    );
  }

  if (error && !stay) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{error}</h2>
        <Link
          href="/guests"
          className="mt-4 inline-flex items-center gap-2 text-teranga-green hover:underline"
        >
          Retour aux locataires
        </Link>
      </div>
    );
  }

  if (!stay) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/guests"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux locataires
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Check-out</h1>
        <p className="text-gray-600">Terminer le sejour et calculer la TPT</p>
      </div>

      {/* Guest Info Card */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations du locataire</h2>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teranga-green/10">
            <span className="text-xl font-semibold text-teranga-green">
              {stay.guests.first_name[0]}{stay.guests.last_name[0]}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {stay.guests.first_name} {stay.guests.last_name}
            </h3>
            <p className="text-gray-600">{stay.guests.nationality}</p>
            <p className="mt-1 text-sm text-gray-500">
              {stay.guests.document_type === 'passport' ? 'Passeport' :
               stay.guests.document_type === 'national_id' ? 'CNI' :
               stay.guests.document_type}: {stay.guests.document_number}
            </p>
          </div>
        </div>
      </div>

      {/* Stay Details Card */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Details du sejour</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Propriete</dt>
            <dd className="mt-1 font-medium text-gray-900">{stay.properties.name}</dd>
            <dd className="text-sm text-gray-500">{stay.properties.address}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Nombre de personnes</dt>
            <dd className="mt-1 font-medium text-gray-900">{stay.num_guests || 1} personne(s)</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Date d'arrivee</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {new Date(stay.check_in).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Date de depart</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
        </dl>

        {/* Nights selector */}
        <div className="mt-6 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700">
            Nombre de nuits
          </label>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActualNights(Math.max(1, actualNights - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-2xl font-bold text-gray-900">{actualNights}</span>
            <button
              type="button"
              onClick={() => setActualNights(actualNights + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* TPT Calculation Card */}
      <div className="rounded-xl border bg-teranga-green/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Taxe de Promotion Touristique (TPT)</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-gray-600">
            <span>Tarif par nuit par personne</span>
            <span>{TPT_RATE.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Nombre de nuits</span>
            <span>{actualNights}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Nombre de personnes</span>
            <span>{stay.num_guests || 1}</span>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between">
              <span className="text-lg font-semibold text-gray-900">Total TPT a collecter</span>
              <span className="text-xl font-bold text-teranga-green">
                {calculateTotalTPT().toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Cette taxe sera ajoutee a votre solde a payer. Vous pouvez la regler via Wave ou Orange Money.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href="/guests"
          className="flex-1 rounded-lg border border-gray-300 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teranga-green py-3 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Traitement...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirmer le check-out
            </>
          )}
        </button>
      </div>
    </div>
  );
}
