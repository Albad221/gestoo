/**
 * Document Validation Services
 *
 * Implements ICAO Doc 9303 standards for:
 * - MRZ (Machine Readable Zone) parsing
 * - Check digit validation
 * - Document format validation
 *
 * No API required - runs locally using ICAO specifications
 */

import type { MRZValidationResult } from './types';

/**
 * Character weight map for MRZ check digit calculation
 * ICAO Doc 9303 Part 3
 */
const MRZ_WEIGHTS = [7, 3, 1];

const MRZ_CHAR_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '<': 0,
  'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14,
  'F': 15, 'G': 16, 'H': 17, 'I': 18, 'J': 19,
  'K': 20, 'L': 21, 'M': 22, 'N': 23, 'O': 24,
  'P': 25, 'Q': 26, 'R': 27, 'S': 28, 'T': 29,
  'U': 30, 'V': 31, 'W': 32, 'X': 33, 'Y': 34,
  'Z': 35,
};

/**
 * Calculate MRZ check digit according to ICAO Doc 9303
 */
function calculateCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase();
    const value = MRZ_CHAR_VALUES[char] ?? 0;
    const weight = MRZ_WEIGHTS[i % 3];
    sum += value * weight;
  }
  return sum % 10;
}

/**
 * Validate a check digit
 */
function validateCheckDigit(data: string, checkDigit: string): boolean {
  const calculated = calculateCheckDigit(data);
  const provided = parseInt(checkDigit, 10);
  return calculated === provided;
}

/**
 * Parse TD3 format (Passport - 2 lines of 44 characters)
 * Line 1: P<UTONORMAN<<ERWIN<<<<<<<<<<<<<<<<<<<<<<<<<
 * Line 2: L898902C<3UTO6908061F9406236<<<<<<<<<<<<<04
 */
interface TD3ParseResult {
  documentType: string;
  issuingCountry: string;
  lastName: string;
  firstName: string;
  documentNumber: string;
  documentNumberCheckDigit: string;
  nationality: string;
  dateOfBirth: string;
  dateOfBirthCheckDigit: string;
  sex: string;
  expirationDate: string;
  expirationDateCheckDigit: string;
  personalNumber: string;
  personalNumberCheckDigit: string;
  compositeCheckDigit: string;
}

function parseTD3(line1: string, line2: string): TD3ParseResult | null {
  if (line1.length !== 44 || line2.length !== 44) {
    return null;
  }

  // Parse names (replace < with space, trim multiple spaces)
  const namePart = line1.substring(5);
  const names = namePart.split('<<');
  const lastName = names[0]?.replace(/</g, ' ').trim() || '';
  const firstName = names[1]?.replace(/</g, ' ').trim() || '';

  return {
    documentType: line1.substring(0, 2).replace(/</g, ''),
    issuingCountry: line1.substring(2, 5),
    lastName,
    firstName,
    documentNumber: line2.substring(0, 9).replace(/</g, ''),
    documentNumberCheckDigit: line2.substring(9, 10),
    nationality: line2.substring(10, 13),
    dateOfBirth: line2.substring(13, 19),
    dateOfBirthCheckDigit: line2.substring(19, 20),
    sex: line2.substring(20, 21),
    expirationDate: line2.substring(21, 27),
    expirationDateCheckDigit: line2.substring(27, 28),
    personalNumber: line2.substring(28, 42).replace(/</g, ''),
    personalNumberCheckDigit: line2.substring(42, 43),
    compositeCheckDigit: line2.substring(43, 44),
  };
}

/**
 * Format YYMMDD date to readable format
 */
function formatMRZDate(date: string): string {
  if (date.length !== 6) return date;

  const year = parseInt(date.substring(0, 2), 10);
  const month = date.substring(2, 4);
  const day = date.substring(4, 6);

  // ICAO: years 00-99 map to 2000-2099 for future dates (expiration)
  // and 1900-1999 for past dates (birth)
  const fullYear = year > 50 ? 1900 + year : 2000 + year;

  return `${fullYear}-${month}-${day}`;
}

/**
 * Validate a passport MRZ
 */
