/**
 * Teranga Safe OSINT Service
 *
 * Unified interface for all OSINT verification services.
 * Combines email, phone, sanctions, watchlist, and document checks.
 */

// Email Services
export {
  verifyEmailHunter,
  checkEmailReputation,
  checkEmailBreaches,
  enrichEmailProfiles,
  runAllEmailChecks,
} from './email-service';

// Phone Services
export {
  verifyPhoneNumverify,
  verifyPhoneTwilio,
  lookupTruecaller,
  validatePhoneLocal,
  runAllPhoneChecks,
} from './phone-service';

// Sanctions Services
export {
  checkOpenSanctions,
  checkOFACSanctions,
  checkUNSanctions,
  checkEUSanctions,
  runAllSanctionsChecks,
} from './sanctions-service';

// Watchlist Services
export {
  checkInterpolNotices,
  checkFBIWanted,
  checkEuropolWanted,
  runAllWatchlistChecks,
} from './watchlist-service';

// Document Services
export {
  validatePassportMRZ,
  validatePassportFormat,
  validateSenegaleseCNI,
  runAllDocumentChecks,
} from './document-service';

// Types
export * from './types';

/**
 * Run comprehensive OSINT verification for a traveler
 */
export interface TravelerOSINTInput {
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  email?: string | null;
  phone?: string | null;
  documentType: 'passport' | 'national_id';
  documentNumber?: string | null;
  mrz?: string; // Machine Readable Zone data if available
}

export interface TravelerOSINTResult {
  timestamp: string;
  duration: number; // milliseconds
  email?: Awaited<ReturnType<typeof import('./email-service').runAllEmailChecks>>;
  phone?: Awaited<ReturnType<typeof import('./phone-service').runAllPhoneChecks>>;
  sanctions: Awaited<ReturnType<typeof import('./sanctions-service').runAllSanctionsChecks>>;
  watchlists: Awaited<ReturnType<typeof import('./watchlist-service').runAllWatchlistChecks>>;
  document: ReturnType<typeof import('./document-service').runAllDocumentChecks>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    score: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    alerts: string[];
  };
}

export async function runComprehensiveOSINT(
  input: TravelerOSINTInput
): Promise<TravelerOSINTResult> {
  const startTime = Date.now();
  const fullName = `${input.firstName} ${input.lastName}`;

  // Run all checks in parallel
  const [emailResult, phoneResult, sanctionsResult, watchlistResult] = await Promise.all([
    input.email
      ? import('./email-service').then(m => m.runAllEmailChecks(input.email!))
      : Promise.resolve(undefined),
    input.phone
      ? import('./phone-service').then(m => m.runAllPhoneChecks(input.phone!))
      : Promise.resolve(undefined),
    import('./sanctions-service').then(m =>
      m.runAllSanctionsChecks(fullName, input.dateOfBirth, input.nationality)
    ),
    import('./watchlist-service').then(m =>
      m.runAllWatchlistChecks(fullName, input.nationality, input.dateOfBirth)
    ),
  ]);

  // Document checks (synchronous)
  const { runAllDocumentChecks } = await import('./document-service');
  const documentResult = runAllDocumentChecks(
    input.documentNumber || '',
    input.documentType,
    input.nationality.substring(0, 2).toUpperCase(),
    input.mrz
  );

  // Calculate summary
  const alerts: string[] = [];
  let passedChecks = 0;
  let warningChecks = 0;
  let failedChecks = 0;

  // Check sanctions
  if (sanctionsResult.aggregated.isMatch) {
    failedChecks++;
    alerts.push(`SANCTIONS MATCH: Found in ${sanctionsResult.aggregated.matches.length} sanctions list(s)`);
  } else {
    passedChecks++;
  }

  // Check watchlists
  if (watchlistResult.aggregated.isMatch) {
    failedChecks++;
    alerts.push(`WATCHLIST MATCH: Found in ${watchlistResult.aggregated.matches.length} watchlist(s)`);
  } else {
    passedChecks++;
  }

  // Check document
  if (documentResult.formatValid) {
    passedChecks++;
  } else {
    warningChecks++;
    alerts.push('Document format validation failed');
  }

  // Check email (if provided)
  if (emailResult) {
    if (emailResult.reputation.success && emailResult.reputation.data?.malicious) {
      failedChecks++;
      alerts.push('Email flagged as malicious');
    } else if (emailResult.reputation.success && emailResult.reputation.data?.suspicious) {
      warningChecks++;
      alerts.push('Email flagged as suspicious');
    } else if (emailResult.verification.success && emailResult.verification.data?.isValid) {
      passedChecks++;
    }

    if (emailResult.breaches.success && emailResult.breaches.data?.breachCount && emailResult.breaches.data.breachCount > 5) {
      warningChecks++;
      alerts.push(`Email found in ${emailResult.breaches.data.breachCount} data breaches`);
    }
  }

  // Check phone (if provided)
  if (phoneResult) {
    if (phoneResult.local.isValid) {
      passedChecks++;
    } else {
      warningChecks++;
      alerts.push('Phone number format invalid');
    }

    if (phoneResult.truecaller.success && phoneResult.truecaller.data?.isSpammer) {
      warningChecks++;
      alerts.push('Phone number flagged as spam by Truecaller');
    }
  }

  const totalChecks = passedChecks + warningChecks + failedChecks;
  const score = totalChecks > 0
    ? Math.round((passedChecks / totalChecks) * 100 - (failedChecks * 20) - (warningChecks * 5))
    : 50;

  const clampedScore = Math.max(0, Math.min(100, score));

  let riskLevel: TravelerOSINTResult['summary']['riskLevel'];
  if (failedChecks > 0) {
    riskLevel = 'critical';
  } else if (clampedScore >= 80) {
    riskLevel = 'low';
  } else if (clampedScore >= 60) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    email: emailResult,
    phone: phoneResult,
    sanctions: sanctionsResult,
    watchlists: watchlistResult,
    document: documentResult,
    summary: {
      totalChecks,
      passedChecks,
      warningChecks,
      failedChecks,
      score: clampedScore,
      riskLevel,
      alerts,
    },
  };
}
