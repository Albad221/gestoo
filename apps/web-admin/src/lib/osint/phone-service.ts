/**
 * Phone Verification OSINT Services
 *
 * Integrates with:
 * - Numverify - Phone validation & carrier lookup
 * - Twilio Lookup - Phone type & carrier info
 * - Truecaller - Caller ID & spam detection
 * - libphonenumber - Local phone format validation
 */

import type { PhoneVerificationResult, OSINTResult } from './types';

const NUMVERIFY_API_KEY = process.env.NEXT_PUBLIC_NUMVERIFY_API_KEY || '';
const TWILIO_ACCOUNT_SID = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN || '';
const TRUECALLER_API_KEY = process.env.NEXT_PUBLIC_TRUECALLER_API_KEY || '';

/**
 * Numverify - Phone Validation
 * Docs: https://numverify.com/documentation
 * Free: 100 requests/month | Paid: from $14.99/month
 */
export async function verifyPhoneNumverify(phone: string): Promise<PhoneVerificationResult> {
  const now = new Date().toISOString();

  if (!NUMVERIFY_API_KEY) {
    return {
      success: false,
      source: 'Numverify',
      checkedAt: now,
      error: 'API key not configured',
    };
  }

  try {
    // Clean phone number (remove spaces, dashes)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    const response = await fetch(
      `http://apilayer.net/api/validate?access_key=${NUMVERIFY_API_KEY}&number=${encodeURIComponent(cleanPhone)}&format=1`
    );

    if (!response.ok) {
      throw new Error(`Numverify API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.info || 'Numverify error');
    }

    return {
      success: true,
      source: 'Numverify',
      checkedAt: now,
      data: {
        isValid: data.valid || false,
        countryCode: data.country_code || '',
        countryName: data.country_name || '',
        carrier: data.carrier || 'Unknown',
        lineType: mapNumverifyLineType(data.line_type),
        localFormat: data.local_format || '',
        internationalFormat: data.international_format || '',
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Numverify',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function mapNumverifyLineType(type: string): NonNullable<PhoneVerificationResult['data']>['lineType'] {
  switch (type?.toLowerCase()) {
    case 'mobile': return 'mobile';
    case 'landline': return 'landline';
    case 'voip': return 'voip';
    default: return 'unknown';
  }
}

/**
 * Twilio Lookup API
 * Docs: https://www.twilio.com/docs/lookup/api
 * Cost: $0.005 per lookup (carrier), $0.01 (line type)
 */
export async function verifyPhoneTwilio(phone: string): Promise<PhoneVerificationResult> {
  const now = new Date().toISOString();

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return {
      success: false,
      source: 'Twilio Lookup',
      checkedAt: now,
      error: 'Twilio credentials not configured',
    };
  }

  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(
      `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(cleanPhone)}?Type=carrier&Type=caller-name`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          source: 'Twilio Lookup',
          checkedAt: now,
          data: {
            isValid: false,
            countryCode: '',
            countryName: '',
            carrier: '',
            lineType: 'unknown',
            localFormat: '',
            internationalFormat: '',
          },
        };
      }
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      source: 'Twilio Lookup',
      checkedAt: now,
      data: {
        isValid: true,
        countryCode: data.country_code || '',
        countryName: '', // Twilio doesn't return country name
        carrier: data.carrier?.name || 'Unknown',
        lineType: mapTwilioLineType(data.carrier?.type),
        localFormat: data.national_format || '',
        internationalFormat: data.phone_number || '',
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Twilio Lookup',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function mapTwilioLineType(type: string): NonNullable<PhoneVerificationResult['data']>['lineType'] {
  switch (type?.toLowerCase()) {
    case 'mobile': return 'mobile';
    case 'landline': return 'landline';
    case 'voip': return 'voip';
    default: return 'unknown';
  }
}

/**
 * Truecaller API - Caller ID & Spam Detection
 * Docs: https://developer.truecaller.com/
 * Requires: Business partnership application
 * Note: Truecaller has strict API access - requires business verification
 */
export interface TruecallerResult extends OSINTResult {
  data?: {
    name: string;
    isSpammer: boolean;
    spamScore: number; // 0-10
    spamType?: string;
    carrier?: string;
    countryCode: string;
    tags: string[];
    image?: string;
  };
}

export async function lookupTruecaller(phone: string): Promise<TruecallerResult> {
  const now = new Date().toISOString();

  if (!TRUECALLER_API_KEY) {
    return {
      success: false,
      source: 'Truecaller',
      checkedAt: now,
      error: 'API key not configured - requires Truecaller business partnership',
    };
  }

  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Truecaller API endpoint (requires approved developer access)
    const response = await fetch(
      `https://api4.truecaller.com/v1/search?q=${encodeURIComponent(cleanPhone)}&countryCode=SN&type=4`,
      {
        headers: {
          'Authorization': `Bearer ${TRUECALLER_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          source: 'Truecaller',
          checkedAt: now,
          data: {
            name: 'Unknown',
            isSpammer: false,
            spamScore: 0,
            countryCode: '',
            tags: [],
          },
        };
      }
      throw new Error(`Truecaller API error: ${response.status}`);
    }

    const result = await response.json();
    const data = result.data?.[0];

    if (!data) {
      return {
        success: true,
        source: 'Truecaller',
        checkedAt: now,
        data: {
          name: 'Not found',
          isSpammer: false,
          spamScore: 0,
          countryCode: '',
          tags: [],
        },
      };
    }

    return {
      success: true,
      source: 'Truecaller',
      checkedAt: now,
      data: {
        name: data.name || 'Unknown',
        isSpammer: data.spamInfo?.spamScore > 5,
        spamScore: data.spamInfo?.spamScore || 0,
        spamType: data.spamInfo?.spamType,
        carrier: data.carrier,
        countryCode: data.countryCode || '',
        tags: data.tags || [],
        image: data.image,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Truecaller',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Local phone validation using libphonenumber patterns
 * No API key required - runs locally
 */
export interface LocalPhoneValidation {
  isValid: boolean;
  isPossible: boolean;
  countryCode: string;
  nationalNumber: string;
  type: 'mobile' | 'landline' | 'voip' | 'unknown';
  isSenegalese: boolean;
  operator?: string;
}

// Senegalese phone number patterns
const SENEGAL_PATTERNS = {
  orange: /^(\+221|221)?7[678]\d{7}$/,     // 77, 78, 76
  free: /^(\+221|221)?76\d{7}$/,            // 76
  expresso: /^(\+221|221)?70\d{7}$/,        // 70
  promobile: /^(\+221|221)?75\d{7}$/,       // 75
  landline: /^(\+221|221)?33\d{7}$/,        // 33
};

export function validatePhoneLocal(phone: string): LocalPhoneValidation {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const normalizedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

  // Check if Senegalese number
  const isSenegalese = cleanPhone.startsWith('+221') ||
    cleanPhone.startsWith('221') ||
    /^7[05678]\d{7}$/.test(cleanPhone) ||
    /^33\d{7}$/.test(cleanPhone);

  let operator: string | undefined;
  let type: LocalPhoneValidation['type'] = 'unknown';

  if (isSenegalese) {
    if (SENEGAL_PATTERNS.orange.test(cleanPhone)) {
      operator = 'Orange Sénégal';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.free.test(cleanPhone)) {
      operator = 'Free Sénégal';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.expresso.test(cleanPhone)) {
      operator = 'Expresso Sénégal';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.promobile.test(cleanPhone)) {
      operator = 'Promobile';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.landline.test(cleanPhone)) {
      operator = 'Sonatel (Landline)';
      type = 'landline';
    }
  }

  // Basic E.164 format validation
  const isValidFormat = /^\+?[1-9]\d{6,14}$/.test(cleanPhone);

  return {
    isValid: isValidFormat,
    isPossible: cleanPhone.length >= 8 && cleanPhone.length <= 15,
    countryCode: isSenegalese ? 'SN' : '',
    nationalNumber: cleanPhone.replace(/^\+?221/, ''),
    type,
    isSenegalese,
    operator,
  };
}

/**
 * Run all phone checks
 */
export async function runAllPhoneChecks(phone: string) {
  // Run local validation first (instant)
  const local = validatePhoneLocal(phone);

  // Run API checks in parallel
  const [numverify, twilio, truecaller] = await Promise.all([
    verifyPhoneNumverify(phone),
    verifyPhoneTwilio(phone),
    lookupTruecaller(phone),
  ]);

  return {
    local,
    numverify,
    twilio,
    truecaller,
  };
}
