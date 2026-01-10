'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo credentials for testing
  const DEMO_CREDENTIALS = {
    email: 'demo@gouv.sn',
    password: 'demo123',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Demo mode - bypass Supabase for testing
    if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      // Store demo session in localStorage
      localStorage.setItem('demo_session', JSON.stringify({
        user: { email, role: 'admin', name: 'Agent Demo' },
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      }));
      router.push('/dashboard');
      return;
    }

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Verify user has admin role
      const { data: adminUser, error: profileError } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !adminUser) {
        await supabase.auth.signOut();
        throw new Error('Accès non autorisé. Contactez l\'administrateur.');
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      <div className="flex flex-1 w-full min-h-screen">
        {/* Left Branding Panel */}
        <div className="hidden lg:flex w-5/12 relative flex-col justify-between bg-primary p-12 overflow-hidden">
          {/* Background Pattern/Effect */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 50%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

          <div className="relative z-10 flex flex-col h-full justify-between">
            {/* Top Logo Area */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/10">
                <span className="material-symbols-outlined text-white text-3xl">verified_user</span>
              </div>
              <div>
                <h1 className="text-white text-2xl font-black tracking-tight leading-none">
                  Gestoo
                </h1>
                <span className="text-blue-200 text-xs font-medium uppercase tracking-wider">
                  République du Sénégal
                </span>
              </div>
            </div>

            {/* Middle Content */}
            <div className="flex flex-col gap-6">
              <h2 className="text-white text-4xl font-bold leading-tight">
                Plateforme Nationale d&apos;Hébergement
              </h2>
              <div className="h-1 w-20 bg-white/30 rounded-full" />
              <p className="text-blue-100 text-lg font-normal leading-relaxed max-w-md">
                Portail Administration. Accès strictement restreint aux agents gouvernementaux
                autorisés.
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                  <span className="material-symbols-outlined text-white text-sm">lock</span>
                  <span className="text-white text-sm font-semibold">Connexion Sécurisée</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                  <span className="material-symbols-outlined text-white text-sm">encrypted</span>
                  <span className="text-white text-sm font-semibold">Données Chiffrées</span>
                </div>
              </div>
            </div>

            {/* Bottom Copyright/Info */}
            <div className="text-blue-200 text-sm">
              <p>© {new Date().getFullYear()} Ministère du Tourisme et des Loisirs.</p>
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white dark:bg-gray-900 p-6 sm:p-12 relative">
          {/* Mobile Header */}
          <div className="lg:hidden absolute top-0 left-0 w-full p-6 flex justify-between items-center bg-primary text-white">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
              <span className="font-bold text-lg">Gestoo</span>
            </div>
          </div>

          <div className="w-full max-w-md flex flex-col gap-8 mt-16 lg:mt-0">
            {/* Form Header */}
            <div className="text-center lg:text-left">
              <h2 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight mb-2">
                Identifiez-vous
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Entrez vos identifiants pour accéder au portail.
              </p>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 shrink-0">
                  error
                </span>
                <div>
                  <h4 className="text-red-800 dark:text-red-300 text-sm font-bold">
                    Échec de la connexion
                  </h4>
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-slate-900 dark:text-slate-200 text-sm font-medium"
                  htmlFor="email"
                >
                  Email professionnel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                      mail
                    </span>
                  </div>
                  <input
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary pl-10 h-12 text-base shadow-sm placeholder:text-slate-400"
                    id="email"
                    name="email"
                    placeholder="agent@gouv.sn"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label
                    className="text-slate-900 dark:text-slate-200 text-sm font-medium"
                    htmlFor="password"
                  >
                    Mot de passe
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                      lock
                    </span>
                  </div>
                  <input
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary pl-10 pr-10 h-12 text-base shadow-sm placeholder:text-slate-400"
                    id="password"
                    name="password"
                    placeholder="••••••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                className="mt-2 w-full flex justify-center items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>

              {/* Help Link */}
              <div className="text-center mt-2">
                <a
                  className="text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 text-sm font-semibold transition-colors"
                  href="mailto:support@gestoo.sn"
                >
                  Problème de connexion ?
                </a>
              </div>
            </form>

            {/* Footer Info */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-6 flex gap-0.5 mb-2 opacity-80">
                  <div className="flex-1 bg-teranga-green rounded-l-sm" />
                  <div className="flex-1 bg-teranga-yellow" />
                  <div className="flex-1 bg-teranga-red rounded-r-sm" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                  République du Sénégal
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Ministère du Tourisme</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
