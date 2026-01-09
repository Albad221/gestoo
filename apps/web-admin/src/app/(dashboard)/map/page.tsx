'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  registration_number: string | null;
  latitude: number | null;
  longitude: number | null;
  type: string;
  landlords?: {
    first_name: string;
    last_name: string;
  };
}

interface Alert {
  id: string;
  title: string;
  type: string;
  severity: string;
  location_city: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Chargement de la carte...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts'>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ checkins: 0, activeAlerts: 0, criticalAlerts: 0, visibleProperties: 0 });

  useEffect(() => {
    async function fetchMapData() {
      const supabase = createClient();

      try {
        const [propertiesResult, alertsResult, staysCount, alertCounts] = await Promise.all([
          supabase
            .from('properties')
            .select(`
              id,
              name,
              address,
              city,
              region,
              status,
              registration_number,
              latitude,
              longitude,
              type,
              landlords (
                first_name,
                last_name
              )
            `)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null),
          supabase
            .from('alerts')
            .select('id, title, type, severity, location_city, latitude, longitude')
            .eq('status', 'open'),
          supabase
            .from('stays')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('check_in', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('alerts')
            .select('severity')
            .eq('status', 'open'),
        ]);

        const propertiesData = propertiesResult.data as Property[] || [];
        const alertsData = alertsResult.data as Alert[] || [];

        setProperties(propertiesData);
        setAlerts(alertsData);

        const criticalCount = alertCounts.data?.filter(a => a.severity === 'critical').length || 0;

        setStats({
          checkins: staysCount.count || 0,
          activeAlerts: alertsData.length,
          criticalAlerts: criticalCount,
          visibleProperties: propertiesData.length,
        });

        if (propertiesData.length > 0) {
          setSelectedProperty(propertiesData[0]);
        }
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMapData();
  }, []);

  const filteredProperties = properties.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query) ||
        p.registration_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 ml-64 flex flex-col bg-gray-200 dark:bg-gray-900 overflow-hidden">
      {/* Map Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* Map Component */}
        <div className="absolute inset-0 z-0">
          {!loading && (
            <MapComponent
              properties={filteredProperties}
              alerts={activeFilter === 'alerts' ? alerts : []}
              selectedProperty={selectedProperty}
              onSelectProperty={setSelectedProperty}
            />
          )}
        </div>

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-gradient-to-b from-black/20 to-transparent pb-12">
          {/* Search Bar */}
          <div className="pointer-events-auto w-full md:w-auto md:min-w-[320px] shadow-lg rounded-xl overflow-hidden bg-white dark:bg-gray-800 flex items-center h-12">
            <div className="pl-4 text-gray-400">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input
              className="w-full h-full border-none focus:ring-0 text-sm bg-transparent dark:text-white px-3"
              placeholder="Rechercher une propriété, adresse, ID..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Chips */}
          <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
            <button className="flex items-center gap-2 bg-white dark:bg-gray-800 dark:text-white px-4 py-2 rounded-full shadow-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap transition-all border border-transparent hover:border-gray-200">
              <span>Région: Toutes</span>
              <span className="material-symbols-outlined text-[18px] text-gray-400">arrow_drop_down</span>
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === 'alerts' ? 'all' : 'alerts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === 'alerts'
                  ? 'bg-red-500 text-white ring-2 ring-red-500/20'
                  : 'bg-white dark:bg-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Alertes: {activeFilter === 'alerts' ? 'Visibles' : 'Masquées'}</span>
            </button>
          </div>
        </div>

        {/* Property Details Panel */}
        {selectedProperty && (
          <aside className="absolute top-20 right-4 w-full md:w-[380px] z-20 pointer-events-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
              {/* Panel Header */}
              <div className="relative h-40 bg-gray-100 dark:bg-gray-700">
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="bg-black/20 hover:bg-black/40 text-white rounded-full p-1 backdrop-blur-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-6xl text-primary/30">
                    {selectedProperty.type === 'hotel' ? 'hotel' :
                     selectedProperty.type === 'villa' ? 'villa' :
                     selectedProperty.type === 'apartment' ? 'apartment' : 'home'}
                  </span>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedProperty.status === 'active'
                          ? 'bg-green-500'
                          : selectedProperty.status === 'pending'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    >
                      {selectedProperty.status === 'active'
                        ? 'Actif'
                        : selectedProperty.status === 'pending'
                          ? 'En attente'
                          : selectedProperty.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold leading-tight">{selectedProperty.name}</h2>
                </div>
              </div>

              {/* Panel Content */}
              <div className="p-5 flex flex-col gap-5 overflow-y-auto">
                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/properties/${selectedProperty.id}`}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                    Voir le dossier
                  </Link>
                  <button className="w-9 h-9 shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <span className="material-symbols-outlined text-[20px]">phone</span>
                  </button>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Adresse</p>
                    <p className="font-medium dark:text-white flex items-start gap-1">
                      <span className="material-symbols-outlined text-gray-400 text-[16px] mt-0.5">
                        location_on
                      </span>
                      {selectedProperty.address}, {selectedProperty.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Propriétaire</p>
                    <p className="font-medium dark:text-white">
                      {selectedProperty.landlords
                        ? `${selectedProperty.landlords.first_name} ${selectedProperty.landlords.last_name}`
                        : 'Non renseigné'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">ID Système</p>
                    <p className="font-mono text-gray-600 dark:text-gray-300">
                      {selectedProperty.registration_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Type</p>
                    <p className="font-medium dark:text-white capitalize">{selectedProperty.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Coordonnées</p>
                    <p className="font-mono text-xs text-gray-600 dark:text-gray-300">
                      {selectedProperty.latitude?.toFixed(4)}, {selectedProperty.longitude?.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Stats Bar */}
        <div className="absolute bottom-6 left-6 md:left-1/2 md:-translate-x-1/2 z-20 pointer-events-auto flex flex-col md:flex-row gap-3 w-max max-w-[calc(100%-3rem)] overflow-x-auto p-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-3 min-w-[160px] flex flex-col justify-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">
              Check-ins (24h)
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.checkins}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 border-l-red-500 p-3 min-w-[160px] flex flex-col justify-center">
            <p className="text-red-500 text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Alertes Actives
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.activeAlerts}</span>
              <span className="text-xs text-gray-400 mb-1.5">Critiques: {stats.criticalAlerts}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-3 min-w-[160px] flex flex-col justify-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">
              Propriétés Visibles
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{filteredProperties.length}</span>
              <span className="text-xs text-gray-400 mb-1.5">sur {stats.visibleProperties}</span>
            </div>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute bottom-8 right-6 flex flex-col gap-2 z-20 pointer-events-auto">
          <Link
            href="/dashboard"
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center justify-center text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Retour au tableau de bord"
          >
            <span className="material-symbols-outlined">dashboard</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
