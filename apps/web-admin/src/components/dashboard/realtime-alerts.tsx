'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: string;
  created_at: string;
  metadata?: Record<string, any>;
}

const severityConfig: Record<string, { label: string; className: string; bgClassName: string }> = {
  critical: {
    label: 'Critique',
    className: 'text-red-800',
    bgClassName: 'bg-red-100',
  },
  high: {
    label: 'Haute',
    className: 'text-orange-800',
    bgClassName: 'bg-orange-100',
  },
  medium: {
    label: 'Moyenne',
    className: 'text-yellow-800',
    bgClassName: 'bg-yellow-100',
  },
  low: {
    label: 'Basse',
    className: 'text-green-800',
    bgClassName: 'bg-green-100',
  },
};

const typeLabels: Record<string, string> = {
  minor_protection: 'Protection Mineur',
  suspicious_activity: 'Activite Suspecte',
  compliance: 'Non-conformite',
  fraud: 'Fraude',
};

export function RealtimeAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial alerts
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setAlerts(data);
      }
    };

    fetchAlerts();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('alerts-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev.slice(0, 9)]);
          setNewAlertCount((prev) => prev + 1);

          // Play sound for critical/high alerts
          if (newAlert.severity === 'critical' || newAlert.severity === 'high') {
            playAlertSound();
          }

          // Show browser notification
          showNotification(newAlert);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'alerts',
        },
        (payload) => {
          const updatedAlert = payload.new as Alert;
          setAlerts((prev) =>
            prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playAlertSound = () => {
    try {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch {
      // Ignore audio errors
    }
  };

  const showNotification = (alert: Alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Alerte ${severityConfig[alert.severity]?.label}`, {
        body: alert.description.slice(0, 100) + '...',
        icon: '/favicon.ico',
        tag: alert.id,
      });
    }
  };

  const handlePanelOpen = () => {
    setShowPanel(true);
    setNewAlertCount(0);
  };

  const criticalCount = alerts.filter(
    (a) => a.status === 'open' && (a.severity === 'critical' || a.severity === 'high')
  ).length;

  return (
    <>
      {/* Alert Bell Button */}
      <button
        onClick={handlePanelOpen}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Connection indicator */}
        <span
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />

        {/* New alert badge */}
        {newAlertCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
            {newAlertCount > 9 ? '9+' : newAlertCount}
          </span>
        )}

        {/* Critical badge */}
        {criticalCount > 0 && newAlertCount === 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {criticalCount}
          </span>
        )}
      </button>

      {/* Slide-out Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-xl animate-slide-in">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">Alertes en temps reel</h2>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={isConnected ? 'Connecte' : 'Deconnecte'}
                  />
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Alerts List */}
              <div className="flex-1 overflow-y-auto">
                {alerts.length > 0 ? (
                  <div className="divide-y">
                    {alerts.map((alert) => {
                      const severity = severityConfig[alert.severity] || severityConfig.low;
                      return (
                        <Link
                          key={alert.id}
                          href={`/alerts?id=${alert.id}`}
                          onClick={() => setShowPanel(false)}
                          className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${severity.bgClassName}`}
                            >
                              <svg
                                className={`h-4 w-4 ${severity.className}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${severity.bgClassName} ${severity.className}`}
                                >
                                  {severity.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {typeLabels[alert.type] || alert.type}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-900 line-clamp-2">
                                {alert.description}
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(alert.created_at).toLocaleString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-2">Aucune alerte active</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t p-4">
                <Link
                  href="/alerts"
                  onClick={() => setShowPanel(false)}
                  className="block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Voir toutes les alertes
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSS for animation */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
