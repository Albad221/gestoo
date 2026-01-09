'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for map (SSR disabled)
const HotelsMap = dynamic(() => import('@/components/map/hotels-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
    </div>
  ),
});

interface Hotel {
  id: string;
  platform_id: string;
  title: string;
  city: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  num_reviews: number | null;
  url: string;
  photos: string[];
  raw_data: {
    phone?: string;
    website?: string;
    property_type?: string;
    price_level?: number;
    business_status?: string;
  } | null;
  created_at: string;
  last_seen_at: string;
}

interface Stats {
  total: number;
  withPhone: number;
  byCity: Record<string, number>;
  byType: Record<string, number>;
}

export default function EtablissementsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'split'>('split');

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    try {
      const response = await fetch('/api/etablissements');
      if (response.ok) {
        const data = await response.json();
        setHotels(data.hotels || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error loading hotels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHotels = hotels.filter((hotel) => {
    const matchesCity = selectedCity === 'all' || hotel.city === selectedCity;
    const matchesSearch =
      !searchQuery ||
      hotel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.location_text?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCity && matchesSearch;
  });

  const cities = stats?.byCity ? Object.keys(stats.byCity).sort() : [];

  const getPriceLevel = (level: number | undefined) => {
    if (!level) return null;
    return '$'.repeat(level);
  };

  const handleSelectHotel = useCallback((hotel: Hotel) => {
    setSelectedHotel(hotel);
  }, []);

  const exportToCSV = () => {
    const headers = ['Nom', 'Ville', 'Adresse', 'Téléphone', 'Site Web', 'Note', 'Avis', 'Type', 'Latitude', 'Longitude'];
    const rows = filteredHotels.map((h) => [
      h.title,
      h.city,
      h.location_text || '',
      h.raw_data?.phone || '',
      h.raw_data?.website || '',
      h.rating?.toString() || '',
      h.num_reviews?.toString() || '',
      h.raw_data?.property_type || '',
      h.latitude?.toString() || '',
      h.longitude?.toString() || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotels_senegal_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hôtels & Auberges</h1>
          <p className="text-gray-600">Recensement des établissements hôteliers au Sénégal</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
              Liste
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                viewMode === 'split' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">view_sidebar</span>
              Split
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                viewMode === 'map' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">map</span>
              Carte
            </button>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <span className="material-symbols-outlined text-xl">download</span>
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-100 p-3">
                <span className="material-symbols-outlined text-2xl text-blue-600">apartment</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Établissements</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-100 p-3">
                <span className="material-symbols-outlined text-2xl text-green-600">phone</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avec Téléphone</p>
                <p className="text-2xl font-bold">{stats.withPhone}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-100 p-3">
                <span className="material-symbols-outlined text-2xl text-purple-600">location_city</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Villes Couvertes</p>
                <p className="text-2xl font-bold">{cities.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-orange-100 p-3">
                <span className="material-symbols-outlined text-2xl text-orange-600">percent</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Taux Contact</p>
                <p className="text-2xl font-bold">
                  {stats.total > 0 ? Math.round((stats.withPhone / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher par nom ou adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Toutes les villes</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city} ({stats?.byCity[city] || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filteredHotels.length} établissement{filteredHotels.length !== 1 ? 's' : ''} trouvé
        {filteredHotels.length !== 1 ? 's' : ''}
      </p>

      {/* Main Content Area */}
      <div className={`${viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}`}>
        {/* Map View */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={`${viewMode === 'map' ? 'h-[600px]' : 'h-[500px]'} rounded-xl overflow-hidden shadow-sm`}>
            <HotelsMap
              hotels={filteredHotels}
              selectedHotel={selectedHotel}
              onSelectHotel={handleSelectHotel}
            />
          </div>
        )}

        {/* List View */}
        {(viewMode === 'list' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'h-[500px] overflow-y-auto' : ''}`}>
            <div className={`grid ${viewMode === 'split' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
              {filteredHotels.map((hotel) => (
                <div
                  key={hotel.id}
                  onClick={() => setSelectedHotel(hotel)}
                  className={`rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border ${
                    selectedHotel?.id === hotel.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 flex-shrink-0">
                      <span className="material-symbols-outlined text-blue-600">
                        {hotel.raw_data?.property_type === 'Auberge' ? 'cottage' : 'apartment'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{hotel.title}</h3>
                      <p className="text-sm text-gray-500 truncate">{hotel.city}</p>
                    </div>
                    {hotel.rating && (
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                        <span className="material-symbols-outlined text-yellow-500 text-sm">star</span>
                        <span className="text-sm font-medium">{hotel.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-1">
                    {hotel.raw_data?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-green-600 text-base">phone</span>
                        <a
                          href={`tel:${hotel.raw_data.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-green-600 hover:underline"
                        >
                          {hotel.raw_data.phone}
                        </a>
                      </div>
                    )}
                    {hotel.location_text && (
                      <p className="text-xs text-gray-400 truncate">{hotel.location_text}</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {hotel.raw_data?.property_type || 'Lodging'}
                    </span>
                    {hotel.raw_data?.price_level && (
                      <span className="text-xs text-gray-500">
                        {getPriceLevel(hotel.raw_data.price_level)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedHotel && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedHotel(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedHotel.title}</h2>
                  <p className="text-gray-500">{selectedHotel.city}</p>
                </div>
                <button
                  onClick={() => setSelectedHotel(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                {selectedHotel.rating && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-yellow-500">star</span>
                    <span className="font-medium">{selectedHotel.rating.toFixed(1)}</span>
                    {selectedHotel.num_reviews && (
                      <span className="text-gray-500">({selectedHotel.num_reviews} avis)</span>
                    )}
                  </div>
                )}

                {selectedHotel.location_text && (
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-gray-400">location_on</span>
                    <span className="text-gray-700">{selectedHotel.location_text}</span>
                  </div>
                )}

                {selectedHotel.raw_data?.phone && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-600">phone</span>
                    <a
                      href={`tel:${selectedHotel.raw_data.phone}`}
                      className="text-green-600 hover:underline font-medium"
                    >
                      {selectedHotel.raw_data.phone}
                    </a>
                  </div>
                )}

                {selectedHotel.raw_data?.website && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">language</span>
                    <a
                      href={selectedHotel.raw_data.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {selectedHotel.raw_data.website}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-400">category</span>
                  <span className="text-gray-700">
                    {selectedHotel.raw_data?.property_type || 'Établissement'}
                  </span>
                </div>

                {selectedHotel.latitude && selectedHotel.longitude && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400">my_location</span>
                    <span className="text-gray-500 text-sm">
                      {selectedHotel.latitude.toFixed(4)}, {selectedHotel.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <a
                  href={selectedHotel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-xl">open_in_new</span>
                  Voir sur Google Maps
                </a>
                {selectedHotel.raw_data?.phone && (
                  <a
                    href={`tel:${selectedHotel.raw_data.phone}`}
                    className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    <span className="material-symbols-outlined text-xl">call</span>
                    Appeler
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
