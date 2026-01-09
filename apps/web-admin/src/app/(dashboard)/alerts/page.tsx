'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  nationality: string;
  date_of_birth: string;
  phone: string | null;
  email: string | null;
  passport_number: string | null;
  national_id_number: string | null;
  id_document_type: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  registration_number: string | null;
  landlords?: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  } | null;
}

interface Stay {
  id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  room_number: string | null;
  num_guests: number;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  property_id: string | null;
  guest_id: string | null;
  stay_id: string | null;
  metadata: Record<string, unknown>;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  properties: Property | null;
  guests: Guest | null;
  stays: Stay | null;
}

interface Stats {
  total: number;
  open: number;
  investigating: number;
  critical: number;
  minorGuests: number;
}

const severityConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'Critique', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'error' },
  high: { label: 'Haute', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'warning' },
  medium: { label: 'Moyenne', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'info' },
  low: { label: 'Basse', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'check_circle' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  investigating: { label: 'En cours', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  resolved: { label: 'Résolu', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  dismissed: { label: 'Classé', color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  minor_guest: { label: 'Mineur', icon: 'child_care' },
  watchlist_match: { label: 'Liste de surveillance', icon: 'visibility' },
  unregistered_property: { label: 'Propriété non enregistrée', icon: 'home_work' },
  suspicious_activity: { label: 'Activité suspecte', icon: 'report' },
  tax_evasion: { label: 'Évasion fiscale', icon: 'money_off' },
  document_fraud: { label: 'Fraude documentaire', icon: 'assignment_late' },
  other: { label: 'Autre', icon: 'more_horiz' },
};

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, investigating: 0, critical: 0, minorGuests: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [updating, setUpdating] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Resolution modal
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<'resolved' | 'dismissed'>('resolved');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/alerts?${params.toString()}`);
      const data = await response.json();

      if (data.alerts) {
        setAlerts(data.alerts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const updateAlertStatus = async (alertId: string, newStatus: string, notes?: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: notes,
        }),
      });

      if (response.ok) {
        await fetchAlerts();
        if (selectedAlert?.id === alertId) {
          const data = await response.json();
          setSelectedAlert(data.alert);
        }
      }
    } catch (error) {
      console.error('Error updating alert:', error);
    } finally {
      setUpdating(false);
      setShowResolutionModal(false);
      setResolutionNotes('');
    }
  };

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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alertes</h1>
          <p className="text-gray-600 dark:text-gray-400">Centre de surveillance et gestion des alertes</p>
        </div>
        <button
          onClick={() => router.push('/alerts/create')}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nouvelle alerte
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          onClick={() => { setStatusFilter('all'); setSeverityFilter('critical'); }}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-4 text-left transition-all hover:shadow-md ${
            severityFilter === 'critical' ? 'ring-2 ring-red-500' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Critiques</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setStatusFilter('open'); setSeverityFilter('all'); }}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-4 text-left transition-all hover:shadow-md ${
            statusFilter === 'open' ? 'ring-2 ring-orange-500' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">notifications_active</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ouvertes</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.open}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setStatusFilter('investigating'); setSeverityFilter('all'); }}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-4 text-left transition-all hover:shadow-md ${
            statusFilter === 'investigating' ? 'ring-2 ring-yellow-500' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400">pending</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">En cours</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.investigating}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setTypeFilter('minor_guest'); setStatusFilter('all'); setSeverityFilter('all'); }}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-4 text-left transition-all hover:shadow-md ${
            typeFilter === 'minor_guest' ? 'ring-2 ring-blue-500' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">child_care</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mineurs</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.minorGuests}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setStatusFilter('all'); setSeverityFilter('all'); setTypeFilter('all'); }}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-4 text-left transition-all hover:shadow-md ${
            statusFilter === 'all' && severityFilter === 'all' && typeFilter === 'all' ? 'ring-2 ring-gray-500' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">list</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Critical Alert Banner */}
      {stats.critical > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400 animate-pulse">warning</span>
            </div>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">
                {stats.critical} alerte(s) critique(s) requièrent une attention immédiate
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Cliquez sur "Critiques" pour voir ces alertes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-10 pr-4 py-2 text-gray-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="open">Ouvert</option>
            <option value="investigating">En cours</option>
            <option value="resolved">Résolu</option>
            <option value="dismissed">Classé</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-primary focus:outline-none"
          >
            <option value="all">Toutes les sévérités</option>
            <option value="critical">Critique</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les types</option>
            <option value="minor_guest">Mineur</option>
            <option value="watchlist_match">Liste de surveillance</option>
            <option value="suspicious_activity">Activité suspecte</option>
            <option value="document_fraud">Fraude documentaire</option>
            <option value="unregistered_property">Propriété non enregistrée</option>
            <option value="tax_evasion">Évasion fiscale</option>
          </select>

          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Actualiser
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alerts List */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">notifications</span>
                Alertes ({alerts.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : alerts.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {alerts.map((alert) => {
                  const severity = severityConfig[alert.severity] || severityConfig.medium;
                  const status = statusConfig[alert.status] || statusConfig.open;
                  const type = typeConfig[alert.type] || typeConfig.other;

                  return (
                    <button
                      key={alert.id}
                      onClick={() => setSelectedAlert(alert)}
                      className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedAlert?.id === alert.id ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${severity.bg}`}>
                          <span className={`material-symbols-outlined ${severity.color}`}>{type.icon}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severity.bg} ${severity.color}`}>
                              {severity.label}
                            </span>
                            <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {type.label}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>

                          <h3 className="mt-1.5 font-medium text-gray-900 dark:text-white truncate">
                            {alert.title}
                          </h3>

                          {alert.guests && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {alert.guests.first_name} {alert.guests.last_name}
                              {alert.guests.date_of_birth && (
                                <span className="ml-1 text-gray-500">
                                  ({calculateAge(alert.guests.date_of_birth)} ans)
                                </span>
                              )}
                            </p>
                          )}

                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {alert.properties && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">hotel</span>
                                {alert.properties.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              {formatDate(alert.created_at)}
                            </span>
                          </div>
                        </div>

                        <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  check_circle
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Aucune alerte</p>
              </div>
            )}
          </div>
        </div>

        {/* Alert Details Panel */}
        <div className="lg:col-span-1">
          {selectedAlert ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-6">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Détails de l&apos;alerte</h3>
              </div>

              <div className="p-6 space-y-5 max-h-[calc(100vh-250px)] overflow-y-auto">
                {/* Alert Info */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityConfig[selectedAlert.severity]?.bg} ${severityConfig[selectedAlert.severity]?.color}`}>
                      {severityConfig[selectedAlert.severity]?.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[selectedAlert.status]?.bg} ${statusConfig[selectedAlert.status]?.color}`}>
                      {statusConfig[selectedAlert.status]?.label}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{selectedAlert.title}</h4>
                  {selectedAlert.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedAlert.description}</p>
                  )}
                </div>

                {/* Guest Info */}
                {selectedAlert.guests && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Voyageur concerné</p>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedAlert.guests.first_name} {selectedAlert.guests.last_name}
                      </p>
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {selectedAlert.guests.date_of_birth && (
                          <p className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">cake</span>
                            {calculateAge(selectedAlert.guests.date_of_birth)} ans
                            {calculateAge(selectedAlert.guests.date_of_birth) < 18 && (
                              <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-400">Mineur</span>
                            )}
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-gray-400">public</span>
                          {selectedAlert.guests.nationality}
                        </p>
                        {selectedAlert.guests.phone && (
                          <p className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">phone</span>
                            {selectedAlert.guests.phone}
                          </p>
                        )}
                        {selectedAlert.guests.passport_number && (
                          <p className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">badge</span>
                            {selectedAlert.guests.passport_number}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/guests?search=${selectedAlert.guests?.first_name}`)}
                        className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        Voir profil complet
                      </button>
                    </div>
                  </div>
                )}

                {/* Property Info */}
                {selectedAlert.properties && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hébergement</p>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-1">
                      <p className="font-medium text-gray-900 dark:text-white">{selectedAlert.properties.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {selectedAlert.properties.address}, {selectedAlert.properties.city}
                      </p>
                      {selectedAlert.properties.registration_number ? (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          {selectedAlert.properties.registration_number}
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Non enregistré
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Stay Info */}
                {selectedAlert.stays && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Séjour</p>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Check-in</span>
                        <span className="text-gray-900 dark:text-white">{formatDate(selectedAlert.stays.check_in)}</span>
                      </div>
                      {selectedAlert.stays.check_out && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Check-out</span>
                          <span className="text-gray-900 dark:text-white">{formatDate(selectedAlert.stays.check_out)}</span>
                        </div>
                      )}
                      {selectedAlert.stays.room_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Chambre</span>
                          <span className="text-gray-900 dark:text-white">{selectedAlert.stays.room_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Informations supplémentaires</p>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-sm">
                      {(selectedAlert.metadata as Record<string, string>).guardian_name && (
                        <div className="space-y-1">
                          <p className="text-gray-600 dark:text-gray-400">Accompagnateur:</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {(selectedAlert.metadata as Record<string, string>).guardian_name}
                          </p>
                          {(selectedAlert.metadata as Record<string, string>).guardian_phone && (
                            <p className="text-gray-600 dark:text-gray-300">
                              {(selectedAlert.metadata as Record<string, string>).guardian_phone}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resolution Notes */}
                {selectedAlert.resolution_notes && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Notes de résolution</p>
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
                      {selectedAlert.resolution_notes}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Chronologie</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      Créée: {formatDate(selectedAlert.created_at)}
                    </div>
                    {selectedAlert.resolved_at && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Résolue: {formatDate(selectedAlert.resolved_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {(selectedAlert.status === 'open' || selectedAlert.status === 'investigating') && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                    {selectedAlert.status === 'open' && (
                      <button
                        onClick={() => updateAlertStatus(selectedAlert.id, 'investigating')}
                        disabled={updating}
                        className="w-full rounded-lg bg-yellow-600 py-2.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">pending</span>
                        Prendre en charge
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setResolutionAction('resolved');
                          setShowResolutionModal(true);
                        }}
                        disabled={updating}
                        className="rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        Résoudre
                      </button>
                      <button
                        onClick={() => {
                          setResolutionAction('dismissed');
                          setShowResolutionModal(true);
                        }}
                        disabled={updating}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                        Classer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  notifications
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Sélectionnez une alerte pour voir les détails</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Modal */}
      {showResolutionModal && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {resolutionAction === 'resolved' ? 'Résoudre l\'alerte' : 'Classer l\'alerte'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes de résolution
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  placeholder="Décrivez les actions prises ou la raison du classement..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResolutionModal(false);
                    setResolutionNotes('');
                  }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Annuler
                </button>
                <button
                  onClick={() => updateAlertStatus(selectedAlert.id, resolutionAction, resolutionNotes)}
                  disabled={updating}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                    resolutionAction === 'resolved' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {updating ? 'En cours...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
