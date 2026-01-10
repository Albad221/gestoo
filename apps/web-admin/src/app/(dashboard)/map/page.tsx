'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /dashboard and /properties
 * The map is now available:
 * - As a mini-map on the Dashboard
 * - As a full view option in the Properties page
 */
export default function MapPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Carte"
      newPageName="Tableau de bord"
      newPath="/dashboard"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
