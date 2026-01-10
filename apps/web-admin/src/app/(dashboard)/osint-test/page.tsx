'use client';

import DeprecatedRedirect from '@/components/deprecated-redirect';

/**
 * @deprecated This page has been merged into /travelers
 * OSINT testing is now available in the Travelers page
 * under the "Verification OSINT" tab.
 */
export default function OsintTestPage() {
  return (
    <DeprecatedRedirect
      oldPageName="Test OSINT"
      newPageName="Voyageurs"
      newPath="/travelers"
      autoRedirect={true}
      redirectDelay={5}
    />
  );
}