export function validatePassportMRZ(mrz: string): MRZValidationResult {
  const now = new Date().toISOString();

  try {
    // Clean and split into lines
    const cleanMRZ = mrz.toUpperCase().replace(/[^A-Z0-9<
]/g, '');
    const lines = cleanMRZ.split('
').filter(l => l.length > 0);

    if (lines.length !== 2) {
      return {
        success: false,
        source: 'MRZ Validator (ICAO Doc 9303)',
        checkedAt: now,
        error: 'Invalid MRZ format - expected 2 lines',
      };
    }

    const parsed = parseTD3(lines[0], lines[1]);

    if (!parsed) {
      return {
        success: false,
        source: 'MRZ Validator (ICAO Doc 9303)',
        checkedAt: now,
        error: 'Invalid MRZ format - lines must be 44 characters',
      };
    }

    // Validate check digits
    const docNumValid = validateCheckDigit(
      lines[1].substring(0, 9),
      parsed.documentNumberCheckDigit
    );

    const dobValid = validateCheckDigit(
      parsed.dateOfBirth,
      parsed.dateOfBirthCheckDigit
    );

    const expValid = validateCheckDigit(
      parsed.expirationDate,
      parsed.expirationDateCheckDigit
    );

    // Composite check digit (positions 0-9, 13-19, 21-42)
    const compositeData =
      lines[1].substring(0, 10) +
      lines[1].substring(13, 20) +
      lines[1].substring(21, 43);
    const compositeValid = validateCheckDigit(
      compositeData,
      parsed.compositeCheckDigit
    );

    const allValid = docNumValid && dobValid && expValid && compositeValid;

    return {
      success: true,
      source: 'MRZ Validator (ICAO Doc 9303)',
      checkedAt: now,
      data: {
        isValid: allValid,
        documentType: parsed.documentType,
        issuingCountry: parsed.issuingCountry,
        lastName: parsed.lastName,
        firstName: parsed.firstName,
        documentNumber: parsed.documentNumber,
        nationality: parsed.nationality,
        dateOfBirth: formatMRZDate(parsed.dateOfBirth),
        sex: parsed.sex === 'M' ? 'Male' : parsed.sex === 'F' ? 'Female' : 'Unspecified',
        expirationDate: formatMRZDate(parsed.expirationDate),
        checksumValid: {
          documentNumber: docNumValid,
          dateOfBirth: dobValid,
          expirationDate: expValid,
          composite: compositeValid,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'MRZ Validator (ICAO Doc 9303)',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate passport number format by country
 * Each country has specific patterns
 */
interface PassportFormatResult {
  isValid: boolean;
  country: string;
  pattern: string;
  details: string;
}

const PASSPORT_PATTERNS: Record<string, { pattern: RegExp; description: string }> = {
  // Senegal
  SN: {
    pattern: /^[A-Z]{2}\d{7}$/,
    description: '2 letters + 7 digits (e.g., SN1234567)',
  },
  // France
  FR: {
    pattern: /^\d{2}[A-Z]{2}\d{5}$/,
    description: '2 digits + 2 letters + 5 digits',
  },
  // USA
  US: {
    pattern: /^[A-Z]?\d{8,9}$/,
    description: '8-9 digits, optional leading letter',
  },
  // UK
  GB: {
    pattern: /^\d{9}$/,
    description: '9 digits',
  },
  // Germany
  DE: {
    pattern: /^[CFGHJKLMNPRTVWXYZ0-9]{9}$/,
    description: '9 alphanumeric (no vowels)',
  },
  // Generic ICAO format
  DEFAULT: {
    pattern: /^[A-Z0-9]{6,12}$/,
    description: '6-12 alphanumeric characters',
  },
};

export function validatePassportFormat(
  passportNumber: string,
  countryCode: string
): PassportFormatResult {
  const cleanNumber = passportNumber.toUpperCase().replace(/[\s-]/g, '');
  const country = countryCode.toUpperCase();

  const format = PASSPORT_PATTERNS[country] || PASSPORT_PATTERNS.DEFAULT;
  const isValid = format.pattern.test(cleanNumber);

  return {
    isValid,
    country,
    pattern: format.description,
    details: isValid
      ? `Passport number ${cleanNumber} matches ${country} format`
      : `Passport number ${cleanNumber} does not match expected ${country} format (${format.description})`,
  };
}

/**
 * Validate Senegalese CNI (Carte Nationale d'Identité)
 * Format: 1 letter + 7 digits + 1 letter (e.g., A1234567B)
 */
export function validateSenegaleseCNI(cniNumber: string): {
  isValid: boolean;
  details: string;
} {
  const cleanNumber = cniNumber.toUpperCase().replace(/[\s-]/g, '');

  // Senegalese CNI format
  const pattern = /^[A-Z]\d{7}[A-Z]$/;
  const isValid = pattern.test(cleanNumber);

  return {
    isValid,
    details: isValid
      ? `CNI ${cleanNumber} matches Senegalese format`
      : `CNI ${cleanNumber} does not match expected format (1 letter + 7 digits + 1 letter)`,
  };
}

/**
 * Run all document validation checks
 */
export function runAllDocumentChecks(
  documentNumber: string,
  documentType: 'passport' | 'national_id',
  countryCode: string,
  mrz?: string
) {
  const results: {
    formatValid: boolean;
    mrzValid?: boolean;
    checksumDetails?: MRZValidationResult['data']['checksumValid'];
    details: string[];
  } = {
    formatValid: false,
    details: [],
  };

  if (documentType === 'passport') {
    const formatCheck = validatePassportFormat(documentNumber, countryCode);
    results.formatValid = formatCheck.isValid;
    results.details.push(formatCheck.details);

    if (mrz) {
      const mrzCheck = validatePassportMRZ(mrz);
      if (mrzCheck.success && mrzCheck.data) {
        results.mrzValid = mrzCheck.data.isValid;
        results.checksumDetails = mrzCheck.data.checksumValid;
        results.details.push(
          `MRZ validation: ${mrzCheck.data.isValid ? 'PASSED' : 'FAILED'}`
        );
      }
    }
  } else if (documentType === 'national_id' && countryCode === 'SN') {
    const cniCheck = validateSenegaleseCNI(documentNumber);
    results.formatValid = cniCheck.isValid;
    results.details.push(cniCheck.details);
  }

  return results;
}
