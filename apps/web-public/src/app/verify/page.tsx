'use client';

import { useState } from 'react';
import { Metadata } from 'next';
import {
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Building2,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { SectionHeader } from '@/components/shared/section-header';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';
import { cn } from '@/lib/utils';

// Mock verification data - in production this would come from an API
const mockLicenses: Record<
  string,
  {
    status: 'valid' | 'expired' | 'suspended';
    propertyName: string;
    ownerName: string;
    location: string;
    propertyType: string;
    capacity: number;
    issueDate: string;
    expiryDate: string;
    lastInspection: string;
  }
> = {
  'TRG-2024-00001': {
    status: 'valid',
    propertyName: 'Villa Teranga',
    ownerName: 'Amadou Diallo',
    location: 'Dakar, Almadies',
    propertyType: 'Villa',
    capacity: 8,
    issueDate: '15/01/2024',
    expiryDate: '14/01/2026',
    lastInspection: '10/01/2024',
  },
  'TRG-2023-00542': {
    status: 'expired',
    propertyName: 'Appartement Ngor',
    ownerName: 'Fatou Sow',
    location: 'Dakar, Ngor',
    propertyType: 'Appartement',
    capacity: 4,
    issueDate: '20/06/2023',
    expiryDate: '19/06/2025',
    lastInspection: '15/06/2023',
  },
  'TRG-2024-00123': {
    status: 'suspended',
    propertyName: 'Maison Saly',
    ownerName: 'Moussa Ba',
    location: 'Saly, Mbour',
    propertyType: 'Maison',
    capacity: 6,
    issueDate: '05/03/2024',
    expiryDate: '04/03/2026',
    lastInspection: '01/03/2024',
  },
};

type VerificationResult = {
  found: boolean;
  license?: (typeof mockLicenses)[string] & { licenseNumber: string };
};

export default function VerifyPage() {
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // Validate format
    const licenseRegex = /^TRG-\d{4}-\d{5}$/;
    if (!licenseRegex.test(licenseNumber.toUpperCase())) {
      setError(
        'Format invalide. Le numero de licence doit etre au format TRG-XXXX-XXXXX'
      );
      return;
    }

    setIsSearching(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const normalizedNumber = licenseNumber.toUpperCase();
    const license = mockLicenses[normalizedNumber];

    if (license) {
      setResult({
        found: true,
        license: { ...license, licenseNumber: normalizedNumber },
      });
    } else {
      setResult({ found: false });
    }

    setIsSearching(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'valid':
        return {
          label: 'Licence valide',
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'expired':
        return {
          label: 'Licence expiree',
          color: 'bg-yellow-100 text-yellow-800',
          icon: AlertCircle,
          iconColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        };
      case 'suspended':
        return {
          label: 'Licence suspendue',
          color: 'bg-red-100 text-red-800',
          icon: XCircle,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      default:
        return {
          label: 'Statut inconnu',
          color: 'bg-gray-100 text-gray-800',
          icon: AlertCircle,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/10 rounded-full text-teranga-green text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Verification officielle
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Verifier une licence
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Entrez le numero de licence d'un hebergement pour verifier son
              authenticite et son statut actuel.
            </p>
          </div>
        </div>
      </section>

      {/* Search Form */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="license" className="sr-only">
                    Numero de licence
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="license"
                      value={licenseNumber}
                      onChange={(e) =>
                        setLicenseNumber(e.target.value.toUpperCase())
                      }
                      placeholder="TRG-2024-00001"
                      className={cn(
                        'w-full pl-12 pr-4 py-4 text-lg border rounded-xl focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all',
                        error ? 'border-red-300' : 'border-gray-300'
                      )}
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !licenseNumber}
                  className="px-8 py-4 bg-teranga-green text-white font-medium rounded-xl hover:bg-teranga-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Verifier
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Results */}
            {result && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {result.found && result.license ? (
                  <div
                    className={cn(
                      'rounded-2xl border-2 overflow-hidden',
                      getStatusConfig(result.license.status).borderColor
                    )}
                  >
                    {/* Status Header */}
                    <div
                      className={cn(
                        'p-6',
                        getStatusConfig(result.license.status).bgColor
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {(() => {
                            const StatusIcon = getStatusConfig(
                              result.license.status
                            ).icon;
                            return (
                              <StatusIcon
                                className={cn(
                                  'h-10 w-10',
                                  getStatusConfig(result.license.status).iconColor
                                )}
                              />
                            );
                          })()}
                          <div>
                            <span
                              className={cn(
                                'inline-block px-3 py-1 rounded-full text-sm font-medium',
                                getStatusConfig(result.license.status).color
                              )}
                            >
                              {getStatusConfig(result.license.status).label}
                            </span>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                              {result.license.licenseNumber}
                            </p>
                          </div>
                        </div>
                        <Shield className="h-12 w-12 text-teranga-green opacity-20" />
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="p-6 bg-white">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Informations de l'hebergement
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Nom de l'hebergement
                            </p>
                            <p className="font-medium text-gray-900">
                              {result.license.propertyName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Proprietaire</p>
                            <p className="font-medium text-gray-900">
                              {result.license.ownerName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Localisation</p>
                            <p className="font-medium text-gray-900">
                              {result.license.location}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Type & Capacite</p>
                            <p className="font-medium text-gray-900">
                              {result.license.propertyType} -{' '}
                              {result.license.capacity} personnes
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Date d'emission</p>
                            <p className="font-medium text-gray-900">
                              {result.license.issueDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Date d'expiration
                            </p>
                            <p className="font-medium text-gray-900">
                              {result.license.expiryDate}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        Derniere inspection: {result.license.lastInspection}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-8 text-center">
                    <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Licence non trouvee
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Aucun hebergement enregistre avec ce numero de licence. Le
                      numero peut etre incorrect ou l'hebergement n'est pas
                      enregistre sur Teranga Safe.
                    </p>
                    <a
                      href="/contact"
                      className="text-teranga-green font-medium hover:underline"
                    >
                      Signaler un probleme
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              subtitle="Information"
              title="Ou trouver le numero de licence?"
              description="Le numero de licence Teranga Safe est un identifiant unique attribue a chaque hebergement enregistre."
            />

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-teranga-green" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Sur le bien
                </h3>
                <p className="text-sm text-gray-600">
                  Affichez a l'entree de l'hebergement ou dans le livret d'accueil.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-teranga-green" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Sur les annonces
                </h3>
                <p className="text-sm text-gray-600">
                  Mentionne dans les annonces sur les plateformes de reservation.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-teranga-green" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Aupres du proprietaire
                </h3>
                <p className="text-sm text-gray-600">
                  Demandez directement au proprietaire ou au gestionnaire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Vous etes proprietaire?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Enregistrez votre hebergement sur Teranga Safe pour obtenir votre
              licence officielle et rassurer vos voyageurs.
            </p>
            <WhatsAppButton>Enregistrer mon hebergement</WhatsAppButton>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <WhatsAppButton variant="floating" />
    </>
  );
}
