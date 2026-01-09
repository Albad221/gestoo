import { NextRequest, NextResponse } from 'next/server';
import * as truecallerjs from 'truecallerjs';
import { checkEmailWithHolehe } from '@/lib/osint/holehe';

/**
 * Complete Traveler Verification API
 *
 * Input: Passport/CNI data + Phone number
 * Output: Complete profile with risk assessment
 */

interface TravelerInput {
  // From document (passport/CNI)
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nationality: string; // ISO country code
  documentType: 'passport' | 'cni' | 'other';
  documentNumber: string;
  documentExpiry?: string;
  gender?: 'M' | 'F';
  placeOfBirth?: string;

  // Contact
  phone: string;
  email?: string; // Optional - we'll try to find it
}

interface VerificationResult {
  input: TravelerInput;
  timestamp: string;

  // Identity verification
  identity: {
    documentValid: boolean;
    documentIssues: string[];
    nameFromPhone?: string;
    nameMatch: boolean;
    nameMatchScore: number;
    photoUrl?: string;
  };

  // Contact verification
  contact: {
    phoneValid: boolean;
    phoneCarrier?: string;
    phoneCountry?: string;
    phoneType?: string;
    emailsFound: string[];
    emailVerified: boolean;
  };

  // Digital footprint
  digitalFootprint: {
    accountsFound: Array<{ name: string; url: string; type: string }>;
    breaches: Array<{ name: string; date: string; severity: string }>;
    totalAccounts: number;
    totalBreaches: number;
  };

  // Security checks
  securityChecks: {
    sanctions: Array<{ list: string; matchName: string; score: number }>;
    watchlists: Array<{ source: string; name: string; details?: string }>;
    interpol: boolean;
    pep: boolean; // Politically Exposed Person
  };

  // Risk assessment
  risk: {
    score: number; // 0-100
    level: 'clear' | 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendations: string[];
  };

  // Verification summary
  summary: {
    identityVerified: boolean;
    contactVerified: boolean;
    securityCleared: boolean;
    overallStatus: 'approved' | 'review' | 'flagged' | 'rejected';
  };

  // Data sources
  sources: string[];
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const input: TravelerInput = await request.json();

    const result: VerificationResult = {
      input,
      timestamp: new Date().toISOString(),
      identity: {
        documentValid: true,
        documentIssues: [],
        nameMatch: false,
        nameMatchScore: 0,
      },
      contact: {
        phoneValid: false,
        emailsFound: [],
        emailVerified: false,
      },
      digitalFootprint: {
        accountsFound: [],
        breaches: [],
        totalAccounts: 0,
        totalBreaches: 0,
      },
      securityChecks: {
        sanctions: [],
        watchlists: [],
        interpol: false,
        pep: false,
      },
      risk: {
        score: 0,
        level: 'clear',
        factors: [],
        recommendations: [],
      },
      summary: {
        identityVerified: false,
        contactVerified: false,
        securityCleared: true,
        overallStatus: 'review',
      },
      sources: [],
      processingTime: 0,
    };

    const fullName = `${input.firstName} ${input.lastName}`.trim();

    // ========================================
    // 1. DOCUMENT VALIDATION
    // ========================================
    validateDocument(input, result);

    // ========================================
    // 2. PHONE VERIFICATION + GET EMAIL
    // ========================================
    await verifyPhone(input.phone, fullName, result);

    // ========================================
    // 3. EMAIL VERIFICATION (from phone or input)
    // ========================================
    const emailToCheck = result.contact.emailsFound[0] || input.email;
    if (emailToCheck) {
      await verifyEmail(emailToCheck, result);
    }

    // ========================================
    // 4. SECURITY CHECKS (sanctions, watchlists)
    // ========================================
    await runSecurityChecks(fullName, input.dateOfBirth, input.nationality, result);

    // ========================================
    // 5. CALCULATE RISK SCORE
    // ========================================
    calculateRiskScore(result);

