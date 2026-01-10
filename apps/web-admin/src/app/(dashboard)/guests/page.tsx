'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /travelers
 * The guests search functionality is now available in the
 * Travelers page with integrated OSINT verification tools.
 */
export default function GuestSearchPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Recherche Voyageurs"
      newPageName="Voyageurs"
      newPath="/travelers"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
