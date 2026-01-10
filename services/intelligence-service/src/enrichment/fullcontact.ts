/**
 * FullContact Person Enrichment Service
 *
 * Provides person/entity enrichment from email or phone.
 * Returns social profiles, photos, employment info, and demographics.
 *
 * Setup:
 * 1. Get API key from https://www.fullcontact.com/
 * 2. Set FULLCONTACT_API_KEY environment variable
 *
 * Pricing: Free tier available (100 matches/month), paid plans from $99/month
 */

import type { PersonEnrichmentResult } from './types';

const FULLCONTACT_API_KEY = process.env.FULLCONTACT_API_KEY || '';
const FULLCONTACT_API_URL = 'https://api.fullcontact.com/v3/person.enrich';

/**
 * Enrich person data from email address
 *
 * @param email - Email address to enrich
 * @returns Enriched person data including social profiles, photos, etc.
 */
export async function enrichFromEmail(email: string): Promise<PersonEnrichmentResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  if (!FULLCONTACT_API_KEY) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'FullContact API key not configured. Set FULLCONTACT_API_KEY environment variable.',
    };
  }

  try {
    const response = await fetch(FULLCONTACT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FULLCONTACT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    // 404 or 422 means no profile found (not an error)
    if (response.status === 404 || response.status === 422) {
      return {
        success: true,
        source: 'FullContact',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          fullName: undefined,
          emails: [{ email, type: 'input' }],
          phones: [],
          socialProfiles: [],
          photos: [],
          locations: [],
          employment: [],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`FullContact API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: transformFullContactResponse(data, email),
    };
  } catch (error) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during FullContact enrichment',
    };
  }
}

/**
 * Enrich person data from phone number
 *
 * @param phone - Phone number to enrich
 * @returns Enriched person data including social profiles, photos, etc.
 */
export async function enrichFromPhone(phone: string): Promise<PersonEnrichmentResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  if (!FULLCONTACT_API_KEY) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'FullContact API key not configured. Set FULLCONTACT_API_KEY environment variable.',
    };
  }

  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    const response = await fetch(FULLCONTACT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FULLCONTACT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: cleanPhone }),
    });

    // 404 or 422 means no profile found (not an error)
    if (response.status === 404 || response.status === 422) {
      return {
        success: true,
        source: 'FullContact',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          fullName: undefined,
          emails: [],
          phones: [{ number: cleanPhone, type: 'input' }],
          socialProfiles: [],
          photos: [],
          locations: [],
          employment: [],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`FullContact API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: transformFullContactResponse(data, undefined, cleanPhone),
    };
  } catch (error) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during FullContact enrichment',
    };
  }
}

/**
 * Enrich person data from multiple identifiers
 *
 * @param identifiers - Object containing email, phone, or name
 * @returns Enriched person data
 */
