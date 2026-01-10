'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /travelers
 * Traveler verification is now available in the Travelers page
 * under the "Verification OSINT" tab.
 */
export default function OsintVerifyTravelerPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Verification Voyageur"
      newPageName="Voyageurs"
      newPath="/travelers"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
