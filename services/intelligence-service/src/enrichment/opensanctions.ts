/**
 * OpenSanctions Watchlist Check Service
 *
 * Provides sanctions screening against global watchlists.
 * OpenSanctions aggregates 100+ sanctions lists including:
 * - OFAC SDN (US Treasury)
 * - UN Security Council
 * - EU Consolidated List
 * - UK Sanctions
 * - And many more...
 *
 * Setup:
 * 1. Get API key from https://www.opensanctions.org/api/
 * 2. Set OPENSANCTIONS_API_KEY environment variable
 *
 * Pricing: Free tier (1000 req/month), paid plans from $500/month
 */

import type { SanctionsCheckResult, SanctionsMatch } from './types';

const OPENSANCTIONS_API_KEY = process.env.OPENSANCTIONS_API_KEY || '';
const OPENSANCTIONS_API_URL = 'https://api.opensanctions.org/search/default';

/**
 * Check name against OpenSanctions database
 *
 * @param name - Full name to check
 * @param dateOfBirth - Optional date of birth for better matching (YYYY-MM-DD)
 * @param nationality - Optional nationality/country code for better matching
 * @returns Sanctions check result with matches
 */
export async function checkOpenSanctions(
  name: string,
  dateOfBirth?: string,
  nationality?: string
): Promise<SanctionsCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const params = new URLSearchParams({
      q: name,
      limit: '20',
    });

    if (dateOfBirth) {
      params.append('birth_date', dateOfBirth);
    }
    if (nationality) {
      params.append('countries', nationality);
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (OPENSANCTIONS_API_KEY) {
      headers['Authorization'] = `ApiKey ${OPENSANCTIONS_API_KEY}`;
    }

    const response = await fetch(`${OPENSANCTIONS_API_URL}?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`OpenSanctions API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    // Filter and transform matches
    // Accept matches with score >= 0.5 or those appearing in multiple datasets
    const matches: SanctionsMatch[] = results
      .filter((r: Record<string, unknown>) => {
        const score = (r.score as number) ?? 1.0;
        const datasetCount = ((r.datasets as string[]) || []).length;
        return score >= 0.5 || datasetCount >= 3;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        id: r.id || '',
        name: r.caption || r.name || '',
        score: Math.round(((r.score as number) ?? 1.0) * 100),
        entityType: r.schema || 'Unknown',
        datasets: (r.datasets as string[]) || [],
        properties: {
          nationality: r.properties?.nationality || [],
          birthDate: r.properties?.birthDate || [],
          birthPlace: r.properties?.birthPlace || [],
          programs: r.properties?.program || [],
          notes: r.properties?.notes || [],
        },
      }));

    return {
      success: true,
      source: 'OpenSanctions',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        listsChecked: [
          'OFAC SDN',
          'UN Security Council',
          'EU Consolidated',
          'UK Sanctions',
          'OpenSanctions (100+ lists)',
        ],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'OpenSanctions',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during sanctions check',
    };
  }
}

/**
 * Check against specific sanctions dataset
 *
 * @param name - Full name to check
 * @param dataset - Dataset to check against (e.g., 'ofac', 'un_sc_sanctions', 'eu_fsf')
 * @returns Sanctions check result
 */
