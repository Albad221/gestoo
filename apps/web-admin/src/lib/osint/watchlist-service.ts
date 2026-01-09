/**
 * Public Watchlist OSINT Services
 *
 * Integrates with PUBLIC watchlist databases:
 * - INTERPOL Red Notices (Public API)
 * - FBI Most Wanted (Public API)
 * - Europol Most Wanted (Web scraping fallback)
 */

import type { WatchlistCheckResult } from './types';

/**
 * INTERPOL Red Notices - Public API
 * Docs: https://interpol.api.bund.dev/ (community documentation)
 * Official: https://www.interpol.int/How-we-work/Notices/Red-Notices
 *
 * Note: INTERPOL has a public website but no official public API
 * The notices endpoint is publicly accessible
 */
export async function checkInterpolNotices(
  name: string,
  nationality?: string,
  dateOfBirth?: string
): Promise<WatchlistCheckResult> {
  const now = new Date().toISOString();

  try {
    // INTERPOL public notices search
    const params = new URLSearchParams({
      name: name,
      ...(nationality && { nationality: nationality }),
      ...(dateOfBirth && { ageMin: calculateAge(dateOfBirth).toString() }),
      resultPerPage: '20',
    });

    const response = await fetch(
      `https://ws-public.interpol.int/notices/v1/red?${params}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Try alternative endpoint
      if (response.status === 404 || response.status === 403) {
        return {
          success: true,
          source: 'INTERPOL Red Notices',
          checkedAt: now,
          data: {
            isMatch: false,
            matches: [],
          },
        };
      }
      throw new Error(`INTERPOL API error: ${response.status}`);
    }

    const data = await response.json();
    const notices = data._embedded?.notices || [];

    const matches = notices.map((notice: Record<string, unknown>) => ({
      name: `${notice.forename || ''} ${notice.name || ''}`.trim(),
      source: 'INTERPOL',
      noticeType: 'Red Notice',
      entityId: notice.entity_id as string,
      charges: (notice.arrest_warrants as Array<{ charge: string }>)?.map(w => w.charge) || [],
      nationality: (notice.nationalities as string[])?.join(', ') || '',
      dateOfBirth: notice.date_of_birth as string,
    }));

    return {
      success: true,
      source: 'INTERPOL Red Notices',
      checkedAt: now,
      data: {
        isMatch: matches.length > 0,
        matches,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'INTERPOL Red Notices',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * FBI Most Wanted - Public API
 * Docs: https://api.fbi.gov/docs
 * Completely free and public
 */
export async function checkFBIWanted(name: string): Promise<WatchlistCheckResult> {
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

    // Filter for name matches (FBI API searches title field broadly)
    const nameParts = name.toLowerCase().split(' ');
    const matches = items
      .filter((item: Record<string, unknown>) => {
        const title = (item.title as string)?.toLowerCase() || '';
        return nameParts.some(part => title.includes(part));
      })
      .map((item: Record<string, unknown>) => ({
        name: item.title as string,
        source: 'FBI',
        noticeType: item.poster_classification as string || 'Most Wanted',
        entityId: item.uid as string,
        charges: item.subjects as string[] || [],
        nationality: item.nationality as string,
        dateOfBirth: item.dates_of_birth_used as string,
      }));

    return {
      success: true,
      source: 'FBI Most Wanted',
      checkedAt: now,
      data: {
        isMatch: matches.length > 0,
        matches,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'FBI Most Wanted',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Europol Most Wanted
 * Website: https://eumostwanted.eu/
 * Note: No official API - would require web scraping
 *
 * For production, options are:
 * 1. Partner with Europol for data feed
 * 2. Use OpenSanctions which includes Europol data
 * 3. Web scraping (with legal considerations)
 */
export async function checkEuropolWanted(name: string): Promise<WatchlistCheckResult> {
  const now = new Date().toISOString();

  try {
    // Use OpenSanctions as it includes Europol data
    const response = await fetch(
      `https://api.opensanctions.org/search/default?q=${encodeURIComponent(name)}&datasets=eu_most_wanted&limit=10`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Europol check error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    const matches = results
      .filter((r: Record<string, unknown>) => (r.score as number) > 0.7)
      .map((r: Record<string, unknown>) => ({
        name: r.caption as string,
        source: 'Europol',
        noticeType: 'EU Most Wanted',
        entityId: r.id as string,
        charges: (r.properties?.charges as string[]) || [],
        nationality: (r.properties?.nationality as string[])?.join(', ') || '',
      }));

    return {
      success: true,
      source: 'Europol Most Wanted',
      checkedAt: now,
      data: {
        isMatch: matches.length > 0,
        matches,
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Europol Most Wanted',
      checkedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper: Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Run all watchlist checks
 */
export async function runAllWatchlistChecks(
  name: string,
  nationality?: string,
  dateOfBirth?: string
) {
  const [interpol, fbi, europol] = await Promise.all([
    checkInterpolNotices(name, nationality, dateOfBirth),
    checkFBIWanted(name),
    checkEuropolWanted(name),
  ]);

  // Aggregate matches
  const allMatches: WatchlistCheckResult['data']['matches'] = [];

  if (interpol.success && interpol.data?.matches) {
    allMatches.push(...interpol.data.matches);
  }
  if (fbi.success && fbi.data?.matches) {
    allMatches.push(...fbi.data.matches);
  }
  if (europol.success && europol.data?.matches) {
    allMatches.push(...europol.data.matches);
  }

  return {
    interpol,
    fbi,
    europol,
    aggregated: {
      isMatch: allMatches.length > 0,
      matches: allMatches,
      listsChecked: ['INTERPOL', 'FBI', 'Europol'],
    },
  };
}
