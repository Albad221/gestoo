'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function VerifyPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem('auth_phone');
    if (!storedPhone) {
      router.push('/auth/login');
      return;
    }
    setPhone(storedPhone);

    // Focus first input
    inputRefs.current[0]?.focus();

    // Start countdown
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code: string) => {
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) throw error;

      // Check if this is a registration
      const isRegistration = sessionStorage.getItem('auth_is_registration') === 'true';

      if (isRegistration && data.user) {
        // Create landlord profile
        const fullName = sessionStorage.getItem('auth_name') || '';
        const email = sessionStorage.getItem('auth_email') || '';

        await supabase.from('landlords').insert({
          user_id: data.user.id,
          full_name: fullName,
          phone: phone,
          email: email || null,
        });
      }

      // Clear session storage
      sessionStorage.removeItem('auth_phone');
      sessionStorage.removeItem('auth_name');
      sessionStorage.removeItem('auth_email');
      sessionStorage.removeItem('auth_is_registration');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('Code invalide. Veuillez réessayer.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setError('');
    setResendTimer(60);

    try {
      const supabase = createClient();
      await supabase.auth.signInWithOtp({ phone });
    } catch (err) {
      setError('Erreur lors du renvoi du code.');
      console.error(err);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace('+221', '+221 ').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
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
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Vérification</h1>
          <p className="mb-6 text-gray-600">
            Entrez le code à 6 chiffres envoyé au{' '}
            <span className="font-medium text-gray-900">{formatPhone(phone)}</span>
          </p>

          <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isLoading}
                className="h-14 w-12 rounded-lg border-2 border-gray-300 text-center text-2xl font-bold transition-colors focus:border-teranga-green focus:outline-none focus:ring-2 focus:ring-teranga-green/20 disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="mb-4 flex items-center justify-center gap-2 text-gray-600">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Vérification en cours...
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Vous n&apos;avez pas reçu le code ?{' '}
              {resendTimer > 0 ? (
                <span className="text-gray-400">
                  Renvoyer dans {resendTimer}s
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  className="font-medium text-teranga-green hover:underline"
                >
                  Renvoyer le code
                </button>
              )}
            </p>
          </div>

          <div className="mt-6">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Changer de numéro
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