    // ========================================
    // 6. DETERMINE OVERALL STATUS
    // ========================================
    determineStatus(result);

    result.processingTime = Date.now() - startTime;

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Verification failed', details: String(error) },
      { status: 500 }
    );
  }
}

function validateDocument(input: TravelerInput, result: VerificationResult) {
  const issues: string[] = [];

  // Check document expiry
  if (input.documentExpiry) {
    const expiry = new Date(input.documentExpiry);
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    if (expiry < now) {
      issues.push('Document has expired');
      result.identity.documentValid = false;
    } else if (expiry < sixMonthsFromNow) {
      issues.push('Document expires within 6 months');
    }
  }

  // Validate document number format
  if (input.documentType === 'passport') {
    // Passport: usually 8-9 alphanumeric characters
    if (!/^[A-Z0-9]{6,12}$/i.test(input.documentNumber)) {
      issues.push('Passport number format may be invalid');
    }
  } else if (input.documentType === 'cni') {
    // Senegalese CNI: specific format
    if (input.nationality === 'SN' && !/^\d{13}$/.test(input.documentNumber)) {
      issues.push('Senegalese CNI should be 13 digits');
    }
  }

  // Check date of birth validity
  const dob = new Date(input.dateOfBirth);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (age < 0 || age > 120) {
    issues.push('Date of birth is invalid');
    result.identity.documentValid = false;
  } else if (age < 18) {
    issues.push('Traveler is a minor (under 18)');
  }

  result.identity.documentIssues = issues;
  result.sources.push('document_validation');
}

async function verifyPhone(phone: string, documentName: string, result: VerificationResult) {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Numverify for carrier info
  const numverifyKey = process.env.NEXT_PUBLIC_NUMVERIFY_API_KEY;
  if (numverifyKey) {
    try {
      const res = await fetch(
        `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${encodeURIComponent(cleanPhone)}&format=1`
      );
      const data = await res.json();
      if (data.valid) {
        result.contact.phoneValid = true;
        result.contact.phoneCarrier = data.carrier;
        result.contact.phoneCountry = data.country_name;
        result.contact.phoneType = data.line_type;
        result.sources.push('numverify');
      }
    } catch {}
  }

  // Truecaller for name and email
  const truecallerInstallationId = process.env.TRUECALLER_INSTALLATION_ID;
  if (truecallerInstallationId) {
    try {
      let countryCode = 'SN';
      if (cleanPhone.startsWith('+33')) countryCode = 'FR';
      else if (cleanPhone.startsWith('+1')) countryCode = 'US';
      else if (cleanPhone.startsWith('+221')) countryCode = 'SN';

      const searchData = {
        number: cleanPhone.replace(/^\+/, ''),
        countryCode,
        installationId: truecallerInstallationId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await truecallerjs.search(searchData);
      const rawData = response.json();

      // Get name and compare
      const nameFromPhone = response.getName();
      if (nameFromPhone && nameFromPhone !== 'Unknown') {
        result.identity.nameFromPhone = nameFromPhone;
        result.identity.nameMatchScore = calculateNameSimilarity(documentName, nameFromPhone);
        result.identity.nameMatch = result.identity.nameMatchScore >= 0.7;

        if (!result.identity.nameMatch && result.identity.nameMatchScore >= 0.5) {
          result.risk.factors.push(`Name partial match: "${documentName}" vs "${nameFromPhone}" (${Math.round(result.identity.nameMatchScore * 100)}%)`);
        } else if (!result.identity.nameMatch) {
          result.risk.factors.push(`Name mismatch: Document says "${documentName}" but phone registered to "${nameFromPhone}"`);
        }
      }

      // Get email
      const email = response.getEmailId();
      if (email) {
        result.contact.emailsFound.push(email);
      }

      // Get photo
      if (rawData?.data?.[0]?.image) {
        result.identity.photoUrl = rawData.data[0].image;
      }

      // Check spam score
      if (rawData?.data?.[0]?.spamInfo?.spamScore > 5) {
        result.risk.factors.push(`Phone flagged as spam (score: ${rawData.data[0].spamInfo.spamScore}/10)`);
      }

      result.sources.push('truecaller');
    } catch (e) {
      console.error('Truecaller error:', e);
    }
  }
}

async function verifyEmail(email: string, result: VerificationResult) {
  // Check with Holehe (120+ sites)
  const holeheResults = await checkEmailWithHolehe(email);

  for (const site of holeheResults) {
    const type = categorizeAccount(site.name);
    result.digitalFootprint.accountsFound.push({
      name: site.name,
      url: site.url,
      type,
    });
  }

  result.digitalFootprint.totalAccounts = holeheResults.length;

  if (holeheResults.length > 0) {
    result.contact.emailVerified = true;
    result.sources.push('holehe');
  }

  // Check breaches (HIBP)
  const hibpKey = process.env.NEXT_PUBLIC_HIBP_API_KEY;
  if (hibpKey) {
    try {
      const res = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
        {
          headers: {
            'hibp-api-key': hibpKey,
            'User-Agent': 'TerangaSafe/1.0',
          },
        }
      );

      if (res.ok) {
        const breaches = await res.json();
        for (const breach of breaches.slice(0, 10)) {
          const severity = breach.IsSensitive ? 'high' :
                          breach.DataClasses?.includes('Passwords') ? 'medium' : 'low';
          result.digitalFootprint.breaches.push({
            name: breach.Name,
            date: breach.BreachDate,
            severity,
          });
        }
        result.digitalFootprint.totalBreaches = breaches.length;
        result.sources.push('hibp');

        if (breaches.length > 5) {
          result.risk.factors.push(`Email found in ${breaches.length} data breaches`);
        }
      }
    } catch {}
  }
}

