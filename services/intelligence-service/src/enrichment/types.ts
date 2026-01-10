/**
 * Enrichment Service Types
 * Consolidated OSINT types for person/entity enrichment
 */

// Base result type for all enrichment sources
export interface EnrichmentResult {
  success: boolean;
  source: string;
  checkedAt: string;
  duration?: number;
  error?: string;
}

// Phone lookup result (Truecaller, etc.)
export interface PhoneLookupResult extends EnrichmentResult {
  data?: {
    name?: string;
    email?: string;
    photo?: string;
    carrier?: string;
    countryCode?: string;
    lineType?: 'mobile' | 'landline' | 'voip' | 'unknown';
    isSpammer?: boolean;
    spamScore?: number;
    addresses?: Array<{
      city?: string;
      country?: string;
      formatted?: string;
    }>;
    alternatePhones?: string[];
  };
}

// Email/Person enrichment result (FullContact, etc.)
export interface PersonEnrichmentResult extends EnrichmentResult {
  data?: {
    fullName?: string;
    emails?: Array<{
      email: string;
      type?: string;
    }>;
    phones?: Array<{
      number: string;
      type?: string;
    }>;
    socialProfiles?: Array<{
      platform: string;
      url?: string;
      username?: string;
      photo?: string;
      followers?: number;
    }>;
    photos?: Array<{
      url: string;
      source: string;
    }>;
    locations?: Array<{
      city?: string;
      region?: string;
      country?: string;
      formatted?: string;
    }>;
    employment?: Array<{
      company?: string;
      title?: string;
      current?: boolean;
    }>;
    demographics?: {
      age?: number;
      ageRange?: string;
      gender?: string;
    };
  };
}

// Sanctions check result (OpenSanctions, etc.)
export interface SanctionsCheckResult extends EnrichmentResult {
  data?: {
    isMatch: boolean;
    matchCount: number;
    matches: SanctionsMatch[];
    listsChecked: string[];
  };
}

export interface SanctionsMatch {
  id: string;
  name: string;
  score: number;
  entityType: string;
  datasets: string[];
  properties?: {
    nationality?: string[];
    birthDate?: string[];
    birthPlace?: string[];
    programs?: string[];
    notes?: string[];
  };
}

// Watchlist check result (Interpol, FBI, etc.)
export interface WatchlistCheckResult extends EnrichmentResult {
  data?: {
    isMatch: boolean;
    matchCount: number;
    matches: WatchlistMatch[];
    sourcesChecked: string[];
  };
}

export interface WatchlistMatch {
  id: string;
  name: string;
  source: string;
  noticeType?: string;
  nationalities?: string[];
  dateOfBirth?: string;
  charges?: string[];
  photo?: string;
  detailsUrl?: string;
}

// Unified enrichment request
export interface EnrichmentRequest {
  // At least one of these should be provided
  phone?: string;
  email?: string;
  name?: string;
  dateOfBirth?: string;
  nationality?: string;

  // Options
  options?: {
    includeSanctions?: boolean;
    includeWatchlists?: boolean;
    includeEnrichment?: boolean;
    includeSocialProfiles?: boolean;
    timeout?: number;
  };
}

// Unified enrichment response
export interface EnrichmentResponse {
  requestId: string;
  timestamp: string;
  processingTime: number;

  // Input data
  input: {
    phone?: string;
    email?: string;
    name?: string;
    dateOfBirth?: string;
    nationality?: string;
  };

  // Discovered identity data
  identity: {
    names: string[];
    emails: Array<{ email: string; source: string }>;
    phones: Array<{ number: string; source: string }>;
    photos: Array<{ url: string; source: string }>;
    locations: string[];
    socialProfiles: Array<{
      platform: string;
      url?: string;
      username?: string;
      source: string;
    }>;
  };

  // Verification results
  verification: {
    sanctions: SanctionsCheckResult;
    watchlists: WatchlistCheckResult;
  };

  // Risk assessment
  risk: {
    score: number;
    level: 'clear' | 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendations: string[];
  };

  // Data sources used
  sources: string[];

  // Errors (if any)
  errors: Array<{
    source: string;
    error: string;
  }>;
}

// Verification request (focused on sanctions/watchlists)
export interface VerificationRequest {
  // Name is required for verification
  firstName: string;
  lastName: string;

  // Optional fields for better matching
  dateOfBirth?: string;
  nationality?: string;
  documentNumber?: string;

  // Options
  options?: {
    strictMatch?: boolean;
    minScore?: number;
    checkSanctions?: boolean;
    checkInterpol?: boolean;
    checkFBI?: boolean;
    checkEuropol?: boolean;
  };
}

// Verification response
export interface VerificationResponse {
  requestId: string;
  timestamp: string;
  processingTime: number;

  // Input
  input: {
    fullName: string;
    dateOfBirth?: string;
    nationality?: string;
  };

  // Verification status
  status: 'clear' | 'review' | 'flagged' | 'blocked';

  // Detailed results
  sanctions: {
    checked: boolean;
    isMatch: boolean;
    matches: SanctionsMatch[];
  };

  watchlists: {
    checked: boolean;
    isMatch: boolean;
    interpol: WatchlistMatch[];
    fbi: WatchlistMatch[];
    europol: WatchlistMatch[];
  };

  // Risk summary
  risk: {
    score: number;
    level: 'clear' | 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    isPEP: boolean;
    recommendations: string[];
  };

  // Sources checked
  sourcesChecked: string[];
}
