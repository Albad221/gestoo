'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DeprecatedRedirectProps {
  newPath: string;
  newPageName: string;
  oldPageName: string;
  autoRedirect?: boolean;
  redirectDelay?: number;
}

export default function DeprecatedRedirect({
  newPath,
  newPageName,
  oldPageName,
  autoRedirect = true,
  redirectDelay = 5,
}: DeprecatedRedirectProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(redirectDelay);

  useEffect(() => {
    if (!autoRedirect) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(newPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRedirect, newPath, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 text-4xl">
            move_item
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Page deplacee
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          La page <strong>{oldPageName}</strong> a ete consolidee dans{' '}
          <strong>{newPageName}</strong> pour simplifier la navigation.
        </p>

        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {autoRedirect ? (
              <>
                Redirection automatique dans <strong>{countdown}</strong> seconde(s)...
              </>
            ) : (
              'Cliquez sur le bouton ci-dessous pour acceder a la nouvelle page.'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={newPath}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary-dark flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            Aller a {newPageName}
          </Link>

          <button
            onClick={() => router.back()}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}
