'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Header } from '@/components/dashboard/header';
import { createClient } from '@/lib/supabase/client';

// Dynamically import map to avoid SSR issues
const DashboardMap = dynamic(() => import('@/components/map/dashboard-map'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Chargement de la carte...</p>
      </div>
    </div>
  ),
});

interface DashboardStats {
  activeProperties: number;
  totalProperties: number;
  activeStays: number;
  totalGuests: number;
  openAlerts: number;
  criticalAlerts: number;
  totalRevenue: number;
}

interface Stay {
  id: string;
  check_in: string;
  status: string;
  guests: {
    first_name: string;
    last_name: string;
    passport_number: string | null;
    national_id_number: string | null;
  };
  properties: {
    name: string;
    city: string;
  };
}

interface Property {
  id: string;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeProperties: 0,
    totalProperties: 0,
    activeStays: 0,
    totalGuests: 0,
    openAlerts: 0,
    criticalAlerts: 0,
    totalRevenue: 0,
  });
  const [recentCheckins, setRecentCheckins] = useState<Stay[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient();

      try {
        // Fetch stats in parallel
        const [
          { count: totalProperties },
          { count: activeProperties },
          { count: activeStays },
          { count: totalGuests },
          { count: openAlerts },
          { count: criticalAlerts },
          { data: paymentsData },
          { data: staysData },
          { data: propertiesData },
        ] = await Promise.all([
          supabase.from('properties').select('*', { count: 'exact', head: true }),
          supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('stays').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('guests').select('*', { count: 'exact', head: true }),
          supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'critical'),
          supabase.from('payments').select('amount').eq('status', 'completed'),
          supabase.from('stays')
            .select(`
              id,
              check_in,
              status,
              guests (
                first_name,
                last_name,
                passport_number,
                national_id_number
              ),
              properties (
                name,
                city
              )
            `)
            .order('check_in', { ascending: false })
            .limit(10),
          supabase.from('properties')
            .select('id, name, status, latitude, longitude')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null),
        ]);

        const totalRevenue = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        setStats({
          activeProperties: activeProperties || 0,
          totalProperties: totalProperties || 0,
          activeStays: activeStays || 0,
          totalGuests: totalGuests || 0,
          openAlerts: openAlerts || 0,
          criticalAlerts: criticalAlerts || 0,
          totalRevenue,
        });

        setRecentCheckins((staysData as unknown as Stay[]) || []);
        setProperties((propertiesData as unknown as Property[]) || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const { activeProperties, totalProperties, activeStays, totalGuests, openAlerts, criticalAlerts, totalRevenue } = stats;

  const formattedRevenue = totalRevenue >= 1000000
    ? `${(totalRevenue / 1000000).toFixed(1)}M`
    : totalRevenue.toLocaleString('fr-FR');

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <>
        <Header title="Tableau de bord" />
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Chargement des données...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Tableau de bord" />

      <div className="space-y-8">
        {/* Critical Alerts Banner */}
        {criticalAlerts > 0 && (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-100 shrink-0">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div className="flex flex-col">
                <p className="text-gray-900 dark:text-white text-base font-bold leading-tight">
                  Attention Requise
                </p>
                <p className="text-gray-600 dark:text-red-200 text-sm font-normal leading-normal mt-1">
                  {criticalAlerts} alerte(s) de sécurité critique(s) signalée(s).
                </p>
              </div>
            </div>
            <Link
              href="/alerts"
              className="flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold leading-normal transition-colors shadow-sm"
            >
              <span className="truncate">Examiner les alertes</span>
            </Link>
          </div>
        )}

        {/* Overview Header */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center">
          <div>
            <h2 className="text-gray-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
              Vue d&apos;ensemble
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 capitalize">{today}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">
                Propriétés actives
              </p>
              <span className="material-symbols-outlined text-primary text-[24px]">domain</span>
            </div>
            <p className="text-gray-900 dark:text-white text-3xl font-bold leading-tight">
              {activeProperties.toLocaleString('fr-FR')}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs">
              sur {totalProperties.toLocaleString('fr-FR')} total
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">
                Séjours actifs
              </p>
              <span className="material-symbols-outlined text-primary text-[24px]">group</span>
            </div>
            <p className="text-gray-900 dark:text-white text-3xl font-bold leading-tight">
              {activeStays.toLocaleString('fr-FR')}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs">
              {totalGuests.toLocaleString('fr-FR')} voyageurs enregistrés
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">
                Alertes ouvertes
              </p>
              <span className="material-symbols-outlined text-red-500 text-[24px]">notifications_active</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-gray-900 dark:text-white text-3xl font-bold leading-tight">
                {openAlerts}
              </p>
              {criticalAlerts > 0 && (
                <span className="flex items-center text-red-500 text-xs font-bold bg-red-100 px-1.5 py-0.5 rounded mb-1">
                  {criticalAlerts} Critiques
                </span>
              )}
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-xs">Nécessite attention</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">
                Recettes TPT
              </p>
              <span className="material-symbols-outlined text-primary text-[24px]">payments</span>
            </div>
            <p className="text-gray-900 dark:text-white text-3xl font-bold leading-tight">
              {formattedRevenue} CFA
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs">Total collecté</p>
          </div>
        </div>

        {/* Map & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Map */}
          <div className="lg:col-span-2 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden h-[420px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <span className="material-symbols-outlined">travel_explore</span>
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight">
                    Carte des propriétés
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {properties.length} propriétés géolocalisées
                  </p>
                </div>
              </div>
              <Link
                href="/map"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                title="Plein écran"
              >
                <span className="material-symbols-outlined">fullscreen</span>
              </Link>
            </div>

            {/* Actual Map */}
            <div className="relative flex-1">
              <DashboardMap properties={properties} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col h-[420px]">
            <h3 className="text-gray-900 dark:text-white text-lg font-bold mb-4">Actions Rapides</h3>
            <div className="grid grid-cols-2 gap-4 flex-1">
              <Link
                href="/travelers"
                className="flex flex-col items-center justify-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-gray-700 hover:shadow-md transition-all group h-full"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">person_search</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                  Voyageurs
                </span>
              </Link>

              <Link
                href="/alerts"
                className="flex flex-col items-center justify-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-gray-700 hover:shadow-md transition-all group h-full"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">assignment_late</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                  Alertes
                </span>
              </Link>

              <Link
                href="/properties"
                className="flex flex-col items-center justify-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-gray-700 hover:shadow-md transition-all group h-full"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">domain</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                  Propriétés
                </span>
              </Link>

              <Link
                href="/intelligence"
                className="flex flex-col items-center justify-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-gray-700 hover:shadow-md transition-all group h-full"
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">insights</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center">
                  Intelligence
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Today's Arrivals Table */}
        <div className="flex flex-1 flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              <h3 className="text-gray-900 dark:text-white text-lg font-bold">Arrivées récentes</h3>
            </div>
            <Link href="/travelers" className="text-primary text-sm font-medium hover:underline">
              Voir tout
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Voyageur</th>
                  <th className="px-6 py-4">Propriété</th>
                  <th className="px-6 py-4">Ville</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentCheckins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Aucune arrivée récente
                    </td>
                  </tr>
                ) : (
                  recentCheckins.map((stay) => (
                    <tr key={stay.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 text-xs font-bold">
                            {stay.guests?.first_name?.[0] || '?'}{stay.guests?.last_name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {stay.guests?.first_name} {stay.guests?.last_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {stay.guests?.passport_number || stay.guests?.national_id_number || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                        {stay.properties?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {stay.properties?.city || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(stay.check_in).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          stay.status === 'active'
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : stay.status === 'pending'
                              ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            stay.status === 'active'
                              ? 'bg-green-600 dark:bg-green-400'
                              : stay.status === 'pending'
                                ? 'bg-yellow-600 dark:bg-yellow-400'
                                : 'bg-gray-600 dark:bg-gray-400'
                          }`} />
                          {stay.status === 'active' ? 'Actif' : stay.status === 'pending' ? 'En attente' : stay.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
