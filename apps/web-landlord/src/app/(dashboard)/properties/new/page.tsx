'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PropertyType } from '@gestoo/shared-types';

const propertyTypes: { value: PropertyType; label: string; description: string }[] = [
  { value: 'hotel', label: 'Hotel', description: 'Etablissement hotelier classe' },
  { value: 'meuble', label: 'Meuble', description: 'Appartement ou maison meublee' },
  { value: 'guesthouse', label: "Maison d'hotes", description: "Chambres d'hotes, auberge" },
  { value: 'short_term', label: 'Location courte duree', description: 'Airbnb, location saisonniere' },
];

const regions = [
  'Dakar', 'Thies', 'Saint-Louis', 'Diourbel', 'Fatick', 'Kaolack',
  'Kolda', 'Louga', 'Matam', 'Tambacounda', 'Ziguinchor', 'Kedougou', 'Sedhiou', 'Kaffrine',
];

export default function NewPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: '' as PropertyType | '',
    description: '',
    address: '',
    city: '',
    region: '',
    gps_lat: null as number | null,
    gps_lng: null as number | null,
    capacity_rooms: '',
    capacity_beds: '',
    capacity_guests: '',
  });

  const updateForm = (field: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            gps_lat: position.coords.latitude,
            gps_lng: position.coords.longitude,
          }));
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get landlord
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!landlord) throw new Error('Landlord not found');

      // Create property
      const { error: insertError } = await supabase.from('properties').insert({
        landlord_id: landlord.id,
        name: formData.name,
        type: formData.type,
        description: formData.description || null,
        address: formData.address,
        city: formData.city,
        region: formData.region,
        gps_lat: formData.gps_lat,
        gps_lng: formData.gps_lng,
        capacity_rooms: formData.capacity_rooms ? parseInt(formData.capacity_rooms) : null,
        capacity_beds: formData.capacity_beds ? parseInt(formData.capacity_beds) : null,
        capacity_guests: formData.capacity_guests ? parseInt(formData.capacity_guests) : null,
        status: 'pending',
      });

      if (insertError) throw insertError;

      router.push('/properties');
    } catch (err) {
      console.error('Error creating property:', err);
      setError('Erreur lors de la creation. Veuillez reessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name && formData.type;
      case 2:
        return formData.address && formData.city && formData.region;
      case 3:
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
          href="/properties"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle propriete</h1>
        <p className="text-gray-600">Enregistrez votre hebergement en quelques etapes</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s < step
                    ? 'bg-teranga-green text-white'
                    : s === step
                    ? 'bg-teranga-green text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 3 && (
                <div className={`mx-2 h-0.5 w-24 ${s < step ? 'bg-teranga-green' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Informations</span>
          <span>Adresse</span>
          <span>Details</span>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border bg-white p-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nom de la propriete *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Ex: Villa Teranga"
                className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Type de propriete *
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {propertyTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateForm('type', type.value)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      formData.type === type.value
                        ? 'border-teranga-green bg-teranga-green/5'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description (optionnel)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Decrivez votre propriete..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
              />
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Adresse complete *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateForm('address', e.target.value)}
                placeholder="Ex: 12 Rue Felix Faure, Plateau"
                className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Ville *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateForm('city', e.target.value)}
                  placeholder="Ex: Dakar"
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Region *
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => updateForm('region', e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                >
                  <option value="">Selectionnez une region</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Position GPS (optionnel)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Obtenir ma position
                </button>
                {formData.gps_lat && (
                  <span className="flex items-center text-sm text-green-600">
                    <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Position obtenue
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nombre de chambres
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.capacity_rooms}
                  onChange={(e) => updateForm('capacity_rooms', e.target.value)}
                  placeholder="0"
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nombre de lits
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.capacity_beds}
                  onChange={(e) => updateForm('capacity_beds', e.target.value)}
                  placeholder="0"
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Capacite max
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity_guests}
                  onChange={(e) => updateForm('capacity_guests', e.target.value)}
                  placeholder="1"
                  className="h-12 w-full rounded-lg border border-gray-300 px-4 transition-colors hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="mb-3 font-medium text-gray-900">Recapitulatif</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nom</dt>
                  <dd className="font-medium text-gray-900">{formData.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium text-gray-900">
                    {propertyTypes.find((t) => t.value === formData.type)?.label}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Adresse</dt>
                  <dd className="font-medium text-gray-900">{formData.address}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Ville</dt>
                  <dd className="font-medium text-gray-900">{formData.city}, {formData.region}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Precedent
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 rounded-lg bg-teranga-green px-6 py-2 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
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
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-teranga-green px-6 py-2 font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
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
