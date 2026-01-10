'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Landlord {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  whatsapp_phone: string | null;
  national_id: string | null;
  tax_id: string | null;
  address: string | null;
  city: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  properties_count?: number;
}

export default function LandlordsPage() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    fetchLandlords();
  }, []);

  const fetchLandlords = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('landlords')
        .select(`
          *,
          properties:properties(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const landlordsWithCount = (data || []).map((l: any) => ({
        ...l,
        properties_count: l.properties?.[0]?.count || 0,
      }));

      setLandlords(landlordsWithCount);
    } catch (error) {
      console.error('Error fetching landlords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (landlordId: string) => {
    setVerifyLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from('landlords')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', landlordId);

      fetchLandlords();
      setSelectedLandlord(null);
    } catch (error) {
      console.error('Error verifying landlord:', error);
    } finally {
      setVerifyLoading(false);
    }
  };

  const filteredLandlords = landlords.filter((l) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.first_name.toLowerCase().includes(query) ||
      l.last_name.toLowerCase().includes(query) ||
      l.phone.includes(query) ||
      l.national_id?.includes(query) ||
      l.email?.toLowerCase().includes(query)
    );
  });

  const verifiedCount = landlords.filter((l) => l.is_verified).length;
  const unverifiedCount = landlords.filter((l) => !l.is_verified).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bailleurs</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestion des propriétaires d'hébergements
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                people
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {landlords.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400">
                verified
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Vérifiés</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {verifiedCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400">
                pending
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Non vérifiés</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {unverifiedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone, NIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Landlords Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredLandlords.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {filteredLandlords.map((landlord) => (
                  <button
                    key={landlord.id}
                    onClick={() => setSelectedLandlord(landlord)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedLandlord?.id === landlord.id
                        ? 'bg-primary/5 dark:bg-primary/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${
                            landlord.is_verified
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`}
                        >
                          {landlord.first_name[0]}
                          {landlord.last_name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {landlord.first_name} {landlord.last_name}
                            </p>
                            {landlord.is_verified && (
                              <span className="material-symbols-outlined text-green-500 text-[16px]">
                                verified
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {landlord.phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {landlord.properties_count} propriété(s)
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(landlord.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  person_off
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Aucun bailleur trouvé
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedLandlord ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-6">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-white text-xl font-bold ${
                      selectedLandlord.is_verified ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  >
                    {selectedLandlord.first_name[0]}
                    {selectedLandlord.last_name[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedLandlord.first_name} {selectedLandlord.last_name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        selectedLandlord.is_verified
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {selectedLandlord.is_verified ? (
                        <>
                          <span className="material-symbols-outlined text-[14px]">
                            verified
                          </span>
                          Vérifié
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">
                            pending
                          </span>
                          Non vérifié
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Contact */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Contact
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-[18px] text-gray-400">
                        phone
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedLandlord.phone}
                      </span>
                    </div>
                    {selectedLandlord.whatsapp_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-green-500">
                          chat
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {selectedLandlord.whatsapp_phone}
                        </span>
                      </div>
                    )}
                    {selectedLandlord.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-gray-400">
                          mail
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {selectedLandlord.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Identity */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Identité
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        NIN
                      </span>
                      {selectedLandlord.national_id ? (
                        <span className="text-sm font-mono text-gray-900 dark:text-white">
                          {selectedLandlord.national_id}
                        </span>
                      ) : (
                        <span className="text-sm text-red-500">Non fourni</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        N° Fiscal
                      </span>
                      {selectedLandlord.tax_id ? (
                        <span className="text-sm font-mono text-gray-900 dark:text-white">
                          {selectedLandlord.tax_id}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                {(selectedLandlord.address || selectedLandlord.city) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Adresse
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedLandlord.address}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedLandlord.city}
                    </p>
                  </div>
                )}

                {/* Stats */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Statistiques
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedLandlord.properties_count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Propriétés
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {new Date(selectedLandlord.created_at).toLocaleDateString(
                          'fr-FR',
                          { day: 'numeric', month: 'short' }
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Inscription
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  {!selectedLandlord.is_verified && (
                    <button
                      onClick={() => handleVerify(selectedLandlord.id)}
                      disabled={verifyLoading}
                      className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        verified
                      </span>
                      {verifyLoading ? 'Vérification...' : 'Vérifier ce bailleur'}
                    </button>
                  )}
                  <a
                    href={`https://wa.me/${selectedLandlord.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full rounded-lg border border-green-500 py-2.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    Contacter sur WhatsApp
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  person
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Sélectionnez un bailleur pour voir les détails
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