async function runSecurityChecks(
  name: string,
  dob: string,
  nationality: string,
  result: VerificationResult
) {
  // OpenSanctions
  const osKey = process.env.NEXT_PUBLIC_OPENSANCTIONS_API_KEY;
  const headers: HeadersInit = { 'Accept': 'application/json' };
  if (osKey) headers['Authorization'] = `ApiKey ${osKey}`;

  try {
    const res = await fetch(
      `https://api.opensanctions.org/search/default?q=${encodeURIComponent(name)}&limit=10`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      for (const match of (data.results || [])) {
        const score = match.score ?? 1.0;
        if (score >= 0.7 || match.datasets?.length > 3) {
          result.securityChecks.sanctions.push({
            list: (match.datasets || []).slice(0, 3).join(', '),
            matchName: match.caption,
            score,
          });

          // Check if PEP
          if (match.datasets?.some((d: string) => d.includes('pep'))) {
            result.securityChecks.pep = true;
          }
        }
      }
      result.sources.push('opensanctions');
    }
  } catch {}

  // INTERPOL Red Notices
  try {
    const res = await fetch(
      `https://ws-public.interpol.int/notices/v1/red?name=${encodeURIComponent(name)}&resultPerPage=5`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      const notices = data._embedded?.notices || [];

      for (const notice of notices) {
        result.securityChecks.watchlists.push({
          source: 'INTERPOL Red Notice',
          name: `${notice.forename} ${notice.name}`,
          details: notice.nationalities?.join(', '),
        });
      }

      if (notices.length > 0) {
        result.securityChecks.interpol = true;
      }
      result.sources.push('interpol');
    }
  } catch {}

  // FBI Most Wanted
  try {
    const res = await fetch(
      `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(name)}&pageSize=5`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.items || [])) {
        result.securityChecks.watchlists.push({
          source: 'FBI Most Wanted',
          name: item.title,
          details: item.subjects?.join(', '),
        });
      }
      result.sources.push('fbi');
    }
  } catch {}
}

