'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';

// Dynamic import for map (SSR disabled)
const HotelsMap = dynamic(() => import('@/components/map/hotels-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  ),
});

interface Property {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  region: string;
  status: string;
  registration_number: string | null;
  created_at: string;
  // Required validation fields
  num_rooms: number | null;
  num_beds: number | null;
  star_rating: number | null;
  ninea: string | null;
  tax_id: string | null;
  has_fire_certificate: boolean;
  has_health_certificate: boolean;
  has_insurance: boolean;
  photos_url: string[] | null;
  latitude: number | null;
  longitude: number | null;
  // Rejection fields
  rejection_reason: string | null;
  rejected_at: string | null;
  // Source tracking
  source: 'registered' | 'scraped';
  // Scraped-specific fields
  rating?: number | null;
  num_reviews?: number | null;
  url?: string;
  phone?: string | null;
  website?: string | null;
  landlords: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    national_id: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Demande d\'homologation', className: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspendue', className: 'bg-red-100 text-red-800' },
  rejected: { label: 'Rejetee', className: 'bg-gray-100 text-gray-800' },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  hotel: { label: 'Hôtel', icon: 'hotel' },
  apartment: { label: 'Appartement meublé', icon: 'apartment' },
  villa: { label: 'Villa', icon: 'villa' },
  guesthouse: { label: "Maison d'hôtes", icon: 'cottage' },
  residence: { label: 'Résidence de tourisme', icon: 'domain' },
  lodge: { label: 'Lodge / Campement', icon: 'cabin' },
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'registered' | 'scraped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'split'>('list');
  const [stats, setStats] = useState({ registered: 0, scraped: 0, withPhone: 0, cities: 0 });

