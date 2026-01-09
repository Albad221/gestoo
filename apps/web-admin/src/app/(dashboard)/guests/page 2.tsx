'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import TravelerVerificationPanel from '@/components/verification/traveler-verification-panel';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  nationality: string;
  date_of_birth: string;
  id_document_type: string;
  passport_number: string | null;
  national_id_number: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface Stay {
  id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  nights: number;
  guest_id: string;
  guests: Guest;
  properties: {
    id: string;
    name: string;
    address: string;
    city: string;
    region: string;
    registration_number: string | null;
    landlords: {
      first_name: string;
      last_name: string;
      phone: string;
    } | null;
  };
}

const documentTypeLabels: Record<string, string> = {
  passport: 'Passeport',
  national_id: 'CNI',
  residence_permit: 'Titre de séjour',
  driving_license: 'Permis de conduire',
  other: 'Autre',
};

export default function GuestSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  const [recentStays, setRecentStays] = useState<Stay[]>([]);
  const [showVerification, setShowVerification] = useState(false);

  // Load recent stays on mount
  useEffect(() => {
    const loadRecent = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('stays')
        .select(`
          *,
          guests (*),
          properties (
            id,
            name,
            address,
            city,
            region,
            registration_number,
            landlords (
              first_name,
              last_name,
              phone
            )
          )
        `)
        .order('check_in', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading stays:', error);
      }

      if (data) {
        setRecentStays(data as Stay[]);
      }
      setLoading(false);
    };
    loadRecent();
  }, []);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSelectedStay(null);

    try {
      const supabase = createClient();
      const searchTerm = query.trim();

      // Search across multiple fields: name, email, phone, document numbers
      const { data: guestIds } = await supabase
        .from('guests')
        .select('id')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,passport_number.ilike.%${searchTerm}%,national_id_number.ilike.%${searchTerm}%`);

      if (guestIds && guestIds.length > 0) {
        const ids = guestIds.map(g => g.id);
        const { data: staysData } = await supabase
          .from('stays')
          .select(`
            *,
            guests (*),
            properties (
              id,
              name,
              address,
              city,
              region,
              registration_number,
              landlords (
                first_name,
                last_name,
                phone
              )
            )
          `)
          .in('guest_id', ids)
          .order('check_in', { ascending: false })
          .limit(50);

        setResults((staysData as Stay[]) || []);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getDocumentNumber = (guest: Guest): string => {
    return guest.passport_number || guest.national_id_number || 'N/A';
  };

  const displayResults = searchQuery.trim() ? results : recentStays;
  const isSearching = searching && searchQuery.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recherche Voyageurs</h1>
        <p className="text-gray-600 dark:text-gray-400">Recherchez par nom, téléphone, email ou numéro de document</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[22px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tapez un nom, téléphone, email ou numéro de document..."
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-4 pl-12 pr-12 text-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
          {isSearching && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Recherche par:</span>
          {['Nom', 'Téléphone', 'Email', 'Passeport', 'CNI'].map((type) => (
            <span key={type} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400">
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">groups</span>
                {searchQuery.trim() ? `Résultats (${results.length})` : 'Arrivées récentes'}
              </h2>
              {displayResults.length > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {displayResults.length} voyageur(s)
                </span>
              )}
            </div>

            {loading && !searchQuery ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : displayResults.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {displayResults.map((stay) => {
                  const age = calculateAge(stay.guests.date_of_birth);
                  const isMinor = age < 18;

                  return (
                    <button
                      key={stay.id}
                      onClick={() => { setSelectedStay(stay); setShowVerification(false); }}
                      className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedStay?.id === stay.id ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${
                            isMinor ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            <span className={`text-sm font-bold ${
                              isMinor ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {stay.guests.first_name[0]}{stay.guests.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {stay.guests.first_name} {stay.guests.last_name}
                              </p>
                              {isMinor && (
                                <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">child_care</span>
                                  Mineur ({age} ans)
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                stay.status === 'active'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {stay.status === 'active' ? 'Actif' : 'Terminé'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">public</span>
                                {stay.guests.nationality}
                              </span>
                              {stay.guests.phone && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">phone</span>
                                  {stay.guests.phone}
                                </span>
                              )}
                              {stay.guests.email && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">mail</span>
                                  {stay.guests.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{stay.properties?.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                            <span className="material-symbols-outlined text-[12px]">location_on</span>
                            {stay.properties?.city}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(stay.check_in).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  person_search
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {searchQuery.trim() ? 'Aucun résultat trouvé' : 'Aucun voyageur enregistré'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedStay ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-6 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowVerification(false)}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    !showVerification
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Détails
                </button>
                <button
                  onClick={() => setShowVerification(true)}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    showVerification
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  Vérification OSINT
                </button>
              </div>

              {showVerification ? (
                <TravelerVerificationPanel guest={selectedStay.guests} />
              ) : (
                <div>
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Détails du voyageur</h3>
                  </div>

                  <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xl font-bold text-primary">
                          {selectedStay.guests.first_name[0]}{selectedStay.guests.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedStay.guests.first_name} {selectedStay.guests.last_name}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">public</span>
                          {selectedStay.guests.nationality}
                        </p>
                      </div>
                    </div>

                    {(selectedStay.guests.phone || selectedStay.guests.email) && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Contact</p>
                        <div className="space-y-2">
                          {selectedStay.guests.phone && (
                            <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-gray-400">phone</span>
                              {selectedStay.guests.phone}
                            </p>
                          )}
                          {selectedStay.guests.email && (
                            <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-gray-400">mail</span>
                              {selectedStay.guests.email}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Document d&apos;identité</p>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">badge</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {documentTypeLabels[selectedStay.guests.id_document_type] || 'Document'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                              {getDocumentNumber(selectedStay.guests)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Date de naissance</p>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(selectedStay.guests.date_of_birth).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          calculateAge(selectedStay.guests.date_of_birth) < 18
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {calculateAge(selectedStay.guests.date_of_birth)} ans
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Séjour</p>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">login</span>
                            Arrivée
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(selectedStay.check_in).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">logout</span>
                            Départ
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedStay.check_out
                              ? new Date(selectedStay.check_out).toLocaleDateString('fr-FR')
                              : 'En cours'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-gray-600 dark:text-gray-400">Statut</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            selectedStay.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                            {selectedStay.status === 'active' ? 'Actif' : 'Terminé'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hébergement</p>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-2">
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-primary">hotel</span>
                          {selectedStay.properties?.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                          <span className="material-symbols-outlined text-[16px] text-gray-400 mt-0.5">location_on</span>
                          <span>{selectedStay.properties?.address}, {selectedStay.properties?.city}</span>
                        </p>
                        {selectedStay.properties?.registration_number && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-mono flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            {selectedStay.properties.registration_number}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedStay.properties?.landlords && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Propriétaire</p>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedStay.properties.landlords.first_name} {selectedStay.properties.landlords.last_name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">phone</span>
                            {selectedStay.properties.landlords.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                      <button className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Exporter PDF
                      </button>
                      <button className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">notification_important</span>
                        Créer alerte
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  person
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Sélectionnez un voyageur pour voir les détails</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
