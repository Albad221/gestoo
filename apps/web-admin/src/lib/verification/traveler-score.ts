'use client';

/**
 * Traveler Verification & Risk Scoring System
 * For Teranga Safe - National Accommodation Registration Platform
 *
 * This module calculates a trust/risk score based on available verification data
 * from various OSINT and government databases.
 */

export interface VerificationCheck {
  id: string;
  name: string;
  nameFr: string;
  category: 'identity' | 'security' | 'travel' | 'document' | 'osint';
  source: string;
  status: 'verified' | 'warning' | 'alert' | 'pending' | 'unavailable';
  score: number; // -100 to +100
  details?: string;
  checkedAt?: string;
  isPublic?: boolean; // true = publicly available API, false = requires govt access
}

export interface TravelerVerification {
  guestId: string;
  overallScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  checks: VerificationCheck[];
  lastUpdated: string;
  flags: string[];
}

// Verification check definitions
export const VERIFICATION_CHECKS: Omit<VerificationCheck, 'status' | 'score' | 'details' | 'checkedAt'>[] = [
  // ========== PUBLIC OSINT (No special access needed) ==========

  // Email Verification (Public APIs)
  {
    id: 'email_validity',
    name: 'Email Deliverability',
    nameFr: 'Validité email',
    category: 'identity',
    source: 'Hunter.io / Abstract API',
  },
  {
    id: 'email_reputation',
    name: 'Email Reputation Score',
    nameFr: 'Réputation email',
    category: 'identity',
    source: 'EmailRep.io',
  },
  {
    id: 'email_breach_check',
    name: 'Email Breach History',
    nameFr: 'Historique fuites données',
    category: 'security',
    source: 'Have I Been Pwned API',
  },
  {
    id: 'email_social_profiles',
    name: 'Social Media Presence',
    nameFr: 'Présence réseaux sociaux',
    category: 'identity',
    source: 'FullContact / Clearbit',
  },

  // Phone Verification (Public APIs)
  {
    id: 'phone_validity',
    name: 'Phone Number Valid',
    nameFr: 'Numéro téléphone valide',
    category: 'identity',
    source: 'Numverify / Twilio Lookup',
  },
  {
    id: 'phone_carrier',
    name: 'Phone Carrier Info',
    nameFr: 'Opérateur téléphonique',
    category: 'identity',
    source: 'Twilio Lookup / Abstract API',
  },
  {
    id: 'phone_type',
    name: 'Phone Type (Mobile/Landline)',
    nameFr: 'Type téléphone',
    category: 'identity',
    source: 'Numverify',
  },
  {
    id: 'phone_country_match',
    name: 'Phone Country Match',
    nameFr: 'Correspondance pays téléphone',
    category: 'identity',
    source: 'Numverify / libphonenumber',
  },

  // Public Sanctions (Open Data)
  {
    id: 'ofac_sdn',
    name: 'OFAC SDN List',
    nameFr: 'Liste SDN OFAC',
    category: 'security',
    source: 'US Treasury (Public XML)',
  },
  {
    id: 'un_sanctions',
    name: 'UN Sanctions List',
    nameFr: 'Liste sanctions ONU',
    category: 'security',
    source: 'UN Security Council (Public)',
  },
  {
    id: 'eu_sanctions',
    name: 'EU Sanctions List',
    nameFr: 'Liste sanctions UE',
    category: 'security',
    source: 'EU Consolidated List (Public)',
  },
  {
    id: 'opensanctions',
    name: 'OpenSanctions Database',
    nameFr: 'Base OpenSanctions',
    category: 'security',
    source: 'opensanctions.org (Open Data)',
  },

  // Public Watchlists
  {
    id: 'interpol_public',
    name: 'INTERPOL Public Notices',
    nameFr: 'Notices publiques INTERPOL',
    category: 'security',
    source: 'interpol.int (Red Notices)',
  },
  {
    id: 'fbi_wanted',
    name: 'FBI Most Wanted',
    nameFr: 'FBI Most Wanted',
    category: 'security',
    source: 'FBI Public API',
  },
  {
    id: 'europol_wanted',
    name: 'Europol Most Wanted',
    nameFr: 'Europol Most Wanted',
    category: 'security',
    source: 'europol.europa.eu',
  },

  // Document Checks (Public)
  {
    id: 'passport_format',
    name: 'Passport Format Valid',
    nameFr: 'Format passeport valide',
    category: 'document',
    source: 'ICAO Doc 9303 Rules',
  },
  {
    id: 'document_checksum',
    name: 'Document Checksum Valid',
    nameFr: 'Checksum document valide',
    category: 'document',
    source: 'MRZ Check Digit Validation',
  },

  // ========== GOVERNMENT ACCESS (Requires credentials) ==========

  // Identity Verification (Govt)
  {
    id: 'passport_validity',
    name: 'Passport Validity',
    nameFr: 'Validité du passeport',
    category: 'document',
    source: 'ICAO PKD / Immigration',
  },
  {
    id: 'passport_chip',
    name: 'e-Passport Chip Verification',
    nameFr: 'Vérification puce e-Passeport',
    category: 'document',
    source: 'ICAO PKD',
  },
  {
    id: 'national_id_check',
    name: 'National ID Verification',
    nameFr: 'Vérification CNI',
    category: 'identity',
    source: 'Direction État Civil',
  },
  {
    id: 'photo_match',
    name: 'Biometric Photo Match',
    nameFr: 'Correspondance biométrique',
    category: 'identity',
    source: 'Facial Recognition System',
  },

  // Security Checks (Govt)
  {
    id: 'interpol_sltd',
    name: 'INTERPOL Lost/Stolen Documents',
    nameFr: 'Documents volés/perdus INTERPOL',
    category: 'security',
    source: 'INTERPOL SLTD Database',
  },
  {
    id: 'interpol_notices',
    name: 'INTERPOL I-24/7 Notices',
    nameFr: 'Notices INTERPOL I-24/7',
    category: 'security',
    source: 'INTERPOL I-24/7 (Govt Only)',
  },
  {
    id: 'national_wanted',
    name: 'National Wanted List',
    nameFr: 'Liste nationale des recherchés',
    category: 'security',
    source: 'Police Nationale',
  },
  {
    id: 'terrorism_watchlist',
    name: 'Terrorism Watchlist',
    nameFr: 'Liste de surveillance terrorisme',
    category: 'security',
    source: 'Services de Renseignement',
  },

  // Travel History (Govt)
  {
    id: 'entry_record',
    name: 'Entry Record Found',
    nameFr: 'Enregistrement d\'entrée',
    category: 'travel',
    source: 'DGEF Immigration',
  },
  {
    id: 'visa_status',
    name: 'Visa Status Valid',
    nameFr: 'Statut visa valide',
    category: 'travel',
    source: 'DGEF Immigration',
  },
  {
    id: 'previous_stays',
    name: 'Previous Stay History',
    nameFr: 'Historique des séjours',
    category: 'travel',
    source: 'Teranga Safe Database',
  },
  {
    id: 'overstay_history',
    name: 'No Overstay History',
    nameFr: 'Pas de dépassement de séjour',
    category: 'travel',
    source: 'DGEF Immigration',
  },
  {
    id: 'cedeao_status',
    name: 'ECOWAS Free Movement',
    nameFr: 'Libre circulation CEDEAO',
    category: 'travel',
    source: 'CEDEAO Database',
  },
];

