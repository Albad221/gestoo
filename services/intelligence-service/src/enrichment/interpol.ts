/**
 * Interpol & Law Enforcement Watchlist Service
 *
 * Provides checks against public law enforcement databases:
 * - INTERPOL Red Notices (international arrest warrants)
 * - FBI Most Wanted
 * - Europol Most Wanted (via OpenSanctions)
 *
 * Note: These are publicly accessible APIs/databases.
 * For more comprehensive checks, consider partnering with official agencies.
 */

import type { WatchlistCheckResult, WatchlistMatch } from './types';

/**
 * Check INTERPOL Red Notices
 *
 * INTERPOL provides a public API for searching Red Notices.
 * Red Notices are requests to law enforcement worldwide to locate and
 * provisionally arrest a person pending extradition.
 *
 * @param name - Full name or partial name to search
 * @param nationality - Optional nationality filter (ISO country code)
 * @param dateOfBirth - Optional date of birth for filtering
 * @returns Watchlist check result with matches
 */
export async function checkInterpolRedNotices(
  name: string,
  nationality?: string,
  dateOfBirth?: string
): Promise<WatchlistCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const params = new URLSearchParams({
      name: name,
      resultPerPage: '20',
    });

    if (nationality) {
      params.append('nationality', nationality);
    }

    if (dateOfBirth) {
      // Calculate age for filtering
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      // INTERPOL uses age range, not exact birth date
      params.append('ageMin', String(Math.max(0, age - 5)));
      params.append('ageMax', String(age + 5));
    }

    const response = await fetch(
      `https://ws-public.interpol.int/notices/v1/red?${params}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    // Handle 404/403 as no results (not an error)
    if (response.status === 404 || response.status === 403) {
      return {
        success: true,
        source: 'INTERPOL Red Notices',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          isMatch: false,
          matchCount: 0,
          matches: [],
          sourcesChecked: ['INTERPOL Red Notices'],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`INTERPOL API error: ${response.status}`);
    }

    const data = await response.json();
    const notices = data._embedded?.notices || [];

    const matches: WatchlistMatch[] = notices.map((notice: Record<string, unknown>) => ({
      id: notice.entity_id as string || '',
      name: `${notice.forename || ''} ${notice.name || ''}`.trim(),
      source: 'INTERPOL',
      noticeType: 'Red Notice',
      nationalities: notice.nationalities as string[] || [],
      dateOfBirth: notice.date_of_birth as string || undefined,
      charges: (notice.arrest_warrants as Array<{ charge: string }>)?.map(w => w.charge) || [],
      photo: notice._links?.thumbnail?.href as string || undefined,
      detailsUrl: notice._links?.self?.href as string || undefined,
    }));

    return {
      success: true,
      source: 'INTERPOL Red Notices',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        sourcesChecked: ['INTERPOL Red Notices'],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'INTERPOL Red Notices',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during INTERPOL check',
    };
  }
}

/**
 * Check FBI Most Wanted list
 *
 * The FBI provides a public API for searching their wanted list.
 *
 * @param name - Full name or partial name to search
 * @returns Watchlist check result with matches
 */
export async function checkFBIWanted(name: string): Promise<WatchlistCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const response = await fetch(
      `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(name)}&pageSize=20`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`FBI API error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    // Filter for name matches (FBI API does broad title search)
    const nameParts = name.toLowerCase().split(' ').filter(p => p.length > 2);
    const filteredItems = items.filter((item: Record<string, unknown>) => {
      const title = (item.title as string)?.toLowerCase() || '';
      // At least one significant name part should match
      return nameParts.some(part => title.includes(part));
    });

    const matches: WatchlistMatch[] = filteredItems.map((item: Record<string, unknown>) => ({
      id: item.uid as string || '',
      name: item.title as string || '',
      source: 'FBI',
      noticeType: item.poster_classification as string || 'Most Wanted',
      nationalities: item.nationality ? [item.nationality as string] : [],
      dateOfBirth: Array.isArray(item.dates_of_birth_used)
        ? (item.dates_of_birth_used as string[])[0]
        : undefined,
      charges: item.subjects as string[] || [],
      photo: (item.images as Array<{ large: string }>)?.[0]?.large || undefined,
      detailsUrl: item.url as string || undefined,
    }));

    return {
      success: true,
      source: 'FBI Most Wanted',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        sourcesChecked: ['FBI Most Wanted'],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'FBI Most Wanted',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during FBI check',
    };
  }
}

/**
 * Check Europol Most Wanted (via OpenSanctions)
 *
 * Europol doesn't have a public API, but their data is available
 * through OpenSanctions.
 *
 * @param name - Full name to search
 * @returns Watchlist check result with matches
 */
export async function checkEuropolWanted(name: string): Promise<WatchlistCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  const opensanctionsKey = process.env.OPENSANCTIONS_API_KEY;

  try {
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (opensanctionsKey) {
      headers['Authorization'] = `ApiKey ${opensanctionsKey}`;
    }

    const response = await fetch(
      `https://api.opensanctions.org/search/default?q=${encodeURIComponent(name)}&datasets=eu_most_wanted&limit=10`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Europol check error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    const matches: WatchlistMatch[] = results
      .filter((r: Record<string, unknown>) => ((r.score as number) ?? 1.0) >= 0.6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        id: r.id || '',
        name: r.caption || r.name || '',
        source: 'Europol',
        noticeType: 'EU Most Wanted',
        nationalities: r.properties?.nationality || [],
        dateOfBirth: r.properties?.birthDate?.[0] || undefined,
        charges: r.properties?.charges || [],
        detailsUrl: r._links?.self?.href || undefined,
      }));

    return {
      success: true,
      source: 'Europol Most Wanted',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        sourcesChecked: ['Europol Most Wanted (via OpenSanctions)'],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Europol Most Wanted',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error during Europol check',
    };
  }
}

