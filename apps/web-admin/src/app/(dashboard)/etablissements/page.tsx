'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /properties
 * The etablissements (scraped hotels) functionality is now available
 * in the Properties page with source filtering.
 */
export default function EtablissementsPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Hotels & Auberges"
      newPageName="Proprietes"
      newPath="/properties"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