  useEffect(() => {
    fetchProperties();
  }, [statusFilter, typeFilter, sourceFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch registered properties
      let registeredQuery = supabase
        .from('properties')
        .select(`
          *,
          landlords (
            first_name,
            last_name,
            phone,
            email,
            national_id
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        registeredQuery = registeredQuery.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        registeredQuery = registeredQuery.eq('type', typeFilter);
      }

      // Fetch scraped listings via API (to bypass RLS)
      // Don't fetch scraped listings when viewing pending (homologation requests) or rejected
      const shouldFetchScraped = sourceFilter !== 'registered' &&
        statusFilter !== 'pending' && statusFilter !== 'rejected';
      const scrapedPromise = shouldFetchScraped
        ? fetch('/api/etablissements').then(res => res.json()).then(data => ({ hotels: data.hotels || [] }))
        : Promise.resolve({ hotels: [] });

      const [registeredResult, scrapedResult] = await Promise.all([
        sourceFilter !== 'scraped' ? registeredQuery.limit(100) : Promise.resolve({ data: [] }),
        scrapedPromise,
      ]);

      // Transform registered properties
      const registeredProperties: Property[] = ((registeredResult.data || []) as any[]).map((p) => ({
        ...p,
        source: 'registered' as const,
      }));

      // Transform scraped listings to match Property interface
      const scrapedProperties: Property[] = ((scrapedResult.hotels || []) as any[]).map((h) => ({
        id: h.id,
        name: h.title,
        type: h.raw_data?.property_type || 'hotel',
        address: h.address || h.raw_data?.formatted_address || '',
        city: h.city || '',
        region: '',
        status: 'active',
        registration_number: null,
        created_at: h.created_at,
        num_rooms: null,
        num_beds: null,
        star_rating: null,
        ninea: null,
        tax_id: null,
        has_fire_certificate: false,
        has_health_certificate: false,
        has_insurance: false,
        photos_url: h.photos || [],
        latitude: h.latitude,
        longitude: h.longitude,
        rejection_reason: null,
        rejected_at: null,
        source: 'scraped' as const,
        rating: h.rating,
        num_reviews: h.num_reviews,
        url: h.url,
        phone: h.raw_data?.phone || null,
        website: h.raw_data?.website || null,
        landlords: null,
      }));

      // Combine and filter based on source
      let allProperties: Property[] = [];
      if (sourceFilter === 'all') {
        allProperties = [...registeredProperties, ...scrapedProperties];
      } else if (sourceFilter === 'registered') {
        allProperties = registeredProperties;
      } else {
        allProperties = scrapedProperties;
      }

      setProperties(allProperties);

      // Calculate stats
      const uniqueCities = new Set(allProperties.map(p => p.city).filter(Boolean));
      const withPhone = allProperties.filter(p => p.phone || p.landlords?.phone).length;
      setStats({
        registered: registeredProperties.length,
        scraped: scrapedProperties.length,
        withPhone,
        cities: uniqueCities.size,
      });
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (propertyId: string) => {
    setActionLoading(true);
    const supabase = createClient();

    try {
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
      const registrationNumber = `TRG-${year}-${random}`;

      await supabase
        .from('properties')
        .update({
          status: 'active',
          registration_number: registrationNumber,
        })
        .eq('id', propertyId);

      fetchProperties();
      setSelectedProperty(null);
    } catch (err) {
      console.error('Error approving property:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (propertyId: string) => {
    const reason = rejectReason === 'other' ? customReason : rejectReason;
    if (!reason) return;

    setActionLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from('properties')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejected_at: new Date().toISOString()
        })
        .eq('id', propertyId);

      fetchProperties();
      setSelectedProperty(null);
      setShowRejectModal(false);
      setRejectReason('');
      setCustomReason('');
    } catch (err) {
      console.error('Error rejecting property:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectionReasons = [
    { value: 'documents_incomplets', label: 'Documents incomplets ou manquants' },
    { value: 'ninea_invalide', label: 'NINEA invalide ou non vérifié' },
    { value: 'adresse_incorrecte', label: 'Adresse incorrecte ou non vérifiable' },
    { value: 'certificats_manquants', label: 'Certificats de sécurité/sanitaire manquants' },
    { value: 'assurance_expiree', label: 'Assurance expirée ou non valide' },
    { value: 'proprietaire_non_identifie', label: 'Propriétaire non identifié (CNI manquante)' },
    { value: 'non_conforme_reglementation', label: 'Non conforme à la réglementation en vigueur' },
    { value: 'photos_insuffisantes', label: 'Photos insuffisantes ou de mauvaise qualité' },
    { value: 'other', label: 'Autre raison (préciser)' },
  ];

  const handleSuspend = async (propertyId: string) => {
    setActionLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from('properties')
        .update({ status: 'suspended' })
        .eq('id', propertyId);

      fetchProperties();
      setSelectedProperty(null);
    } catch (err) {
      console.error('Error suspending property:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProperties = properties.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.city.toLowerCase().includes(query) ||
      p.registration_number?.toLowerCase().includes(query) ||
      p.landlords?.first_name.toLowerCase().includes(query) ||
      p.landlords?.last_name.toLowerCase().includes(query)
    );
  });

  const pendingCount = properties.filter(p => p.status === 'pending').length;
  const typeCounts = properties.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Check if property has all required documents
  const getComplianceScore = (property: Property) => {
    let score = 0;
    let total = 6;
    if (property.ninea) score++;
    if (property.tax_id) score++;
    if (property.has_fire_certificate) score++;
    if (property.has_health_certificate) score++;
    if (property.has_insurance) score++;
    if (property.landlords?.national_id) score++;
    return { score, total, percentage: Math.round((score / total) * 100) };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Propriétés</h1>
          <p className="text-gray-600 dark:text-gray-400">Vérification et gestion des hébergements</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">
              {pendingCount}
            </span>
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              propriété(s) en attente de vérification
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setSourceFilter('registered')}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
            sourceFilter === 'registered' ? 'ring-2 ring-primary border-primary' : 'border-gray-200 dark:border-gray-700'
          } bg-white dark:bg-gray-800`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400">verified</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enregistrées</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.registered}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSourceFilter('scraped')}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
            sourceFilter === 'scraped' ? 'ring-2 ring-primary border-primary' : 'border-gray-200 dark:border-gray-700'
          } bg-white dark:bg-gray-800`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">travel_explore</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Découvertes</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.scraped}</p>
            </div>
          </div>
        </button>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">location_city</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Villes</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.cities}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSourceFilter('all')}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
            sourceFilter === 'all' ? 'ring-2 ring-primary border-primary' : 'border-gray-200 dark:border-gray-700'
          } bg-white dark:bg-gray-800`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">domain</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.registered + stats.scraped}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom, ville, numéro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Catégorie:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="all">Toutes ({properties.length})</option>
            {Object.entries(typeConfig).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label} ({typeCounts[value] || 0})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-800">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">list</span>
            Liste
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
              viewMode === 'map'
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Carte
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
              viewMode === 'split'
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">vertical_split</span>
            Mixte
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { value: 'all', label: 'Toutes' },
          { value: 'pending', label: 'Demandes d\'homologation' },
          { value: 'active', label: 'Homologuées' },
          { value: 'suspended', label: 'Suspendues' },
          { value: 'rejected', label: 'Rejetées' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as typeof statusFilter)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" style={{ height: '600px' }}>
          <HotelsMap
            hotels={filteredProperties.map(p => ({
              id: p.id,
              title: p.name,
              city: p.city,
              latitude: p.latitude,
              longitude: p.longitude,
              rating: p.rating || null,
              num_reviews: p.num_reviews || null,
              raw_data: { phone: p.phone, property_type: p.type },
            }))}
            selectedHotel={selectedProperty ? {
              id: selectedProperty.id,
              title: selectedProperty.name,
              city: selectedProperty.city,
              latitude: selectedProperty.latitude,
              longitude: selectedProperty.longitude,
              rating: selectedProperty.rating || null,
              num_reviews: selectedProperty.num_reviews || null,
              raw_data: { phone: selectedProperty.phone, property_type: selectedProperty.type },
            } : null}
            onSelectHotel={(hotel) => {
              const prop = filteredProperties.find(p => p.id === hotel.id);
              if (prop) setSelectedProperty(prop);
            }}
          />
        </div>
      )}

