'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /dashboard
 * Statistics are now displayed directly on the Dashboard page
 * with interactive widgets and real-time data.
 */
export default function StatisticsPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Statistiques"
      newPageName="Tableau de bord"
      newPath="/dashboard"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
