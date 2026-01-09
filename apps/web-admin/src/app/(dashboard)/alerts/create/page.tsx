'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const alertTypes = [
  { value: 'minor_guest', label: 'Mineur non accompagné', icon: 'child_care' },
  { value: 'watchlist_match', label: 'Correspondance liste de surveillance', icon: 'visibility' },
  { value: 'suspicious_activity', label: 'Activité suspecte', icon: 'report' },
  { value: 'document_fraud', label: 'Fraude documentaire', icon: 'assignment_late' },
  { value: 'unregistered_property', label: 'Propriété non enregistrée', icon: 'home_work' },
  { value: 'tax_evasion', label: 'Évasion fiscale', icon: 'money_off' },
  { value: 'other', label: 'Autre', icon: 'more_horiz' },
];

const severityLevels = [
  { value: 'critical', label: 'Critique', color: 'bg-red-500', description: 'Action immédiate requise' },
  { value: 'high', label: 'Haute', color: 'bg-orange-500', description: 'Traitement urgent' },
  { value: 'medium', label: 'Moyenne', color: 'bg-yellow-500', description: 'Traitement dans les 24h' },
  { value: 'low', label: 'Basse', color: 'bg-green-500', description: 'Informatif' },
];

export default function CreateAlertPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    type: 'suspicious_activity',
    severity: 'medium',
    title: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Le titre est requis');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/alerts');
      } else {
        const data = await response.json();
        setError(data.error || 'Erreur lors de la création');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouvelle alerte</h1>
          <p className="text-gray-600 dark:text-gray-400">Créer une alerte manuelle</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Alert Type */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Type d&apos;alerte</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {alertTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, type: type.value })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  formData.type === type.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className={`material-symbols-outlined text-2xl ${
                  formData.type === type.value ? 'text-primary' : 'text-gray-400'
                }`}>
                  {type.icon}
                </span>
                <span className={`text-xs font-medium text-center ${
                  formData.type === type.value ? 'text-primary' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Niveau de sévérité</h2>
          <div className="space-y-3">
            {severityLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setFormData({ ...formData, severity: level.value })}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                  formData.severity === level.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${level.color}`} />
                <div className="flex-1 text-left">
                  <p className={`font-medium ${
                    formData.severity === level.value ? 'text-primary' : 'text-gray-900 dark:text-white'
                  }`}>
                    {level.label}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{level.description}</p>
                </div>
                {formData.severity === level.value && (
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Title & Description */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Détails</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Comportement suspect signalé par le personnel"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Décrivez la situation en détail..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title.trim()}
            className="flex-1 rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">add</span>
                Créer l&apos;alerte
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