export async function checkSpecificDataset(
  name: string,
  dataset: string
): Promise<SanctionsCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const params = new URLSearchParams({
      q: name,
      datasets: dataset,
      limit: '10',
    });

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (OPENSANCTIONS_API_KEY) {
      headers['Authorization'] = `ApiKey ${OPENSANCTIONS_API_KEY}`;
    }

    const response = await fetch(`${OPENSANCTIONS_API_URL}?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`OpenSanctions API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    const matches: SanctionsMatch[] = results
      .filter((r: Record<string, unknown>) => ((r.score as number) ?? 1.0) >= 0.6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        id: r.id || '',
        name: r.caption || r.name || '',
        score: Math.round(((r.score as number) ?? 1.0) * 100),
        entityType: r.schema || 'Unknown',
        datasets: [dataset],
        properties: {
          nationality: r.properties?.nationality || [],
          birthDate: r.properties?.birthDate || [],
          birthPlace: r.properties?.birthPlace || [],
          programs: r.properties?.program || [],
          notes: r.properties?.notes || [],
        },
      }));

    return {
      success: true,
      source: `OpenSanctions (${dataset})`,
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        listsChecked: [dataset],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: `OpenSanctions (${dataset})`,
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check OFAC SDN List specifically
 */
export async function checkOFAC(name: string): Promise<SanctionsCheckResult> {
  return checkSpecificDataset(name, 'us_ofac_sdn');
}

/**
 * Check UN Security Council Sanctions
 */
export async function checkUNSanctions(name: string): Promise<SanctionsCheckResult> {
  return checkSpecificDataset(name, 'un_sc_sanctions');
}

/**
 * Check EU Consolidated List
 */
export async function checkEUSanctions(name: string): Promise<SanctionsCheckResult> {
  return checkSpecificDataset(name, 'eu_fsf');
}

/**
 * Check if person is a Politically Exposed Person (PEP)
 */
export async function checkPEP(name: string, nationality?: string): Promise<{
  success: boolean;
  source: string;
  checkedAt: string;
  duration?: number;
  data?: {
    isPEP: boolean;
    matches: Array<{
      name: string;
      position?: string;
      country?: string;
      source: string;
    }>;
  };
  error?: string;
}> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    // PEP data is included in OpenSanctions
    const params = new URLSearchParams({
      q: name,
      schema: 'Person',
      topics: 'role.pep',
      limit: '10',
    });

    if (nationality) {
      params.append('countries', nationality);
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (OPENSANCTIONS_API_KEY) {
      headers['Authorization'] = `ApiKey ${OPENSANCTIONS_API_KEY}`;
    }

    const response = await fetch(`${OPENSANCTIONS_API_URL}?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`OpenSanctions PEP check error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = results.filter((r: any) => (r.score ?? 1.0) >= 0.7).map((r: any) => ({
      name: r.caption || r.name || '',
      position: r.properties?.position?.[0] || undefined,
      country: r.properties?.country?.[0] || undefined,
      source: (r.datasets || []).join(', '),
    }));

    return {
      success: true,
      source: 'OpenSanctions (PEP)',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isPEP: matches.length > 0,
        matches,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'OpenSanctions (PEP)',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run comprehensive sanctions check against all major lists
 */
export async function runAllSanctionsChecks(
  name: string,
  dateOfBirth?: string,
  nationality?: string
): Promise<{
  combined: SanctionsCheckResult;
  ofac: SanctionsCheckResult;
  un: SanctionsCheckResult;
  eu: SanctionsCheckResult;
  pep: Awaited<ReturnType<typeof checkPEP>>;
  aggregated: {
    isMatch: boolean;
    totalMatches: number;
    highestScore: number;
    listsWithMatches: string[];
    isPEP: boolean;
  };
}> {
  // Run all checks in parallel
  const [combined, ofac, un, eu, pep] = await Promise.all([
    checkOpenSanctions(name, dateOfBirth, nationality),
    checkOFAC(name),
    checkUNSanctions(name),
    checkEUSanctions(name),
    checkPEP(name, nationality),
  ]);

  // Aggregate results
  const listsWithMatches: string[] = [];
  let highestScore = 0;
  let totalMatches = 0;

  if (combined.data?.isMatch) {
    listsWithMatches.push('OpenSanctions (Combined)');
    totalMatches += combined.data.matchCount;
    highestScore = Math.max(highestScore, ...combined.data.matches.map(m => m.score));
  }
  if (ofac.data?.isMatch) {
    listsWithMatches.push('OFAC SDN');
    totalMatches += ofac.data.matchCount;
    highestScore = Math.max(highestScore, ...ofac.data.matches.map(m => m.score));
  }
  if (un.data?.isMatch) {
    listsWithMatches.push('UN Security Council');
    totalMatches += un.data.matchCount;
    highestScore = Math.max(highestScore, ...un.data.matches.map(m => m.score));
  }
  if (eu.data?.isMatch) {
    listsWithMatches.push('EU Consolidated');
    totalMatches += eu.data.matchCount;
    highestScore = Math.max(highestScore, ...eu.data.matches.map(m => m.score));
  }

  return {
    combined,
    ofac,
    un,
    eu,
    pep,
    aggregated: {
      isMatch: listsWithMatches.length > 0,
      totalMatches,
      highestScore,
      listsWithMatches,
      isPEP: pep.data?.isPEP || false,
    },
  };
}