      {/* Properties Grid */}
      {viewMode !== 'map' && (
      <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {/* Map Panel for Split View */}
        {viewMode === 'split' && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" style={{ height: '700px' }}>
            <HotelsMap
              hotels={filteredProperties.map(p => ({
                id: p.id,
                title: p.name,
                city: p.city,
                latitude: p.latitude,
                longitude: p.longitude,
                rating: p.rating || null,
                num_reviews: p.num_reviews || null,
                raw_data: { phone: p.phone, property_type: p.type },
              }))}
              selectedHotel={selectedProperty ? {
                id: selectedProperty.id,
                title: selectedProperty.name,
                city: selectedProperty.city,
                latitude: selectedProperty.latitude,
                longitude: selectedProperty.longitude,
                rating: selectedProperty.rating || null,
                num_reviews: selectedProperty.num_reviews || null,
                raw_data: { phone: selectedProperty.phone, property_type: selectedProperty.type },
              } : null}
              onSelectHotel={(hotel) => {
                const prop = filteredProperties.find(p => p.id === hotel.id);
                if (prop) setSelectedProperty(prop);
              }}
            />
          </div>
        )}

        {/* Properties List */}
        <div className={viewMode === 'split' ? '' : 'lg:col-span-2'}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredProperties.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[700px] overflow-y-auto">
                {filteredProperties.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedProperty(property)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedProperty?.id === property.id ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-lg ${
                          property.source === 'scraped' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          property.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                          property.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' :
                          'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <span className={`material-symbols-outlined text-[20px] ${
                            property.source === 'scraped' ? 'text-blue-600 dark:text-blue-400' :
                            property.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                            property.status === 'active' ? 'text-green-600 dark:text-green-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {property.source === 'scraped' ? 'travel_explore' : (typeConfig[property.type]?.icon || 'home')}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 dark:text-white">{property.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              property.source === 'scraped'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : statusConfig[property.status]?.className
                            }`}>
                              {property.source === 'scraped' ? 'Découverte' : statusConfig[property.status]?.label}
                            </span>
                            {property.source === 'registered' && property.registration_number && (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Enregistrée
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {typeConfig[property.type]?.label || property.type} - {property.city}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {property.source === 'scraped' && property.rating && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-yellow-500">star</span>
                                {property.rating.toFixed(1)} ({property.num_reviews} avis)
                              </span>
                            )}
                            {property.source === 'registered' && property.landlords && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {property.landlords.first_name} {property.landlords.last_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(property.created_at).toLocaleDateString('fr-FR')}
                        </p>
                        {property.registration_number && (
                          <p className="text-xs font-mono text-green-600 dark:text-green-400 mt-1">
                            {property.registration_number}
                          </p>
                        )}
                        {property.source === 'scraped' && !property.registration_number && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1 justify-end">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Non enregistrée
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  domain_disabled
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Aucune propriété trouvée</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedProperty ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-6 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Détails</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[selectedProperty.status]?.className}`}>
                  {statusConfig[selectedProperty.status]?.label}
                </span>
              </div>

              <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Property Info */}
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedProperty.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">{typeConfig[selectedProperty.type]?.icon || 'home'}</span>
                    {typeConfig[selectedProperty.type]?.label || selectedProperty.type}
                    {selectedProperty.star_rating && (
                      <span className="ml-2 flex items-center">
                        {[...Array(selectedProperty.star_rating)].map((_, i) => (
                          <span key={i} className="material-symbols-outlined text-[14px] text-yellow-500">star</span>
                        ))}
                      </span>
                    )}
                  </p>
                </div>

