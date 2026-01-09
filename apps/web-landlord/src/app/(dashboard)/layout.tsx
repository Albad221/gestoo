import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get landlord profile
  const { data: landlord } = await supabase
    .from('landlords')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!landlord) {
    // User exists but no landlord profile - redirect to complete registration
    redirect('/auth/register');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar landlord={landlord} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header landlord={landlord} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
