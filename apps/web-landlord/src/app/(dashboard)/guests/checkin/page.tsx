'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Property, DocumentType } from '@gestoo/types';

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passeport' },
  { value: 'cni', label: 'CNI Senegalaise' },
  { value: 'cedeao_id', label: 'Carte CEDEAO' },
  { value: 'residence_permit', label: 'Carte de sejour' },
];

const nationalities = [
  'Senegal', 'France', 'USA', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie',
  'Belgique', 'Suisse', 'Canada', 'Maroc', 'Tunisie', 'Algerie', 'Cote d\'Ivoire',
  'Mali', 'Guinee', 'Mauritanie', 'Gambie', 'Autre',
];

export default function GuestCheckinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProperty = searchParams.get('property');

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isMinor, setIsMinor] = useState(false);
  const [showMinorWarning, setShowMinorWarning] = useState(false);

  const [formData, setFormData] = useState({
    property_id: preselectedProperty || '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    nationality: '',
    document_type: '' as DocumentType | '',
    document_number: '',
    document_expiry: '',
    phone: '',
    email: '',
    expected_nights: '1',
    num_guests: '1',
    room_number: '',
    purpose: '',
    // Guardian info (for minors)
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_document_type: '' as DocumentType | '',
    guardian_document_number: '',
    guardian_date_of_birth: '',
  });

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    // Check if guest is minor
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      setIsMinor(age < 18);
      if (age < 18 && !showMinorWarning) {
        setShowMinorWarning(true);
      }
    }
  }, [formData.date_of_birth]);

  const loadProperties = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: landlord } = await supabase
      .from('landlords')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('landlord_id', landlord?.id)
      .eq('status', 'active');

    setProperties(data || []);
  };

  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateTPT = () => {
    const nights = parseInt(formData.expected_nights) || 1;
    const guests = parseInt(formData.num_guests) || 1;
    return 1000 * nights * guests;
  };

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Get landlord
      const { data: { user } } = await supabase.auth.getUser();
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!landlord) throw new Error('Landlord not found');

      // Create guest
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth || null,
          nationality: formData.nationality || null,
          document_type: formData.document_type || null,
          document_number: formData.document_number || null,
          document_expiry: formData.document_expiry || null,
          phone: formData.phone || null,
          email: formData.email || null,
        })
        .select()
        .single();

      if (guestError) throw guestError;

      // Create guardian if minor
      let guardianId = null;
      if (isMinor && formData.guardian_first_name) {
        const { data: guardian, error: guardianError } = await supabase
          .from('guests')
          .insert({
            first_name: formData.guardian_first_name,
            last_name: formData.guardian_last_name,
            date_of_birth: formData.guardian_date_of_birth || null,
            document_type: formData.guardian_document_type || null,
            document_number: formData.guardian_document_number || null,
          })
          .select()
          .single();

        if (guardianError) throw guardianError;
        guardianId = guardian.id;
      }

      // Create stay
      const nights = parseInt(formData.expected_nights) || 1;
      const numGuests = parseInt(formData.num_guests) || 1;

      const { data: stay, error: stayError } = await supabase
        .from('stays')
        .insert({
          property_id: formData.property_id,
          guest_id: guest.id,
          guardian_id: guardianId,
          nights: nights,
          num_guests: numGuests,
          room_number: formData.room_number || null,
          purpose: formData.purpose || null,
          status: 'active',
          police_notified: true,
          police_notified_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (stayError) throw stayError;

      // Create tax liability
      const tptAmount = calculateTPT();
      await supabase.from('tax_liabilities').insert({
        property_id: formData.property_id,
        landlord_id: landlord.id,
        stay_id: stay.id,
        guest_nights: nights * numGuests,
        rate_per_night: 1000,
        amount: tptAmount,
        status: 'pending',
      });

      // If minor without guardian, create alert
      if (isMinor && !guardianId) {
        await supabase.from('alerts').insert({
          severity: 'critical',
          type: 'unaccompanied_minor',
          title: 'ALERTE: Mineur non accompagne',
          description: `Mineur enregistre sans tuteur: ${formData.first_name} ${formData.last_name}`,
          property_id: formData.property_id,
          guest_id: guest.id,
          stay_id: stay.id,
          auto_generated: true,
        });
      }

      router.push('/guests');
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors de l\'enregistrement. Veuillez reessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.property_id && formData.first_name && formData.last_name;
      case 2:
        return formData.document_type && formData.document_number;
      case 3:
        if (isMinor) {
          return formData.guardian_first_name && formData.guardian_last_name;
        }
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/guests"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Enregistrer un locataire</h1>
        <p className="text-gray-600">Declaration d'arrivee pour la fiche de police</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s < step ? 'bg-teranga-green text-white' : s === step ? 'bg-teranga-green text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 3 && <div className={`mx-2 h-0.5 w-20 ${s < step ? 'bg-teranga-green' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Identite</span>
          <span>Document</span>
          <span>{isMinor ? 'Tuteur' : 'Sejour'}</span>
        </div>
      </div>

      {/* Minor Warning */}
      {showMinorWarning && isMinor && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-orange-800">Client mineur detecte</p>
              <p className="text-sm text-orange-700">
                Un tuteur legal (21 ans minimum) doit accompagner ce client.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border bg-white p-6">
        {/* Step 1: Identity */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Propriete *</label>
              <select
                value={formData.property_id}
                onChange={(e) => updateForm('property_id', e.target.value)}
                className="h-12 w-full rounded-lg border border-gray-300 px-4"
              >
                <option value="">Selectionnez une propriete</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Prenom *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => updateForm('first_name', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  placeholder="Jean"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => updateForm('last_name', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  placeholder="DUPONT"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Date de naissance</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => updateForm('date_of_birth', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nationalite</label>
                <select
                  value={formData.nationality}
                  onChange={(e) => updateForm('nationality', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                >
                  <option value="">Selectionnez</option>
                  {nationalities.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Document */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Type de document *</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {documentTypes.map((doc) => (
                  <button
                    key={doc.value}
                    type="button"
                    onClick={() => updateForm('document_type', doc.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      formData.document_type === doc.value
                        ? 'border-teranga-green bg-teranga-green/5'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Numero de document *</label>
                <input
                  type="text"
                  value={formData.document_number}
                  onChange={(e) => updateForm('document_number', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  placeholder="AB123456"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Date d'expiration</label>
                <input
                  type="date"
                  value={formData.document_expiry}
                  onChange={(e) => updateForm('document_expiry', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Telephone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  placeholder="+221 77 123 45 67"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  placeholder="jean@example.com"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Guardian (if minor) or Stay details */}
        {step === 3 && (
          <div className="space-y-6">
            {isMinor ? (
              <>
                <div className="rounded-lg bg-orange-50 p-4">
                  <p className="text-sm font-medium text-orange-800">
                    Information du tuteur legal (obligatoire pour les mineurs)
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Prenom du tuteur *</label>
                    <input
                      type="text"
                      value={formData.guardian_first_name}
                      onChange={(e) => updateForm('guardian_first_name', e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 px-4"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom du tuteur *</label>
                    <input
                      type="text"
                      value={formData.guardian_last_name}
                      onChange={(e) => updateForm('guardian_last_name', e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 px-4"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Document tuteur</label>
                    <select
                      value={formData.guardian_document_type}
                      onChange={(e) => updateForm('guardian_document_type', e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 px-4"
                    >
                      <option value="">Selectionnez</option>
                      {documentTypes.map((doc) => (
                        <option key={doc.value} value={doc.value}>{doc.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Numero document</label>
                    <input
                      type="text"
                      value={formData.guardian_document_number}
                      onChange={(e) => updateForm('guardian_document_number', e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 px-4"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {/* Stay Details */}
            <div className={isMinor ? 'border-t pt-6' : ''}>
              <h3 className="mb-4 font-medium text-gray-900">Details du sejour</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nuits prevues</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.expected_nights}
                    onChange={(e) => updateForm('expected_nights', e.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre personnes</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.num_guests}
                    onChange={(e) => updateForm('num_guests', e.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-300 px-4"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Chambre</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={(e) => updateForm('room_number', e.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-300 px-4"
                    placeholder="101"
                  />
                </div>
              </div>
            </div>

            {/* TPT Summary */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">TPT a payer</span>
                <span className="text-xl font-bold text-gray-900">{calculateTPT().toLocaleString()} FCFA</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                1 000 FCFA x {formData.expected_nights || 1} nuit(s) x {formData.num_guests || 1} personne(s)
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Precedent
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 rounded-lg bg-teranga-green px-6 py-2 font-medium text-white hover:bg-teranga-green/90 disabled:opacity-50"
            >
              Suivant
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !canProceed()}
              className="flex items-center gap-2 rounded-lg bg-teranga-green px-6 py-2 font-medium text-white hover:bg-teranga-green/90 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enregistrement...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Enregistrer
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
