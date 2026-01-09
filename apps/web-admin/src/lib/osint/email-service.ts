/**
 * Email Verification OSINT Services
 *
 * Integrates with:
 * - Hunter.io - Email deliverability & verification
 * - EmailRep.io - Email reputation scoring
 * - Have I Been Pwned - Data breach checking
 * - Clearbit/FullContact - Social profile enrichment
 */

import type {
  EmailVerificationResult,
  EmailReputationResult,
  BreachCheckResult,
  SocialProfileResult,
} from './types';

const HUNTER_API_KEY = process.env.NEXT_PUBLIC_HUNTER_API_KEY || '';
const EMAILREP_API_KEY = process.env.NEXT_PUBLIC_EMAILREP_API_KEY || '';
const HIBP_API_KEY = process.env.NEXT_PUBLIC_HIBP_API_KEY || '';
const FULLCONTACT_API_KEY = process.env.NEXT_PUBLIC_FULLCONTACT_API_KEY || '';

/**
 * Hunter.io Email Verification
 * Docs: https://hunter.io/api-documentation/v2#email-verifier
 * Free: 25 verifications/month | Paid: from $49/month
 */
export async function verifyEmailHunter(email: string): Promise<EmailVerificationResult> {
  const now = new Date().toISOString();

  if (!HUNTER_API_KEY) {
    return {
      success: false,
      source: 'Hunter.io',
      checkedAt: now,
      error: 'API key not configured',
    };
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Hunter API error: ${response.status}`);
    }

    const result = await response.json();
    const data = result.data;

    return {
      success: true,
      source: 'Hunter.io',
      checkedAt: now,
      data: {
        isValid: data.status === 'valid',
        isDeliverable: data.result === 'deliverable',
        isFreeProvider: data.webmail || false,
        isDisposable: data.disposable || false,
        domain: data.domain || '',
        mxRecords: data.mx_records || false,
        smtpCheck: data.smtp_check || false,
        score: data.score || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Hunter.io',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * EmailRep.io Reputation Check
 * Docs: https://emailrep.io/docs
 * Free: 5000 queries/day (no key) | Premium: unlimited
 */
export async function checkEmailReputation(email: string): Promise<EmailReputationResult> {
  const now = new Date().toISOString();

  try {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': 'TerangaSafe/1.0',
    };

    if (EMAILREP_API_KEY) {
      headers['Key'] = EMAILREP_API_KEY;
    }

    const response = await fetch(
      `https://emailrep.io/${encodeURIComponent(email)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`EmailRep API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      source: 'EmailRep.io',
      checkedAt: now,
      data: {
        reputation: data.reputation || 'none',
        suspicious: data.suspicious || false,
        malicious: data.details?.malicious_activity || false,
        spamReported: data.details?.spam || false,
        blacklisted: data.details?.blacklisted || false,
        profilesFound: data.details?.profiles || [],
        daysSinceFirstSeen: data.details?.days_since_domain_creation || 0,
        score: mapReputationToScore(data.reputation),
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'EmailRep.io',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function mapReputationToScore(reputation: string): number {
  switch (reputation) {
    case 'high': return 90;
    case 'medium': return 60;
    case 'low': return 30;
    default: return 0;
  }
}

/**
 * Have I Been Pwned - Breach Check
 * Docs: https://haveibeenpwned.com/API/v3
 * Requires: API key ($3.50/month)
 */
export async function checkEmailBreaches(email: string): Promise<BreachCheckResult> {
  const now = new Date().toISOString();

  if (!HIBP_API_KEY) {
    return {
      success: false,
      source: 'Have I Been Pwned',
      checkedAt: now,
      error: 'API key not configured - requires HIBP subscription',
    };
  }

  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'User-Agent': 'TerangaSafe/1.0',
        },
      }
    );

    // 404 means no breaches found (good!)
    if (response.status === 404) {
      return {
        success: true,
        source: 'Have I Been Pwned',
        checkedAt: now,
        data: {
          breached: false,
          breachCount: 0,
          breaches: [],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }

    const breaches = await response.json();

    return {
      success: true,
      source: 'Have I Been Pwned',
      checkedAt: now,
      data: {
        breached: breaches.length > 0,
        breachCount: breaches.length,
        breaches: breaches.map((b: Record<string, unknown>) => ({
          name: b.Name as string,
          domain: b.Domain as string,
          breachDate: b.BreachDate as string,
          dataClasses: b.DataClasses as string[],
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Have I Been Pwned',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * FullContact - Social Profile Enrichment
 * Docs: https://docs.fullcontact.com/
 * Free: 100 matches/month | Paid: from $99/month
 */
export async function enrichEmailProfiles(email: string): Promise<SocialProfileResult> {
  const now = new Date().toISOString();

  if (!FULLCONTACT_API_KEY) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      error: 'API key not configured',
    };
  }

  try {
    const response = await fetch(
      'https://api.fullcontact.com/v3/person.enrich',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FULLCONTACT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }
    );

    if (response.status === 404 || response.status === 422) {
      return {
        success: true,
        source: 'FullContact',
        checkedAt: now,
        data: {
          profilesFound: false,
          profiles: [],
          consistencyScore: 0,
        },
      };
    }

    if (!response.ok) {
      throw new Error(`FullContact API error: ${response.status}`);
    }

    const data = await response.json();
    const profiles: SocialProfileResult['data']['profiles'] = [];

    // Extract social profiles
    if (data.twitter) {
      profiles.push({
        platform: 'Twitter',
        username: data.twitter.username,
        url: `https://twitter.com/${data.twitter.username}`,
        followers: data.twitter.followers,
      });
    }
    if (data.linkedin) {
      profiles.push({
        platform: 'LinkedIn',
        url: data.linkedin.url,
        fullName: data.fullName,
      });
    }
    if (data.facebook) {
      profiles.push({
        platform: 'Facebook',
        url: data.facebook.url,
      });
    }

    return {
      success: true,
      source: 'FullContact',
      checkedAt: now,
      data: {
        profilesFound: profiles.length > 0,
        profiles,
        consistencyScore: profiles.length > 0 ? 70 + (profiles.length * 10) : 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all email checks
 */
export async function runAllEmailChecks(email: string) {
  const [verification, reputation, breaches, profiles] = await Promise.all([
    verifyEmailHunter(email),
    checkEmailReputation(email),
    checkEmailBreaches(email),
    enrichEmailProfiles(email),
  ]);

  return {
    verification,
    reputation,
    breaches,
    profiles,
  };
}
