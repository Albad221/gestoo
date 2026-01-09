'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ScrapedListing {
  id: string;
  platform: string;
  platform_id: string;
  url: string;
  title: string;
  description: string;
  price: number;
  price_per_night?: number;
  currency: string;
  location_text: string;
  city: string;
  region?: string;
  neighborhood?: string;
  host_name: string;
  bedrooms?: number;
  num_rooms?: number;
  max_guests?: number;
  num_guests?: number;
  photos: string[];
  amenities: string[];
  rating: number;
  review_count?: number;
  num_reviews?: number;
  is_active?: boolean;
  matched_property_id: string | null;
  is_compliant: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

interface ScrapeStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  unmatched: number;
  byPlatform: Record<string, number>;
  byCity: Record<string, number>;
}

export default function IntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [stats, setStats] = useState<ScrapeStats | null>(null);
  const [recentNonCompliant, setRecentNonCompliant] = useState<ScrapedListing[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'scrape' | 'batch' | 'listings'>('overview');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [allListings, setAllListings] = useState<ScrapedListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'compliant' | 'non-compliant'>('all');
  // Batch scrape state
  const [platforms, setPlatforms] = useState<{id: string; name: string; difficulty: string}[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedCity, setSelectedCity] = useState('Dakar');
  const [batchScraping, setBatchScraping] = useState(false);
  const [scrapeJobs, setScrapeJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/intelligence/scrape');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentNonCompliant(data.recentNonCompliant || []);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load batch scrape options
  const loadBatchOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/intelligence/batch-scrape');
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms || []);
        setCities(data.cities || []);
        if (data.platforms?.length > 0 && !selectedPlatform) {
          setSelectedPlatform(data.platforms[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading batch options:', error);
    }
  }, [selectedPlatform]);

  // Load scrape jobs
  const loadScrapeJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const response = await fetch('/api/intelligence/jobs?limit=10');
      if (response.ok) {
        const data = await response.json();
        setScrapeJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Trigger batch scrape
  const handleBatchScrape = async () => {
    if (!selectedPlatform) return;
    setBatchScraping(true);
    try {
      const response = await fetch('/api/intelligence/batch-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          city: selectedCity,
          maxPages: 3,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        loadScrapeJobs();
        alert(`Job créé pour ${selectedPlatform} à ${selectedCity}. Vérifiez que le service scraper est en marche.`);
      } else {
        alert(data.error || 'Erreur lors de la création du job');
      }
    } catch (error) {
      alert('Erreur réseau');
    } finally {
      setBatchScraping(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'batch') {
      loadBatchOptions();
      loadScrapeJobs();
    }
  }, [activeTab, loadBatchOptions, loadScrapeJobs]);

  const loadAllListings = async () => {
    setListingsLoading(true);
    try {
      const response = await fetch('/api/intelligence/listings');
      if (response.ok) {
        const data = await response.json();
        setAllListings(data.listings || []);
      }
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'listings' && allListings.length === 0) {
      loadAllListings();
    }
  }, [activeTab, allListings.length]);

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;

    setScraping(true);
    setScrapeResult(null);
    setScrapeError(null);

    try {
      const response = await fetch('/api/intelligence/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setScrapeResult(data);
        setScrapeUrl('');
        // Reload stats
        loadStats();
        // Reload listings if on that tab
        if (activeTab === 'listings') {
          loadAllListings();
        }
      } else {
        setScrapeError(data.error || 'Failed to scrape URL');
      }
    } catch (error) {
      setScrapeError('Network error. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'XOF') => {
    return new Intl.NumberFormat('fr-SN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const platformColors: Record<string, string> = {
    airbnb: 'bg-red-100 text-red-800',
    booking: 'bg-blue-100 text-blue-800',
    expedia: 'bg-yellow-100 text-yellow-800',
    vrbo: 'bg-purple-100 text-purple-800',
    tripadvisor: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
  };

  const filteredListings = allListings.filter((l) => {
    if (filter === 'compliant') return l.is_compliant;
    if (filter === 'non-compliant') return !l.is_compliant;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intelligence Marché</h1>
          <p className="text-gray-600">
            Détection automatique des hébergements non enregistrés via IA
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/intelligence/review"
            className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            File de Vérification
          </Link>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Vue Générale', icon: '📊' },
            { id: 'batch', label: 'Scraping Auto', icon: '🤖' },
            { id: 'scrape', label: 'Scanner URL', icon: '🔍' },
            { id: 'listings', label: 'Annonces', icon: '📋' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : stats ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-3">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Annonces Scannées</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-3">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conformes</p>
                      <p className="text-2xl font-bold text-green-600">{stats.compliant}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-100 p-3">
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Non Enregistrés</p>
                      <p className="text-2xl font-bold text-red-600">{stats.nonCompliant}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-yellow-100 p-3">
                      <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Non Matchés</p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.unmatched}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Rate */}
              {stats.total > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold">Taux de Conformité Global</h3>
                  <div className="flex items-center gap-4">
                    <div className="h-4 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${(stats.compliant / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className={`text-2xl font-bold ${
                      (stats.compliant / stats.total) >= 0.7 ? 'text-green-600' :
                      (stats.compliant / stats.total) >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {((stats.compliant / stats.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Platform & City Breakdown */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold">Par Plateforme</h3>
                  {Object.keys(stats.byPlatform).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.byPlatform).map(([platform, count]) => (
                        <div key={platform} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${platformColors[platform] || platformColors.other}`}>
                              {platform}
                            </span>
                          </div>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucune donnée disponible</p>
                  )}
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold">Par Ville</h3>
                  {Object.keys(stats.byCity).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.byCity)
                        .sort(([, a], [, b]) => b - a)
                        .map(([city, count]) => (
                          <div key={city} className="flex items-center justify-between">
                            <span className="text-gray-700">{city || 'Non spécifié'}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucune donnée disponible</p>
                  )}
                </div>
              </div>

              {/* Recent Non-Compliant */}
              {recentNonCompliant.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-red-600">
                    Dernières Annonces Non Enregistrées
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-sm text-gray-500">
                          <th className="pb-3">Plateforme</th>
                          <th className="pb-3">Titre</th>
                          <th className="pb-3">Hôte</th>
                          <th className="pb-3">Ville</th>
                          <th className="pb-3">Prix/Nuit</th>
                          <th className="pb-3">Détecté le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentNonCompliant.map((listing) => (
                          <tr key={listing.id} className="border-b hover:bg-gray-50">
                            <td className="py-3">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${platformColors[listing.platform] || platformColors.other}`}>
                                {listing.platform}
                              </span>
                            </td>
                            <td className="py-3">
                              <a
                                href={listing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {listing.title?.substring(0, 50)}...
                              </a>
                            </td>
                            <td className="py-3">{listing.host_name || 'Inconnu'}</td>
                            <td className="py-3">{listing.city || '-'}</td>
                            <td className="py-3 font-medium">
                              {formatCurrency(listing.price || listing.price_per_night || 0, listing.currency)}
                            </td>
                            <td className="py-3 text-sm text-gray-500">
                              {formatDate(listing.first_seen_at || listing.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune donnée</h3>
              <p className="mt-2 text-gray-500">
                Commencez par scanner des URLs d&apos;annonces Airbnb ou Booking.com
              </p>
              <button
                onClick={() => setActiveTab('scrape')}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Scanner une URL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Batch Scrape Tab */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          {/* Batch Scrape Controls */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Scraping Automatique par Plateforme</h3>
            <p className="mb-4 text-gray-600">
              Lancez un scan automatique sur une plateforme entière. Le scraper va parcourir les annonces
              et les comparer avec les propriétés enregistrées.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plateforme</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  disabled={batchScraping}
                >
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.difficulty === 'easy' ? 'Facile' : p.difficulty === 'medium' ? 'Moyen' : 'Difficile'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  disabled={batchScraping}
                >
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleBatchScrape}
                  disabled={batchScraping || !selectedPlatform}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {batchScraping ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Lancement...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Lancer Scrape
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Platform Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-gray-600">Facile: Expat-Dakar, Jumia, CoinAfrique</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-gray-600">Moyen: Booking.com (proxy recommandé)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-gray-600">Difficile: Airbnb (anti-bot)</span>
              </div>
            </div>
          </div>

          {/* Jobs History */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Historique des Jobs</h3>
              <button
                onClick={loadScrapeJobs}
                disabled={jobsLoading}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {jobsLoading ? 'Chargement...' : 'Actualiser'}
              </button>
            </div>

            {scrapeJobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3">Plateforme</th>
                      <th className="pb-3">Statut</th>
                      <th className="pb-3">Ville</th>
                      <th className="pb-3">Trouvés</th>
                      <th className="pb-3">Nouveaux</th>
                      <th className="pb-3">Démarré</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapeJobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${platformColors[job.platform] || platformColors.other}`}>
                            {job.platform}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                            job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {job.status === 'completed' ? 'Terminé' :
                             job.status === 'running' ? 'En cours' :
                             job.status === 'failed' ? 'Échoué' : 'En attente'}
                          </span>
                        </td>
                        <td className="py-3 text-sm">{job.target_params?.city || '-'}</td>
                        <td className="py-3 font-medium">{job.listings_found || 0}</td>
                        <td className="py-3 text-green-600">{job.listings_new || 0}</td>
                        <td className="py-3 text-sm text-gray-500">
                          {job.started_at ? formatDate(job.started_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucun job récent</p>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
            <h4 className="font-medium text-blue-900 mb-2">Comment ça marche ?</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Sélectionnez une plateforme et une ville</li>
              <li>Cliquez sur &quot;Lancer Scrape&quot; pour créer un job</li>
              <li>Le service scraper doit être en marche pour traiter les jobs</li>
              <li>Les annonces trouvées seront automatiquement comparées aux propriétés enregistrées</li>
              <li>Les propriétés non conformes génèrent des alertes</li>
            </ol>
            <p className="mt-3 text-sm text-blue-700">
              <strong>Note:</strong> Pour lancer le service scraper, exécutez: <code className="bg-blue-100 px-1 rounded">cd services/scraper-service && npm start</code>
            </p>
          </div>
        </div>
      )}

      {/* Scrape Tab */}
      {activeTab === 'scrape' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Scanner une Annonce</h3>
            <p className="mb-4 text-gray-600">
              Entrez l&apos;URL d&apos;une annonce Airbnb, Booking.com ou autre plateforme de location.
              L&apos;IA va extraire les informations et vérifier si la propriété est enregistrée.
            </p>

            <div className="flex gap-3">
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://www.airbnb.fr/rooms/123456789"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={scraping}
              />
              <button
                onClick={handleScrape}
                disabled={scraping || !scrapeUrl.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {scraping ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Scanner
                  </>
                )}
              </button>
            </div>

            {/* Supported Platforms */}
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <span>Plateformes supportées:</span>
              <span className={platformColors.airbnb + ' rounded px-2 py-0.5'}>Airbnb</span>
              <span className={platformColors.booking + ' rounded px-2 py-0.5'}>Booking</span>
              <span className={platformColors.vrbo + ' rounded px-2 py-0.5'}>VRBO</span>
              <span className={platformColors.expedia + ' rounded px-2 py-0.5'}>Expedia</span>
            </div>
          </div>

          {/* Error */}
          {scrapeError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700">{scrapeError}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {scrapeResult && (
            <div className={`rounded-xl border p-6 ${scrapeResult.match?.isCompliant ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start gap-4">
                <div className={`rounded-full p-3 ${scrapeResult.match?.isCompliant ? 'bg-green-100' : 'bg-red-100'}`}>
                  {scrapeResult.match?.isCompliant ? (
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1">
                  <h4 className={`text-lg font-semibold ${scrapeResult.match?.isCompliant ? 'text-green-800' : 'text-red-800'}`}>
                    {scrapeResult.match?.isCompliant ? 'Propriété Enregistrée' : 'Propriété Non Enregistrée'}
                  </h4>

                  {scrapeResult.listing && (
                    <div className="mt-4 space-y-2">
                      <p><strong>Titre:</strong> {scrapeResult.listing.title}</p>
                      <p><strong>Hôte:</strong> {scrapeResult.listing.host_name || 'Non spécifié'}</p>
                      <p><strong>Localisation:</strong> {scrapeResult.listing.city}, {scrapeResult.listing.region || scrapeResult.listing.neighborhood}</p>
                      <p><strong>Prix:</strong> {formatCurrency(scrapeResult.listing.price || scrapeResult.listing.price_per_night || 0, scrapeResult.listing.currency)}/nuit</p>
                      <p><strong>Chambres:</strong> {scrapeResult.listing.bedrooms || scrapeResult.listing.num_rooms || 0} | <strong>Capacité:</strong> {scrapeResult.listing.max_guests || scrapeResult.listing.num_guests || 0} personnes</p>

                      {scrapeResult.match?.matchedPropertyId && (
                        <p className="mt-2 rounded bg-green-100 px-3 py-2 text-green-800">
                          Correspondance trouvée (confiance: {scrapeResult.match.confidence}%)
                        </p>
                      )}

                      {!scrapeResult.match?.isCompliant && scrapeResult.isNew && (
                        <p className="mt-2 rounded bg-red-100 px-3 py-2 text-red-800">
                          ⚠️ Une alerte a été créée pour cette propriété non enregistrée
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Example URLs */}
          <div className="rounded-xl bg-gray-50 p-6">
            <h4 className="mb-3 font-medium text-gray-700">Exemples d&apos;URLs à scanner</h4>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">• https://www.airbnb.fr/rooms/12345678 - Annonce Airbnb</p>
              <p className="text-gray-600">• https://www.booking.com/hotel/sn/nom-hotel.html - Booking.com</p>
              <p className="text-gray-600">• https://www.vrbo.com/123456 - VRBO</p>
            </div>
          </div>
        </div>
      )}

      {/* All Listings Tab */}
      {activeTab === 'listings' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-gray-300 bg-white">
              {[
                { value: 'all', label: 'Toutes' },
                { value: 'compliant', label: 'Conformes' },
                { value: 'non-compliant', label: 'Non Conformes' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value as any)}
                  className={`px-4 py-2 text-sm font-medium ${
                    filter === option.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  } ${option.value === 'all' ? 'rounded-l-lg' : ''} ${option.value === 'non-compliant' ? 'rounded-r-lg' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-500">
              {filteredListings.length} annonce{filteredListings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Listings Table */}
          {listingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : filteredListings.length > 0 ? (
            <div className="rounded-xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="p-4">Statut</th>
                      <th className="p-4">Plateforme</th>
                      <th className="p-4">Titre</th>
                      <th className="p-4">Hôte</th>
                      <th className="p-4">Ville</th>
                      <th className="p-4">Prix</th>
                      <th className="p-4">Chambres</th>
                      <th className="p-4">Note</th>
                      <th className="p-4">Détecté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((listing) => (
                      <tr key={listing.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          {listing.is_compliant ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Conforme
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Non Conforme
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${platformColors[listing.platform] || platformColors.other}`}>
                            {listing.platform}
                          </span>
                        </td>
                        <td className="max-w-xs p-4">
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-blue-600 hover:underline"
                            title={listing.title}
                          >
                            {listing.title}
                          </a>
                        </td>
                        <td className="p-4">{listing.host_name || '-'}</td>
                        <td className="p-4">{listing.city || '-'}</td>
                        <td className="p-4 font-medium">
                          {formatCurrency(listing.price || listing.price_per_night || 0, listing.currency)}
                        </td>
                        <td className="p-4">{listing.bedrooms || listing.num_rooms || '-'}</td>
                        <td className="p-4">
                          {listing.rating > 0 ? (
                            <span className="flex items-center gap-1">
                              <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              {listing.rating.toFixed(1)}
                              {(listing.review_count || listing.num_reviews || 0) > 0 && (
                                <span className="text-gray-400">({listing.review_count || listing.num_reviews})</span>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {formatDate(listing.first_seen_at || listing.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune annonce</h3>
              <p className="mt-2 text-gray-500">
                Scannez des URLs pour commencer à détecter les propriétés non enregistrées.
              </p>
              <button
                onClick={() => setActiveTab('scrape')}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Scanner une URL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