export async function enrichPerson(identifiers: {
  email?: string;
  phone?: string;
  name?: string;
}): Promise<PersonEnrichmentResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  if (!FULLCONTACT_API_KEY) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'FullContact API key not configured. Set FULLCONTACT_API_KEY environment variable.',
    };
  }

  if (!identifiers.email && !identifiers.phone && !identifiers.name) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'At least one identifier (email, phone, or name) is required',
    };
  }

  try {
    const requestBody: Record<string, string> = {};

    if (identifiers.email) {
      requestBody.email = identifiers.email;
    }
    if (identifiers.phone) {
      requestBody.phone = identifiers.phone.replace(/[\s\-\(\)]/g, '');
    }
    if (identifiers.name) {
      requestBody.name = identifiers.name;
    }

    const response = await fetch(FULLCONTACT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FULLCONTACT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // 404 or 422 means no profile found
    if (response.status === 404 || response.status === 422) {
      return {
        success: true,
        source: 'FullContact',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          fullName: identifiers.name,
          emails: identifiers.email ? [{ email: identifiers.email, type: 'input' }] : [],
          phones: identifiers.phone ? [{ number: identifiers.phone, type: 'input' }] : [],
          socialProfiles: [],
          photos: [],
          locations: [],
          employment: [],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`FullContact API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: transformFullContactResponse(data, identifiers.email, identifiers.phone),
    };
  } catch (error) {
    return {
      success: false,
      source: 'FullContact',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during FullContact enrichment',
    };
  }
}

/**
 * Transform FullContact API response to our standard format
 */
function transformFullContactResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  inputEmail?: string,
  inputPhone?: string
): NonNullable<PersonEnrichmentResult['data']> {
  const result: NonNullable<PersonEnrichmentResult['data']> = {
    fullName: data.fullName || undefined,
    emails: [],
    phones: [],
    socialProfiles: [],
    photos: [],
    locations: [],
    employment: [],
    demographics: undefined,
  };

  // Extract emails
  if (data.emails) {
    for (const email of data.emails) {
      result.emails!.push({
        email: email.value || email,
        type: email.type || 'unknown',
      });
    }
  }
  // Add input email if not already present
  if (inputEmail && !result.emails!.find(e => e.email === inputEmail)) {
    result.emails!.unshift({ email: inputEmail, type: 'input' });
  }

  // Extract phones
  if (data.phones) {
    for (const phone of data.phones) {
      result.phones!.push({
        number: phone.value || phone,
        type: phone.type || 'unknown',
      });
    }
  }
  // Add input phone if not already present
  if (inputPhone && !result.phones!.find(p => p.number === inputPhone)) {
    result.phones!.unshift({ number: inputPhone, type: 'input' });
  }

  // Extract social profiles
  if (data.socialProfiles || data.profiles) {
    const profiles = data.socialProfiles || data.profiles;
    for (const profile of profiles) {
      result.socialProfiles!.push({
        platform: profile.type || profile.network || 'unknown',
        url: profile.url || undefined,
        username: profile.username || undefined,
        photo: profile.photo || undefined,
        followers: profile.followers || undefined,
      });
    }
  }

  // Extract specific social platforms
  if (data.twitter) {
    result.socialProfiles!.push({
      platform: 'twitter',
      url: `https://twitter.com/${data.twitter.username}`,
      username: data.twitter.username,
      followers: data.twitter.followers,
    });
  }
  if (data.linkedin) {
    result.socialProfiles!.push({
      platform: 'linkedin',
      url: data.linkedin.url,
    });
  }
  if (data.facebook) {
    result.socialProfiles!.push({
      platform: 'facebook',
      url: data.facebook.url,
    });
  }

  // Extract photos
  if (data.photos) {
    for (const photo of data.photos) {
      result.photos!.push({
        url: photo.url || photo,
        source: photo.type || 'fullcontact',
      });
    }
  }
  if (data.avatar) {
    result.photos!.push({
      url: data.avatar,
      source: 'avatar',
    });
  }

  // Extract locations
  if (data.locations || data.location) {
    const locations = data.locations || [data.location];
    for (const loc of locations) {
      if (typeof loc === 'string') {
        result.locations!.push({ formatted: loc });
      } else {
        result.locations!.push({
          city: loc.city,
          region: loc.region || loc.state,
          country: loc.country,
          formatted: [loc.city, loc.region || loc.state, loc.country]
            .filter(Boolean)
            .join(', '),
        });
      }
    }
  }

  // Extract employment
  if (data.employment || data.organizations) {
    const employment = data.employment || data.organizations;
    for (const job of employment) {
      result.employment!.push({
        company: job.name || job.organization,
        title: job.title,
        current: job.current ?? true,
      });
    }
  }

  // Extract demographics
  if (data.demographics || data.age || data.gender) {
    result.demographics = {
      age: data.age || data.demographics?.age,
      ageRange: data.ageRange || data.demographics?.ageRange,
      gender: data.gender || data.demographics?.gender,
    };
  }

  return result;
}

/**
 * Check email reputation using EmailRep.io (free, no key required)
 */
export async function checkEmailReputation(email: string): Promise<{
  success: boolean;
  source: string;
  checkedAt: string;
  duration?: number;
  data?: {
    reputation: 'high' | 'medium' | 'low' | 'none';
    suspicious: boolean;
    malicious: boolean;
    spam: boolean;
    disposable: boolean;
    profilesFound: string[];
    score: number;
  };
  error?: string;
}> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const response = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers: {
        'User-Agent': 'TerangaSafe-IntelligenceService/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`EmailRep API error: ${response.status}`);
    }

    const data = await response.json();

    // Map reputation to score
    const reputationScore =
      data.reputation === 'high' ? 90 :
      data.reputation === 'medium' ? 60 :
      data.reputation === 'low' ? 30 : 0;

    return {
      success: true,
      source: 'EmailRep',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        reputation: data.reputation || 'none',
        suspicious: data.suspicious || false,
        malicious: data.details?.malicious_activity || false,
        spam: data.details?.spam || false,
        disposable: data.details?.disposable || false,
        profilesFound: data.details?.profiles || [],
        score: reputationScore,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'EmailRep',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check email in data breaches using Have I Been Pwned API
 */
export async function checkEmailBreaches(email: string): Promise<{
  success: boolean;
  source: string;
  checkedAt: string;
  duration?: number;
  data?: {
    breached: boolean;
    breachCount: number;
    breaches: Array<{
      name: string;
      domain: string;
      breachDate: string;
      dataClasses: string[];
    }>;
  };
  error?: string;
}> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  const hibpKey = process.env.HIBP_API_KEY;

  if (!hibpKey) {
    return {
      success: false,
      source: 'HaveIBeenPwned',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'HIBP API key not configured. Set HIBP_API_KEY environment variable.',
    };
  }

  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': hibpKey,
          'User-Agent': 'TerangaSafe-IntelligenceService/1.0',
        },
      }
    );

    // 404 means no breaches found (this is good!)
    if (response.status === 404) {
      return {
        success: true,
        source: 'HaveIBeenPwned',
        checkedAt: now,
        duration: Date.now() - startTime,
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
      source: 'HaveIBeenPwned',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        breached: breaches.length > 0,
        breachCount: breaches.length,
        breaches: breaches.slice(0, 20).map((b: Record<string, unknown>) => ({
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
      source: 'HaveIBeenPwned',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all enrichment lookups for an email
 */
export async function runAllEmailEnrichment(email: string) {
  const [fullContact, emailRep, breaches] = await Promise.all([
    enrichFromEmail(email),
    checkEmailReputation(email),
    checkEmailBreaches(email),
  ]);

  return {
    fullContact,
    emailRep,
    breaches,
  };
}