                {/* Source Badge */}
                <div className={`rounded-lg p-3 flex items-center gap-3 ${
                  selectedProperty.source === 'scraped'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${
                    selectedProperty.source === 'scraped'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {selectedProperty.source === 'scraped' ? 'travel_explore' : 'verified'}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${
                      selectedProperty.source === 'scraped'
                        ? 'text-blue-800 dark:text-blue-300'
                        : 'text-green-800 dark:text-green-300'
                    }`}>
                      {selectedProperty.source === 'scraped' ? 'Propriété découverte' : 'Propriété enregistrée'}
                    </p>
                    <p className={`text-xs ${
                      selectedProperty.source === 'scraped'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {selectedProperty.source === 'scraped'
                        ? 'Trouvée via scraping - Non vérifiée officiellement'
                        : 'Vérifiée et approuvée par le ministère'
                      }
                    </p>
                  </div>
                </div>

                {/* Scraped Property Info */}
                {selectedProperty.source === 'scraped' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Informations découvertes</p>
                    <div className="space-y-2">
                      {selectedProperty.rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Note</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-yellow-500">star</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedProperty.rating.toFixed(1)}</span>
                            <span className="text-xs text-gray-500">({selectedProperty.num_reviews} avis)</span>
                          </span>
                        </div>
                      )}
                      {selectedProperty.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Téléphone</span>
                          <span className="text-sm font-mono text-gray-900 dark:text-white">{selectedProperty.phone}</span>
                        </div>
                      )}
                      {selectedProperty.website && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Site web</span>
                          <a
                            href={selectedProperty.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            Visiter <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                        </div>
                      )}
                      {selectedProperty.url && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Source</span>
                          <a
                            href={selectedProperty.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            Google Maps <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 text-[18px] mt-0.5">info</span>
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          Cette propriété a été trouvée automatiquement et n'est pas encore enregistrée officiellement.
                          Contactez le propriétaire pour l'inviter à s'enregistrer.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compliance Score */}
                {selectedProperty.source === 'registered' && selectedProperty.status === 'pending' && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        Score de conformité
                      </p>
                      <span className={`text-sm font-bold ${
                        getComplianceScore(selectedProperty).percentage >= 80 ? 'text-green-600' :
                        getComplianceScore(selectedProperty).percentage >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {getComplianceScore(selectedProperty).percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          getComplianceScore(selectedProperty).percentage >= 80 ? 'bg-green-500' :
                          getComplianceScore(selectedProperty).percentage >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${getComplianceScore(selectedProperty).percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {getComplianceScore(selectedProperty).score}/{getComplianceScore(selectedProperty).total} documents requis
                    </p>
                  </div>
                )}

                {/* Address */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Adresse</p>
                  <p className="text-gray-900 dark:text-white">{selectedProperty.address}</p>
                  <p className="text-gray-600 dark:text-gray-300">{selectedProperty.city}, {selectedProperty.region}</p>
                  {selectedProperty.latitude && selectedProperty.longitude && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      GPS: {selectedProperty.latitude.toFixed(4)}, {selectedProperty.longitude.toFixed(4)}
                    </p>
                  )}
                </div>

                {/* Capacity */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Capacité</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProperty.num_rooms || '-'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Chambres</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProperty.num_beds || '-'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Lits</p>
                    </div>
                  </div>
                </div>

                {/* Registration Number */}
                {selectedProperty.registration_number && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">N° d'enregistrement</p>
                    <p className="font-mono text-green-600 dark:text-green-400 text-lg">{selectedProperty.registration_number}</p>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedProperty.status === 'rejected' && selectedProperty.rejection_reason && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-red-500 text-[20px] mt-0.5">cancel</span>
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Demande rejetée</p>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{selectedProperty.rejection_reason}</p>
                          {selectedProperty.rejected_at && (
                            <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                              Le {new Date(selectedProperty.rejected_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legal Documents */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Documents légaux</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">NINEA</span>
                      {selectedProperty.ninea ? (
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">{selectedProperty.ninea}</span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">close</span> Manquant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">N° Fiscal</span>
                      {selectedProperty.tax_id ? (
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">{selectedProperty.tax_id}</span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">close</span> Manquant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Certificat incendie</span>
                      {selectedProperty.has_fire_certificate ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span> Valide
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">close</span> Manquant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Certificat sanitaire</span>
                      {selectedProperty.has_health_certificate ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span> Valide
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">close</span> Manquant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Assurance</span>
                      {selectedProperty.has_insurance ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span> Valide
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">close</span> Manquant
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Owner Info */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Propriétaire</p>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 space-y-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedProperty.landlords ? `${selectedProperty.landlords.first_name} ${selectedProperty.landlords.last_name}` : 'N/A'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="material-symbols-outlined text-[16px]">phone</span>
                      {selectedProperty.landlords?.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                      {selectedProperty.landlords?.email || 'N/A'}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-500 dark:text-gray-400">CNI/Passeport</span>
                      {selectedProperty.landlords?.national_id ? (
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">{selectedProperty.landlords.national_id}</span>
                      ) : (
                        <span className="text-xs text-red-500">Non fourni</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Registration Date */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date d'inscription</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedProperty.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  {selectedProperty.source === 'scraped' ? (
                    <>
                      {selectedProperty.phone && (
                        <a
                          href={`tel:${selectedProperty.phone}`}
                          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">call</span>
                          Appeler le propriétaire
                        </a>
                      )}
                      <button
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                        Envoyer invitation
                      </button>
                      <button
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">flag</span>
                        Signaler comme suspect
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedProperty.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(selectedProperty.id)}
                            disabled={actionLoading}
                            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            {actionLoading ? 'Traitement...' : 'Approuver et générer licence'}
                          </button>
                          <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={actionLoading}
                            className="w-full rounded-lg border border-red-300 dark:border-red-700 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">block</span>
                            Rejeter la demande
                          </button>
                        </>
                      )}

                      {selectedProperty.status === 'active' && (
                        <button
                          onClick={() => handleSuspend(selectedProperty.id)}
                          disabled={actionLoading}
                          className="w-full rounded-lg border border-red-300 dark:border-red-700 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">pause_circle</span>
                          Suspendre la propriété
                        </button>
                      )}

                      {selectedProperty.status === 'suspended' && (
                        <button
                          onClick={() => handleApprove(selectedProperty.id)}
                          disabled={actionLoading}
                          className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">play_circle</span>
                          Réactiver la propriété
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600">
                  home_work
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Sélectionnez une propriété pour voir les détails</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason('');
              setCustomReason('');
            }}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400">block</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rejeter la demande</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedProperty.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setCustomReason('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-gray-500">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Veuillez sélectionner ou saisir la raison du rejet. Cette information sera communiquée au propriétaire.
              </p>

              {/* Predefined Reasons */}
              <div className="space-y-2">
                {rejectionReasons.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      rejectReason === reason.value
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectReason"
                      value={reason.value}
                      checked={rejectReason === reason.value}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <span className={`text-sm ${
                      rejectReason === reason.value
                        ? 'text-red-700 dark:text-red-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {reason.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Custom Reason Input */}
              {rejectReason === 'other' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Précisez la raison du rejet
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={3}
                    placeholder="Décrivez la raison du rejet..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setCustomReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleReject(selectedProperty.id)}
                disabled={!rejectReason || (rejectReason === 'other' && !customReason) || actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">block</span>
                    Confirmer le rejet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Force rebuild 1768014792