/**
 * Check INTERPOL Yellow Notices (missing persons)
 * Not typically used for compliance, but available.
 */
export async function checkInterpolYellowNotices(
  name: string,
  nationality?: string
): Promise<WatchlistCheckResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const params = new URLSearchParams({
      name: name,
      resultPerPage: '10',
    });

    if (nationality) {
      params.append('nationality', nationality);
    }

    const response = await fetch(
      `https://ws-public.interpol.int/notices/v1/yellow?${params}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (response.status === 404 || response.status === 403) {
      return {
        success: true,
        source: 'INTERPOL Yellow Notices',
        checkedAt: now,
        duration: Date.now() - startTime,
        data: {
          isMatch: false,
          matchCount: 0,
          matches: [],
          sourcesChecked: ['INTERPOL Yellow Notices'],
        },
      };
    }

    if (!response.ok) {
      throw new Error(`INTERPOL API error: ${response.status}`);
    }

    const data = await response.json();
    const notices = data._embedded?.notices || [];

    const matches: WatchlistMatch[] = notices.map((notice: Record<string, unknown>) => ({
      id: notice.entity_id as string || '',
      name: `${notice.forename || ''} ${notice.name || ''}`.trim(),
      source: 'INTERPOL',
      noticeType: 'Yellow Notice (Missing Person)',
      nationalities: notice.nationalities as string[] || [],
      dateOfBirth: notice.date_of_birth as string || undefined,
      photo: notice._links?.thumbnail?.href as string || undefined,
      detailsUrl: notice._links?.self?.href as string || undefined,
    }));

    return {
      success: true,
      source: 'INTERPOL Yellow Notices',
      checkedAt: now,
      duration: Date.now() - startTime,
      data: {
        isMatch: matches.length > 0,
        matchCount: matches.length,
        matches,
        sourcesChecked: ['INTERPOL Yellow Notices'],
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'INTERPOL Yellow Notices',
      checkedAt: now,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all watchlist checks in parallel
 */
export async function runAllWatchlistChecks(
  name: string,
  nationality?: string,
  dateOfBirth?: string
): Promise<{
  interpol: WatchlistCheckResult;
  fbi: WatchlistCheckResult;
  europol: WatchlistCheckResult;
  aggregated: {
    isMatch: boolean;
    totalMatches: number;
    sourcesWithMatches: string[];
    allMatches: WatchlistMatch[];
  };
}> {
  // Run all checks in parallel
  const [interpol, fbi, europol] = await Promise.all([
    checkInterpolRedNotices(name, nationality, dateOfBirth),
    checkFBIWanted(name),
    checkEuropolWanted(name),
  ]);

  // Aggregate results
  const allMatches: WatchlistMatch[] = [];
  const sourcesWithMatches: string[] = [];

  if (interpol.data?.isMatch) {
    sourcesWithMatches.push('INTERPOL');
    allMatches.push(...interpol.data.matches);
  }
  if (fbi.data?.isMatch) {
    sourcesWithMatches.push('FBI');
    allMatches.push(...fbi.data.matches);
  }
  if (europol.data?.isMatch) {
    sourcesWithMatches.push('Europol');
    allMatches.push(...europol.data.matches);
  }

  return {
    interpol,
    fbi,
    europol,
    aggregated: {
      isMatch: allMatches.length > 0,
      totalMatches: allMatches.length,
      sourcesWithMatches,
      allMatches,
    },
  };
}

/**
 * Get detailed information about a specific INTERPOL notice
 */
export async function getInterpolNoticeDetails(entityId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    forename: string;
    dateOfBirth: string;
    nationalities: string[];
    sex: string;
    height: number;
    weight: number;
    eyesColor: string;
    hairColor: string;
    distinguishingMarks: string;
    arrestWarrants: Array<{
      issuingCountry: string;
      charge: string;
      chargeTranslation: string;
    }>;
    photos: string[];
  };
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://ws-public.interpol.int/notices/v1/red/${entityId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Notice not found' };
      }
      throw new Error(`INTERPOL API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        id: data.entity_id,
        name: data.name || '',
        forename: data.forename || '',
        dateOfBirth: data.date_of_birth || '',
        nationalities: data.nationalities || [],
        sex: data.sex_id || '',
        height: data.height || 0,
        weight: data.weight || 0,
        eyesColor: data.eyes_colors_id?.[0] || '',
        hairColor: data.hairs_id?.[0] || '',
        distinguishingMarks: data.distinguishing_marks || '',
        arrestWarrants: (data.arrest_warrants || []).map((w: Record<string, unknown>) => ({
          issuingCountry: w.issuing_country_id as string,
          charge: w.charge as string,
          chargeTranslation: w.charge_translation as string || '',
        })),
        photos: data._links?.images?.map((img: { href: string }) => img.href) || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
