'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /travelers
 * Full OSINT profiles are now available in the Travelers page
 * under the "Profil Complet" tab.
 */
export default function OsintProfilePage() {
  return (
    <DeprecatedRedirect
      oldPageName="Profil OSINT"
      newPageName="Voyageurs"
      newPath="/travelers"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
