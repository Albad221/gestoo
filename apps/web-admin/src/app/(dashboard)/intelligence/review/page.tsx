'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface MatchReview {
  id: string;
  match_type: 'exact' | 'probable' | 'possible' | 'no_match';
  match_score: number;
  match_factors: Record<string, any>;
  status: string;
  created_at: string;
  scraped_listing: {
    id: string;
    platform: string;
    url: string;
    title: string;
    host_name: string;
    city: string;
    neighborhood: string;
    location_text: string;
    price_per_night: number;
    currency: string;
    bedrooms: number;
    max_guests: number;
    photos: string[];
    latitude: number;
    longitude: number;
  };
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    neighborhood: string;
    latitude: number;
    longitude: number;
    total_rooms: number;
    capacity_guests: number;
    landlord: {
      full_name: string;
      phone: string;
      email: string;
    }[];
  } | null;
}

export default function ReviewQueuePage() {
  const [reviews, setReviews] = useState<MatchReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<MatchReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({ total: 0, exact: 0, probable: 0, possible: 0, no_match: 0 });
  const [filter, setFilter] = useState<'all' | 'probable' | 'possible'>('all');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'pending', limit: '50' });
      if (filter !== 'all') {
        params.set('match_type', filter);
      }

      const response = await fetch(`/api/intelligence/reviews?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setStats(data.stats || { total: 0, exact: 0, probable: 0, possible: 0, no_match: 0 });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleDecision = async (decision: 'approved' | 'rejected' | 'escalated') => {
    if (!selectedReview) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/intelligence/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedReview.id,
          decision,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        setSelectedReview(null);
        setNotes('');
        loadReviews();
      } else {
        const data = await response.json();
        alert(data.error || 'Erreur lors de la soumission');
      }
    } catch (error) {
      alert('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'XOF') => {
    return new Intl.NumberFormat('fr-SN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'exact': return 'bg-green-100 text-green-800';
      case 'probable': return 'bg-blue-100 text-blue-800';
      case 'possible': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'exact': return 'Exact';
      case 'probable': return 'Probable';
      case 'possible': return 'Possible';
      default: return 'Non trouvé';
    }
  };

  const platformColors: Record<string, string> = {
    airbnb: 'bg-red-100 text-red-800',
    booking: 'bg-blue-100 text-blue-800',
    expat_dakar: 'bg-orange-100 text-orange-800',
    jumia_house: 'bg-purple-100 text-purple-800',
    coinafrique: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/intelligence"
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">File de Vérification</h1>
          </div>
          <p className="mt-1 text-gray-600">
            Vérifiez les correspondances entre annonces en ligne et propriétés enregistrées
          </p>
        </div>
        <button
          onClick={loadReviews}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">En attente</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-4 shadow-sm">
          <p className="text-sm text-blue-600">Probables</p>
          <p className="text-2xl font-bold text-blue-700">{stats.probable}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-4 shadow-sm">
          <p className="text-sm text-yellow-600">Possibles</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.possible}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4 shadow-sm">
          <p className="text-sm text-red-600">Non matchés</p>
          <p className="text-2xl font-bold text-red-700">{stats.no_match}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Tous' },
          { value: 'probable', label: 'Probables' },
          { value: 'possible', label: 'Possibles' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reviews List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Correspondances à vérifier</h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className={`w-full text-left rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md ${
                    selectedReview?.id === review.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platformColors[review.scraped_listing.platform] || platformColors.other}`}>
                          {review.scraped_listing.platform}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getMatchTypeColor(review.match_type)}`}>
                          {getMatchTypeLabel(review.match_type)}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 truncate">
                        {review.scraped_listing.title || 'Sans titre'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Hôte: {review.scraped_listing.host_name || 'Inconnu'} | {review.scraped_listing.city || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {Math.round(review.match_score * 100)}%
                      </p>
                      <p className="text-xs text-gray-500">Score</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Tout est vérifié !</h3>
              <p className="mt-2 text-gray-500">
                Aucune correspondance en attente de vérification.
              </p>
            </div>
          )}
        </div>

        {/* Review Detail */}
        <div className="lg:sticky lg:top-4">
          {selectedReview ? (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Détails de la Correspondance</h3>

              {/* Score Visualization */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Score de correspondance</span>
                  <span className={`text-2xl font-bold ${
                    selectedReview.match_score >= 0.8 ? 'text-green-600' :
                    selectedReview.match_score >= 0.6 ? 'text-blue-600' :
                    selectedReview.match_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {Math.round(selectedReview.match_score * 100)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${
                      selectedReview.match_score >= 0.8 ? 'bg-green-500' :
                      selectedReview.match_score >= 0.6 ? 'bg-blue-500' :
                      selectedReview.match_score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${selectedReview.match_score * 100}%` }}
                  />
                </div>
              </div>

              {/* Comparison Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Scraped Listing */}
                <div className="rounded-lg bg-red-50 p-4">
                  <h4 className="font-medium text-red-800 mb-2">Annonce en ligne</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Titre:</span> {selectedReview.scraped_listing.title}</p>
                    <p><span className="text-gray-500">Hôte:</span> {selectedReview.scraped_listing.host_name || 'Inconnu'}</p>
                    <p><span className="text-gray-500">Ville:</span> {selectedReview.scraped_listing.city}</p>
                    <p><span className="text-gray-500">Quartier:</span> {selectedReview.scraped_listing.neighborhood || '-'}</p>
                    <p><span className="text-gray-500">Prix:</span> {formatCurrency(selectedReview.scraped_listing.price_per_night || 0)}/nuit</p>
                    <p><span className="text-gray-500">Chambres:</span> {selectedReview.scraped_listing.bedrooms || '-'}</p>
                    <a
                      href={selectedReview.scraped_listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Voir l&apos;annonce
                    </a>
                  </div>
                </div>

                {/* Registered Property */}
                <div className="rounded-lg bg-green-50 p-4">
                  <h4 className="font-medium text-green-800 mb-2">Propriété enregistrée</h4>
                  {selectedReview.property ? (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-500">Nom:</span> {selectedReview.property.name}</p>
                      <p><span className="text-gray-500">Propriétaire:</span> {selectedReview.property.landlord?.[0]?.full_name || '-'}</p>
                      <p><span className="text-gray-500">Ville:</span> {selectedReview.property.city}</p>
                      <p><span className="text-gray-500">Quartier:</span> {selectedReview.property.neighborhood || '-'}</p>
                      <p><span className="text-gray-500">Adresse:</span> {selectedReview.property.address || '-'}</p>
                      <p><span className="text-gray-500">Chambres:</span> {selectedReview.property.total_rooms || '-'}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Aucune propriété correspondante trouvée</p>
                  )}
                </div>
              </div>

              {/* Match Factors */}
              {selectedReview.match_factors && Object.keys(selectedReview.match_factors).length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Facteurs de correspondance</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selectedReview.match_factors).map(([key, value]) => (
                      <div key={key} className="flex justify-between bg-gray-50 rounded px-3 py-2">
                        <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium">
                          {typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Ajoutez des notes pour cette décision..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmer
                </button>
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Rejeter
                </button>
                <button
                  onClick={() => handleDecision('escalated')}
                  disabled={submitting}
                  className="rounded-lg bg-yellow-100 px-4 py-3 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              <p className="mt-4 text-xs text-gray-500 text-center">
                <strong>Confirmer:</strong> La propriété est bien enregistrée |
                <strong> Rejeter:</strong> Propriété non enregistrée (crée une alerte) |
                <strong> Escalader:</strong> Besoin d&apos;investigation
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Sélectionnez une correspondance</h3>
              <p className="mt-2 text-gray-500">
                Cliquez sur une correspondance pour voir les détails et prendre une décision.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
