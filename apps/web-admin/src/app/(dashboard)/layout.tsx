'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';

interface DemoSession {
  user: {
    email: string;
    role: string;
    name: string;
  };
  expires: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for demo session
    const demoSessionStr = localStorage.getItem('demo_session');
    if (demoSessionStr) {
      try {
        const demoSession: DemoSession = JSON.parse(demoSessionStr);
        if (demoSession.expires > Date.now()) {
          setSession(demoSession);
          setLoading(false);
          return;
        } else {
          // Session expired
          localStorage.removeItem('demo_session');
        }
      } catch (e) {
        localStorage.removeItem('demo_session');
      }
    }

    // No valid session, redirect to login
    router.push('/auth/login');
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex">
      <Sidebar
        userRole={session.user.role}
        userName={session.user.name}
        userOrganization="Ministère du Tourisme"
      />
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