// Score weights by category
const CATEGORY_WEIGHTS: Record<VerificationCheck['category'], number> = {
  security: 2.0,   // Security issues are most critical
  document: 1.5,   // Document authenticity is important
  identity: 1.3,   // Identity verification
  osint: 1.2,      // Public OSINT data
  travel: 1.0,     // Travel history
};

// Calculate overall score from individual checks
export function calculateOverallScore(checks: VerificationCheck[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const check of checks) {
    if (check.status === 'unavailable') continue;

    const weight = CATEGORY_WEIGHTS[check.category];
    totalWeight += weight;

    // Normalize score to 0-100 range (from -100 to +100)
    const normalizedScore = (check.score + 100) / 2;
    weightedScore += normalizedScore * weight;
  }

  if (totalWeight === 0) return 50; // Neutral if no checks available
  return Math.round(weightedScore / totalWeight);
}

// Determine risk level from score
export function getRiskLevel(score: number): TravelerVerification['riskLevel'] {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

// Get risk level color
export function getRiskLevelColor(level: TravelerVerification['riskLevel']): string {
  switch (level) {
    case 'low': return 'green';
    case 'medium': return 'yellow';
    case 'high': return 'orange';
    case 'critical': return 'red';
  }
}

// Get status icon
export function getCheckStatusIcon(status: VerificationCheck['status']): string {
  switch (status) {
    case 'verified': return 'check_circle';
    case 'warning': return 'warning';
    case 'alert': return 'error';
    case 'pending': return 'schedule';
    case 'unavailable': return 'help_outline';
  }
}

// Get status color
export function getCheckStatusColor(status: VerificationCheck['status']): string {
  switch (status) {
    case 'verified': return 'text-green-600 dark:text-green-400';
    case 'warning': return 'text-yellow-600 dark:text-yellow-400';
    case 'alert': return 'text-red-600 dark:text-red-400';
    case 'pending': return 'text-blue-600 dark:text-blue-400';
    case 'unavailable': return 'text-gray-400 dark:text-gray-500';
  }
}

// Simulate verification (in production, this would call actual APIs)
export async function performVerification(guest: {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  documentType: string;
  passportNumber?: string | null;
  nationalIdNumber?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<TravelerVerification> {
  /**
   * In production, this would make actual API calls to:
   *
   * PUBLIC OSINT APIs (available now):
   * - Hunter.io / Abstract API: Email validation
   * - EmailRep.io: Email reputation
   * - Have I Been Pwned: Data breaches
   * - FullContact / Clearbit: Social profile enrichment
   * - Numverify / Twilio: Phone validation
   * - OpenSanctions: Public sanctions database
   * - INTERPOL Public: Red notices (interpol.int)
   * - OFAC SDN: US Treasury public list
   * - UN Sanctions: Security Council public list
   *
   * GOVERNMENT APIs (requires credentials):
   * - INTERPOL I-24/7
   * - Immigration database
   * - Police nationale database
   * - DGEF entry/exit records
   */

  const checks: VerificationCheck[] = [];
  const flags: string[] = [];
  const now = new Date().toISOString();

  // ========== PUBLIC OSINT CHECKS ==========

  // Email verification (if provided)
  if (guest.email) {
    // Hunter.io / Abstract API - Email deliverability
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'email_validity')!,
      status: 'verified',
      score: 75,
      details: `Email ${guest.email} - Deliverable`,
      checkedAt: now,
    });

    // EmailRep.io - Reputation
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'email_reputation')!,
      status: 'verified',
      score: 70,
      details: 'Reputation: High (no suspicious activity)',
      checkedAt: now,
    });

    // Have I Been Pwned - Breach check
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'email_breach_check')!,
      status: 'warning',
      score: -10,
      details: 'Found in 2 data breaches (non-sensitive)',
      checkedAt: now,
    });

    // FullContact/Clearbit - Social profiles
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'email_social_profiles')!,
      status: 'verified',
      score: 80,
      details: 'LinkedIn, Twitter profiles found - Identity consistent',
      checkedAt: now,
    });
  }

  // Phone verification (if provided)
  if (guest.phone) {
    // Numverify / Twilio - Phone validation
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'phone_validity')!,
      status: 'verified',
      score: 85,
      details: `${guest.phone} - Valid mobile number`,
      checkedAt: now,
    });

    // Carrier info
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'phone_carrier')!,
      status: 'verified',
      score: 70,
      details: 'Carrier: Orange Sénégal',
      checkedAt: now,
    });

    // Phone type
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'phone_type')!,
      status: 'verified',
      score: 75,
      details: 'Type: Mobile (not VoIP)',
      checkedAt: now,
    });

    // Country match
    const phoneMatchesNationality = guest.phone.startsWith('+221') && guest.nationality.toLowerCase().includes('senegal');
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'phone_country_match')!,
      status: phoneMatchesNationality ? 'verified' : 'warning',
      score: phoneMatchesNationality ? 80 : 20,
      details: phoneMatchesNationality
        ? 'Phone country matches nationality'
        : 'Phone country differs from nationality',
      checkedAt: now,
    });
  }

  // Public Sanctions Lists (Available without credentials)
  // OFAC SDN List
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'ofac_sdn')!,
    status: 'verified',
    score: 100,
    details: 'Not on OFAC Specially Designated Nationals list',
    checkedAt: now,
  });

  // UN Sanctions
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'un_sanctions')!,
    status: 'verified',
    score: 100,
    details: 'Not on UN Security Council sanctions list',
    checkedAt: now,
  });

  // EU Sanctions
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'eu_sanctions')!,
    status: 'verified',
    score: 100,
    details: 'Not on EU Consolidated sanctions list',
    checkedAt: now,
  });

  // OpenSanctions (aggregated public data)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'opensanctions')!,
    status: 'verified',
    score: 95,
    details: 'No matches in OpenSanctions database',
    checkedAt: now,
  });

  // INTERPOL Public Red Notices
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'interpol_public')!,
    status: 'verified',
    score: 100,
    details: 'No public INTERPOL Red Notice found',
    checkedAt: now,
  });

  // FBI Most Wanted (public)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'fbi_wanted')!,
    status: 'verified',
    score: 100,
    details: 'Not on FBI Most Wanted list',
    checkedAt: now,
  });

  // Europol Most Wanted (public)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'europol_wanted')!,
    status: 'verified',
    score: 100,
    details: 'Not on Europol Most Wanted list',
    checkedAt: now,
  });

  // Document format validation
  if (guest.passportNumber) {
    // ICAO format validation
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'passport_format')!,
      status: 'verified',
      score: 85,
      details: `Passport ${guest.passportNumber} - Valid ICAO format`,
      checkedAt: now,
    });

    // MRZ checksum validation
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'document_checksum')!,
      status: 'verified',
      score: 90,
      details: 'MRZ check digits valid',
      checkedAt: now,
    });
  }

  // ========== GOVERNMENT ACCESS CHECKS ==========
  // These require special credentials and would be marked as pending/unavailable

  // Document checks (Govt)
  if (guest.passportNumber) {
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'passport_validity')!,
      status: 'pending',
      score: 0,
      details: 'Requires Immigration database access',
      checkedAt: now,
    });

    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'passport_chip')!,
      status: 'unavailable',
      score: 0,
      details: 'Physical document scan required',
      checkedAt: now,
    });

    // INTERPOL SLTD (Government only)
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'interpol_sltd')!,
      status: 'pending',
      score: 0,
      details: 'Requires INTERPOL I-24/7 access',
      checkedAt: now,
    });
  } else if (guest.nationalIdNumber) {
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'national_id_check')!,
      status: 'pending',
      score: 0,
      details: 'Requires Direction État Civil access',
      checkedAt: now,
    });
  } else {
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'passport_format')!,
      status: 'alert',
      score: -50,
      details: 'No valid identity document provided',
      checkedAt: now,
    });
    flags.push('Missing identity document');
  }

  // Government security checks (marked as pending)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'interpol_notices')!,
    status: 'pending',
    score: 0,
    details: 'Requires I-24/7 government access',
    checkedAt: now,
  });

  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'national_wanted')!,
    status: 'pending',
    score: 0,
    details: 'Requires Police Nationale database access',
    checkedAt: now,
  });

  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'terrorism_watchlist')!,
    status: 'pending',
    score: 0,
    details: 'Requires security clearance',
    checkedAt: now,
  });

  // Travel history checks (Government)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'entry_record')!,
    status: 'pending',
    score: 0,
    details: 'Requires DGEF Immigration access',
    checkedAt: now,
  });

  // CEDEAO check for West African nationals
  const cedeaoCountries = ['SN', 'ML', 'GN', 'CI', 'BF', 'NE', 'NG', 'GH', 'TG', 'BJ', 'GM', 'GW', 'LR', 'SL', 'CV'];
  const isCedeao = cedeaoCountries.some(code =>
    guest.nationality.toUpperCase().includes(code) ||
    guest.nationality.toLowerCase().includes('senegal') ||
    guest.nationality.toLowerCase().includes('mali') ||
    guest.nationality.toLowerCase().includes('guinea')
  );

  if (isCedeao) {
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'cedeao_status')!,
      status: 'verified',
      score: 90,
      details: 'ECOWAS citizen - Free movement rights',
      checkedAt: now,
    });
  } else {
    checks.push({
      ...VERIFICATION_CHECKS.find(c => c.id === 'visa_status')!,
      status: 'pending',
      score: 0,
      details: 'Visa verification required - DGEF access needed',
      checkedAt: now,
    });
  }

  // Internal database check (Teranga Safe)
  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'previous_stays')!,
    status: 'verified',
    score: 60,
    details: 'First registered stay in system',
    checkedAt: now,
  });

  checks.push({
    ...VERIFICATION_CHECKS.find(c => c.id === 'overstay_history')!,
    status: 'pending',
    score: 0,
    details: 'Requires Immigration database access',
    checkedAt: now,
  });

  const overallScore = calculateOverallScore(checks);
  const riskLevel = getRiskLevel(overallScore);

  return {
    guestId: guest.id,
    overallScore,
    riskLevel,
    checks,
    lastUpdated: now,
    flags,
  };
}

// Get category label in French
export function getCategoryLabel(category: VerificationCheck['category']): string {
  switch (category) {
    case 'identity': return 'Identité';
    case 'security': return 'Sécurité';
    case 'travel': return 'Voyage';
    case 'document': return 'Documents';
    case 'osint': return 'OSINT Public';
  }
}
