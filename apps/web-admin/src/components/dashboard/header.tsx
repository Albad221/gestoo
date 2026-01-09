'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Tableau de bord' }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <header className="flex justify-between items-center mb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search Button */}
        <button className="p-2 text-gray-500 hover:text-primary bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <span className="material-symbols-outlined">search</span>
        </button>

        {/* Notifications Button */}
        <button className="p-2 text-gray-500 hover:text-primary bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">logout</span>
          Déconnexion
        </button>
      </div>
    </header>
  );
}
