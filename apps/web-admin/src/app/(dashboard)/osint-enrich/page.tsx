'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /travelers
 * Profile enrichment is now available in the Travelers page
 * under the "Enrichissement" tab.
 */
export default function OsintEnrichPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Enrichissement OSINT"
      newPageName="Voyageurs"
      newPath="/travelers"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
