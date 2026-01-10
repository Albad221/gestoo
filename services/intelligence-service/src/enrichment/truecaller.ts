/**
 * Truecaller Phone Lookup Service
 *
 * Provides phone number lookup capabilities using Truecaller API.
 * Returns owner name, email, photo, carrier info, and spam detection.
 *
 * Setup:
 * 1. Install truecallerjs: npm install truecallerjs
 * 2. Get installation ID by following truecallerjs documentation
 * 3. Set TRUECALLER_INSTALLATION_ID environment variable
 */

import type { PhoneLookupResult } from './types';

const TRUECALLER_INSTALLATION_ID = process.env.TRUECALLER_INSTALLATION_ID || '';

// Country code mapping for phone prefixes
const COUNTRY_CODE_MAP: Record<string, string> = {
  '+221': 'SN', // Senegal
  '+33': 'FR',  // France
  '+1': 'US',   // USA/Canada
  '+234': 'NG', // Nigeria
  '+91': 'IN',  // India
  '+44': 'GB',  // UK
  '+49': 'DE',  // Germany
  '+212': 'MA', // Morocco
  '+225': 'CI', // Ivory Coast
  '+237': 'CM', // Cameroon
};

/**
 * Detect country code from phone number
 */
function detectCountryCode(phone: string): string {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  for (const [prefix, code] of Object.entries(COUNTRY_CODE_MAP)) {
    if (cleanPhone.startsWith(prefix)) {
      return code;
    }
  }

  // Default to Senegal for this application
  return 'SN';
}

/**
 * Lookup phone number using Truecaller
 *
 * @param phone - Phone number to lookup (with or without country code)
 * @returns Phone lookup result with name, email, photo, etc.
 */
export async function lookupTruecaller(phone: string): Promise<PhoneLookupResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  if (!TRUECALLER_INSTALLATION_ID) {
    return {
      success: false,
      source: 'Truecaller',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'Truecaller installation ID not configured. Set TRUECALLER_INSTALLATION_ID environment variable.',
    };
  }

  try {
    // Dynamic import for truecallerjs (ESM module)
    const truecallerjs = await import('truecallerjs');

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const countryCode = detectCountryCode(cleanPhone);

    const searchData = {
      number: cleanPhone.replace(/^\+/, ''),
      countryCode,
      installationId: TRUECALLER_INSTALLATION_ID,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await truecallerjs.search(searchData);
    const rawData = response.json();

    // Check if we got valid data
    if (!rawData?.data?.[0]) {
      return {
        success: true,
        source: 'Truecaller',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          name: undefined,
          carrier: undefined,
          countryCode,
          lineType: 'unknown',
        },
      };
    }

    const personData = rawData.data[0];

    // Extract addresses
    const addresses: PhoneLookupResult['data'] extends infer T
      ? T extends { addresses?: infer A } ? A : never
      : never = [];

    if (personData.addresses) {
      for (const addr of personData.addresses) {
        addresses.push({
          city: addr.city,
          country: addr.countryCode,
          formatted: [addr.city, addr.countryCode].filter(Boolean).join(', '),
        });
      }
    }

    // Extract alternate phones
    const alternatePhones: string[] = [];
    if (typeof response.getAlternateNumber === 'function') {
      const altPhone = response.getAlternateNumber();
      if (altPhone && altPhone !== cleanPhone) {
        alternatePhones.push(altPhone);
      }
    }

    // Spam detection
    const spamInfo = personData.spamInfo;
    const isSpammer = spamInfo?.spamScore ? spamInfo.spamScore > 5 : false;

    return {
      success: true,
      source: 'Truecaller',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        name: response.getName() !== 'Unknown' ? response.getName() : undefined,
        email: response.getEmailId() || undefined,
        photo: personData.image || undefined,
        carrier: personData.carrier || undefined,
        countryCode,
        lineType: 'mobile', // Truecaller mainly deals with mobile numbers
        isSpammer,
        spamScore: spamInfo?.spamScore,
        addresses: addresses.length > 0 ? addresses : undefined,
        alternatePhones: alternatePhones.length > 0 ? alternatePhones : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Truecaller',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during Truecaller lookup',
    };
  }
}

/**
 * Validate phone number format using local patterns
 * No external API required
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

/**
 * Validate phone number locally without API call
 */
export function validatePhoneLocal(phone: string): LocalPhoneValidation {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Check if Senegalese number
  const isSenegalese = cleanPhone.startsWith('+221') ||
    cleanPhone.startsWith('221') ||
    /^7[05678]\d{7}$/.test(cleanPhone) ||
    /^33\d{7}$/.test(cleanPhone);

  let operator: string | undefined;
  let type: LocalPhoneValidation['type'] = 'unknown';

  if (isSenegalese) {
    if (SENEGAL_PATTERNS.orange.test(cleanPhone)) {
      operator = 'Orange Senegal';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.free.test(cleanPhone)) {
      operator = 'Free Senegal';
      type = 'mobile';
    } else if (SENEGAL_PATTERNS.expresso.test(cleanPhone)) {
      operator = 'Expresso Senegal';
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
    countryCode: isSenegalese ? 'SN' : detectCountryCode(cleanPhone),
    nationalNumber: cleanPhone.replace(/^\+?221/, ''),
    type,
    isSenegalese,
    operator,
  };
}

/**
 * Lookup phone with Numverify API (carrier validation)
 */
export async function lookupNumverify(phone: string): Promise<PhoneLookupResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  const numverifyKey = process.env.NUMVERIFY_API_KEY;

  if (!numverifyKey) {
    return {
      success: false,
      source: 'Numverify',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: 'Numverify API key not configured',
    };
  }

  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const response = await fetch(
      `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${encodeURIComponent(cleanPhone)}&format=1`
    );

    if (!response.ok) {
      throw new Error(`Numverify API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.info || 'Numverify error');
    }

    const lineType = data.line_type?.toLowerCase();

    return {
      success: true,
      source: 'Numverify',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        carrier: data.carrier || undefined,
        countryCode: data.country_code || undefined,
        lineType: lineType === 'mobile' ? 'mobile' :
                  lineType === 'landline' ? 'landline' :
                  lineType === 'voip' ? 'voip' : 'unknown',
        addresses: data.location ? [{
          formatted: data.location,
          country: data.country_name,
        }] : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Numverify',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all phone lookups in parallel
 */
export async function runAllPhoneLookups(phone: string): Promise<{
  truecaller: PhoneLookupResult;
  numverify: PhoneLookupResult;
  local: LocalPhoneValidation;
}> {
  const local = validatePhoneLocal(phone);

  const [truecaller, numverify] = await Promise.all([
    lookupTruecaller(phone),
    lookupNumverify(phone),
  ]);

  return {
    truecaller,
    numverify,
    local,
  };
}
