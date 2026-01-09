'use client';

import { useState, useEffect } from 'react';
import {
  TravelerVerification,
  VerificationCheck,
  performVerification,
  getRiskLevelColor,
  getCheckStatusIcon,
  getCheckStatusColor,
  getCategoryLabel,
} from '@/lib/verification/traveler-score';

interface TravelerVerificationPanelProps {
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    nationality: string;
    date_of_birth: string;
    id_document_type: string;
    passport_number?: string | null;
    national_id_number?: string | null;
  };
  onClose?: () => void;
}

export default function TravelerVerificationPanel({ guest, onClose }: TravelerVerificationPanelProps) {
  const [verification, setVerification] = useState<TravelerVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('security');

  useEffect(() => {
    const runVerification = async () => {
      setLoading(true);
      try {
        const result = await performVerification({
          id: guest.id,
          firstName: guest.first_name,
          lastName: guest.last_name,
          nationality: guest.nationality,
          dateOfBirth: guest.date_of_birth,
          documentType: guest.id_document_type,
          passportNumber: guest.passport_number,
          nationalIdNumber: guest.national_id_number,
        });
        setVerification(result);
      } catch (error) {
        console.error('Verification error:', error);
      } finally {
        setLoading(false);
      }
    };

    runVerification();
  }, [guest]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Vérification en cours...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">Interrogation des bases de données</p>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-red-500">error</span>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Erreur lors de la vérification</p>
      </div>
    );
  }

  const riskColor = getRiskLevelColor(verification.riskLevel);
  const groupedChecks = verification.checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, VerificationCheck[]>);

  const riskLabels = {
    low: 'Faible',
    medium: 'Moyen',
    high: 'Élevé',
    critical: 'Critique',
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-amber-500';
    if (score >= 40) return 'from-orange-500 to-red-500';
    return 'from-red-600 to-red-800';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${riskColor}-100 dark:bg-${riskColor}-900/30`}>
            <span className={`material-symbols-outlined text-${riskColor}-600 dark:text-${riskColor}-400`}>
              verified_user
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Score de Vérification</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {guest.first_name} {guest.last_name}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-40">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${verification.overallScore * 4.4} 440`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" className={`${verification.overallScore >= 60 ? 'text-green-500' : 'text-red-500'}`} style={{ stopColor: 'currentColor' }} />
                  <stop offset="100%" className={`${verification.overallScore >= 60 ? 'text-emerald-500' : 'text-orange-500'}`} style={{ stopColor: 'currentColor' }} />
                </linearGradient>
              </defs>
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold bg-gradient-to-r ${getScoreGradient(verification.overallScore)} bg-clip-text text-transparent`}>
                {verification.overallScore}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/100</span>
            </div>
          </div>

          {/* Risk Level Badge */}
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            verification.riskLevel === 'low' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
            verification.riskLevel === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
            verification.riskLevel === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {verification.riskLevel === 'low' ? 'shield' :
               verification.riskLevel === 'medium' ? 'warning' :
               verification.riskLevel === 'high' ? 'gpp_maybe' : 'gpp_bad'}
            </span>
            <span className="font-semibold">Risque {riskLabels[verification.riskLevel]}</span>
          </div>

          {/* Flags */}
          {verification.flags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {verification.flags.map((flag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {['verified', 'warning', 'alert'].map((status) => {
            const count = verification.checks.filter(c => c.status === status).length;
            const config = {
              verified: { icon: 'check_circle', label: 'Vérifié', color: 'green' },
              warning: { icon: 'warning', label: 'Attention', color: 'yellow' },
              alert: { icon: 'error', label: 'Alerte', color: 'red' },
            }[status as 'verified' | 'warning' | 'alert'];

            return (
              <div key={status} className={`flex flex-col items-center p-3 rounded-lg bg-${config.color}-50 dark:bg-${config.color}-900/20`}>
                <span className={`material-symbols-outlined text-${config.color}-600 dark:text-${config.color}-400`}>
                  {config.icon}
                </span>
                <span className={`text-2xl font-bold text-${config.color}-700 dark:text-${config.color}-400`}>{count}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">{config.label}</span>
              </div>
            );
          })}
        </div>

        {/* Detailed Checks by Category */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Détails des vérifications
          </h4>

          {Object.entries(groupedChecks).map(([category, checks]) => {
            const isExpanded = expandedCategory === category;
            const hasAlerts = checks.some(c => c.status === 'alert');
            const hasWarnings = checks.some(c => c.status === 'warning');
            const allVerified = checks.every(c => c.status === 'verified' || c.status === 'unavailable');

            return (
              <div
                key={category}
                className={`rounded-lg border ${
                  hasAlerts ? 'border-red-300 dark:border-red-800' :
                  hasWarnings ? 'border-yellow-300 dark:border-yellow-800' :
                  'border-gray-200 dark:border-gray-700'
                } overflow-hidden`}
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                    hasAlerts ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' :
                    hasWarnings ? 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30' :
                    'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${
                      category === 'security' ? 'text-red-500' :
                      category === 'document' ? 'text-blue-500' :
                      category === 'identity' ? 'text-purple-500' :
                      category === 'osint' ? 'text-cyan-500' :
                      'text-green-500'
                    }`}>
                      {category === 'security' ? 'security' :
                       category === 'document' ? 'description' :
                       category === 'identity' ? 'fingerprint' :
                       category === 'osint' ? 'public' : 'flight'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {getCategoryLabel(category as VerificationCheck['category'])}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({checks.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {allVerified && (
                      <span className="material-symbols-outlined text-green-500 text-[20px]">verified</span>
                    )}
                    <span className={`material-symbols-outlined transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {checks.map((check) => (
                      <div key={check.id} className="px-4 py-3 flex items-start gap-3 bg-white dark:bg-gray-800">
                        <span className={`material-symbols-outlined mt-0.5 ${getCheckStatusColor(check.status)}`}>
                          {getCheckStatusIcon(check.status)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {check.nameFr}
                            </p>
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                              check.score > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              check.score < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {check.score > 0 ? '+' : ''}{check.score}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{check.source}</p>
                          {check.details && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                              {check.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Last Updated */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Dernière mise à jour: {new Date(verification.lastUpdated).toLocaleString('fr-FR')}
        </p>
      </div>

      {/* Actions Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Actualiser
        </button>
        <button className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Rapport
        </button>
        {verification.riskLevel !== 'low' && (
          <button className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 flex items-center justify-center gap-2 transition-colors">
            <span className="material-symbols-outlined text-[18px]">flag</span>
            Signaler
          </button>
        )}
      </div>
    </div>
  );
}
