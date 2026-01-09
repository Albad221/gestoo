'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('221')) {
      return '+' + digits;
    }
    if (digits.length >= 9 && !digits.startsWith('221')) {
      return '+221' + digits;
    }
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formattedPhone = formatPhone(formData.phone);

    if (!formattedPhone.match(/^\+221[0-9]{9}$/)) {
      setError('Numéro de téléphone invalide. Format: 77 123 45 67');
      setIsLoading(false);
      return;
    }

    if (formData.fullName.length < 3) {
      setError('Veuillez entrer votre nom complet');
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Send OTP to phone
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          data: {
            full_name: formData.fullName,
            email: formData.email || undefined,
            role: 'landlord',
          },
        },
      });

      if (error) throw error;

      // Store data for verification page
      sessionStorage.setItem('auth_phone', formattedPhone);
      sessionStorage.setItem('auth_name', formData.fullName);
      sessionStorage.setItem('auth_email', formData.email);
      sessionStorage.setItem('auth_is_registration', 'true');

      router.push('/auth/verify');
    } catch (err) {
      setError('Erreur lors de l\'inscription. Veuillez réessayer.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teranga-green/10 to-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teranga-green">
              <span className="text-2xl font-bold text-white">T</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Teranga Safe</span>
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="mb-6 text-gray-600">
            Inscrivez-vous pour commencer à gérer vos hébergements.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                Nom complet *
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Mamadou Diallo"
                className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                Numéro de téléphone *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  +221
                </span>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="77 123 45 67"
                  className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-14 pr-4 text-base transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email (optionnel)
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="mamadou@example.com"
                className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teranga-green font-medium text-white transition-colors hover:bg-teranga-green/90 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Inscription en cours...
                </>
              ) : (
                "S'inscrire"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Déjà inscrit ?{' '}
            <Link href="/auth/login" className="font-medium text-teranga-green hover:underline">
              Se connecter
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          En vous inscrivant, vous acceptez nos{' '}
          <Link href="/terms" className="underline">Conditions d&apos;utilisation</Link>
          {' '}et notre{' '}
          <Link href="/privacy" className="underline">Politique de confidentialité</Link>
        </p>
      </div>
    </main>
  );
}
