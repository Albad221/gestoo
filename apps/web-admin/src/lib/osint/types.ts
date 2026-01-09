/**
 * OSINT Service Types
 * Teranga Safe - National Accommodation Registration Platform
 */

export interface OSINTResult {
  success: boolean;
  source: string;
  checkedAt: string;
  data?: Record<string, unknown>;
  error?: string;
}

// Email Verification Types
export interface EmailVerificationResult extends OSINTResult {
  data?: {
    isValid: boolean;
    isDeliverable: boolean;
    isFreeProvider: boolean;
    isDisposable: boolean;
    domain: string;
    mxRecords: boolean;
    smtpCheck: boolean;
    score: number; // 0-100
  };
}

export interface EmailReputationResult extends OSINTResult {
  data?: {
    reputation: 'high' | 'medium' | 'low' | 'none';
    suspicious: boolean;
    malicious: boolean;
    spamReported: boolean;
    blacklisted: boolean;
    profilesFound: string[];
    daysSinceFirstSeen: number;
    score: number;
  };
}

export interface BreachCheckResult extends OSINTResult {
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
}

// Phone Verification Types
export interface PhoneVerificationResult extends OSINTResult {
  data?: {
    isValid: boolean;
    countryCode: string;
    countryName: string;
    carrier: string;
    lineType: 'mobile' | 'landline' | 'voip' | 'unknown';
    localFormat: string;
    internationalFormat: string;
  };
}

// Sanctions Check Types
export interface SanctionsCheckResult extends OSINTResult {
  data?: {
    isMatch: boolean;
    matches: Array<{
      name: string;
      listName: string;
      entityType: string;
      programs: string[];
      remarks: string;
      score: number; // Fuzzy match score 0-100
    }>;
  };
}

// Watchlist Types
export interface WatchlistCheckResult extends OSINTResult {
  data?: {
    isMatch: boolean;
    matches: Array<{
      name: string;
      source: string;
      noticeType?: string;
      entityId?: string;
      charges?: string[];
      nationality?: string;
      dateOfBirth?: string;
    }>;
  };
}

// Document Validation Types
export interface MRZValidationResult extends OSINTResult {
  data?: {
    isValid: boolean;
    documentType: string;
    issuingCountry: string;
    lastName: string;
    firstName: string;
    documentNumber: string;
    nationality: string;
    dateOfBirth: string;
    sex: string;
    expirationDate: string;
    checksumValid: {
      documentNumber: boolean;
      dateOfBirth: boolean;
      expirationDate: boolean;
      composite: boolean;
    };
  };
}

// Social Profile Types
export interface SocialProfileResult extends OSINTResult {
  data?: {
    profilesFound: boolean;
    profiles: Array<{
      platform: string;
      username?: string;
      url?: string;
      fullName?: string;
      bio?: string;
      followers?: number;
      verified?: boolean;
    }>;
    photoMatch?: boolean;
    consistencyScore: number; // How consistent identity is across profiles
  };
}

// API Configuration
export interface OSINTConfig {
  hunterApiKey?: string;
  emailRepApiKey?: string;
  hibpApiKey?: string;
  numverifyApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  fullContactApiKey?: string;
  clearbitApiKey?: string;
}