function calculateRiskScore(result: VerificationResult) {
  let score = 0;

  // Document issues
  if (!result.identity.documentValid) score += 30;
  score += result.identity.documentIssues.length * 5;

  // Name mismatch
  if (result.identity.nameFromPhone && !result.identity.nameMatch) {
    score += 25;
  }

  // Sanctions
  score += result.securityChecks.sanctions.length * 30;

  // Watchlists
  score += result.securityChecks.watchlists.length * 35;

  // INTERPOL
  if (result.securityChecks.interpol) score += 40;

  // PEP
  if (result.securityChecks.pep) score += 15;

  // Breaches (minor)
  score += Math.min(result.digitalFootprint.totalBreaches * 2, 15);

  // Phone spam
  if (result.risk.factors.some(f => f.includes('spam'))) score += 10;

  result.risk.score = Math.min(score, 100);

  // Determine level
  if (score >= 70) result.risk.level = 'critical';
  else if (score >= 50) result.risk.level = 'high';
  else if (score >= 30) result.risk.level = 'medium';
  else if (score >= 10) result.risk.level = 'low';
  else result.risk.level = 'clear';

  // Add recommendations
  if (result.securityChecks.sanctions.length > 0 || result.securityChecks.watchlists.length > 0) {
    result.risk.recommendations.push('Manual review required - potential sanctions/watchlist match');
  }
  if (!result.identity.nameMatch && result.identity.nameFromPhone) {
    result.risk.recommendations.push('Verify identity - name on phone does not match document');
  }
  if (!result.contact.phoneValid) {
    result.risk.recommendations.push('Verify phone number - validation failed');
  }
  if (result.securityChecks.pep) {
    result.risk.recommendations.push('Enhanced due diligence required - Politically Exposed Person');
  }
}

function determineStatus(result: VerificationResult) {
  // Identity verified if document valid and name matches (or no phone name found)
  result.summary.identityVerified = result.identity.documentValid &&
    (result.identity.nameMatch || !result.identity.nameFromPhone);

  // Contact verified if phone valid and email has accounts
  result.summary.contactVerified = result.contact.phoneValid &&
    result.contact.emailsFound.length > 0;

  // Security cleared if no sanctions/watchlists
  result.summary.securityCleared =
    result.securityChecks.sanctions.length === 0 &&
    result.securityChecks.watchlists.length === 0;

  // Overall status
  if (!result.summary.securityCleared) {
    result.summary.overallStatus = 'flagged';
  } else if (result.risk.score >= 50) {
    result.summary.overallStatus = 'rejected';
  } else if (!result.summary.identityVerified || result.risk.score >= 20) {
    result.summary.overallStatus = 'review';
  } else {
    result.summary.overallStatus = 'approved';
  }
}

function calculateNameSimilarity(name1: string, name2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(/\s+/).sort().join(' ');
  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1.0;

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  // Check word overlap
  const words1 = new Set(n1.split(' '));
  const words2 = new Set(n2.split(' '));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);

  return intersection.length / union.size;
}

function categorizeAccount(name: string): string {
  const categories: Record<string, string[]> = {
    'social': ['twitter', 'instagram', 'facebook', 'linkedin', 'snapchat', 'tiktok', 'pinterest', 'tumblr', 'reddit'],
    'professional': ['github', 'gitlab', 'linkedin', 'stackoverflow', 'bitbucket'],
    'shopping': ['amazon', 'ebay', 'etsy', 'aliexpress', 'wish'],
    'finance': ['paypal', 'venmo', 'cashapp', 'wise'],
    'entertainment': ['netflix', 'spotify', 'disney', 'hulu', 'twitch', 'youtube'],
    'gaming': ['steam', 'epic', 'xbox', 'playstation', 'discord'],
    'productivity': ['google', 'microsoft', 'office365', 'dropbox', 'notion', 'trello', 'slack'],
    'travel': ['airbnb', 'booking', 'expedia', 'uber', 'lyft'],
  };

  const nameLower = name.toLowerCase();
  for (const [category, services] of Object.entries(categories)) {
    if (services.some(s => nameLower.includes(s))) {
      return category;
    }
  }
  return 'other';
}
