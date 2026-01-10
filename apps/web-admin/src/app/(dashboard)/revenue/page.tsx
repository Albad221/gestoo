'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /dashboard
 * Revenue statistics are now displayed on the Dashboard page
 * along with other key metrics.
 */
export default function RevenuePage() {
  return (
    <DeprecatedRedirect
      oldPageName="Recettes TPT"
      newPageName="Tableau de bord"
      newPath="/dashboard"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
