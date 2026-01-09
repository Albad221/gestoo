import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    const results: {
      timestamp: string;
      input: string;
      type: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checks: Record<string, any>;
    } = {
      timestamp: new Date().toISOString(),
      input,
      type,
      checks: {},
    };

    if (type === 'email') {
      // Hunter.io
      const hunterKey = process.env.NEXT_PUBLIC_HUNTER_API_KEY;
      if (hunterKey) {
        try {
          const res = await fetch(
            `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(input)}&api_key=${hunterKey}`
          );
          results.checks.hunter = {
            success: res.ok,
            data: await res.json(),
          };
        } catch (e) {
          results.checks.hunter = { success: false, error: String(e) };
        }
      } else {
        results.checks.hunter = { success: false, error: 'API key not configured' };
      }

      // EmailRep (no key needed)
      try {
        const res = await fetch(`https://emailrep.io/${encodeURIComponent(input)}`, {
          headers: { 'User-Agent': 'TerangaSafe/1.0', 'Accept': 'application/json' },
        });
        results.checks.emailRep = {
          success: res.ok,
          data: await res.json(),
        };
      } catch (e) {
        results.checks.emailRep = { success: false, error: String(e) };
      }

      // HIBP
      const hibpKey = process.env.NEXT_PUBLIC_HIBP_API_KEY;
      if (hibpKey) {
        try {
          const res = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(input)}?truncateResponse=false`,
            {
              headers: {
                'hibp-api-key': hibpKey,
                'User-Agent': 'TerangaSafe/1.0',
              },
            }
          );
          if (res.status === 404) {
            results.checks.hibp = { success: true, data: { breached: false, message: 'No breaches found' } };
          } else if (res.ok) {
            results.checks.hibp = { success: true, data: { breached: true, breaches: await res.json() } };
          } else {
            results.checks.hibp = { success: false, error: `HTTP ${res.status}` };
          }
        } catch (e) {
          results.checks.hibp = { success: false, error: String(e) };
        }
      } else {
        results.checks.hibp = { success: false, error: 'API key not configured' };
      }

    } else if (type === 'phone') {
      const cleanPhone = input.replace(/[\s\-\(\)]/g, '');

      // Local validation (Senegal patterns)
      const senegalPatterns = {
        orange: /^(\+221|221)?7[78]\d{7}$/,
        free: /^(\+221|221)?76\d{7}$/,
        expresso: /^(\+221|221)?70\d{7}$/,
      };

      let operator = 'Unknown';
      if (senegalPatterns.orange.test(cleanPhone)) operator = 'Orange Sénégal';
      else if (senegalPatterns.free.test(cleanPhone)) operator = 'Free Sénégal';
      else if (senegalPatterns.expresso.test(cleanPhone)) operator = 'Expresso Sénégal';

      results.checks.local = {
        success: true,
        data: {
          cleanNumber: cleanPhone,
          isSenegalese: cleanPhone.includes('221') || /^7[0-8]\d{7}$/.test(cleanPhone),
          operator,
          format: cleanPhone.startsWith('+') ? 'international' : 'local',
        },
      };

      // Numverify
      const numverifyKey = process.env.NEXT_PUBLIC_NUMVERIFY_API_KEY;
      if (numverifyKey) {
        try {
          const res = await fetch(
            `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${encodeURIComponent(cleanPhone)}&format=1`
          );
          const data = await res.json();
          results.checks.numverify = {
            success: !data.error,
            data,
          };
        } catch (e) {
          results.checks.numverify = { success: false, error: String(e) };
        }
      } else {
        results.checks.numverify = { success: false, error: 'API key not configured' };
      }

    } else if (type === 'sanctions') {
      // OpenSanctions
      const osKey = process.env.NEXT_PUBLIC_OPENSANCTIONS_API_KEY;
      try {
        const headers: HeadersInit = { 'Accept': 'application/json' };
        if (osKey) headers['Authorization'] = `ApiKey ${osKey}`;

        const res = await fetch(
          `https://api.opensanctions.org/search/default?q=${encodeURIComponent(input)}&limit=10`,
          { headers }
        );
        const data = await res.json();
        results.checks.openSanctions = {
          success: res.ok,
          matchCount: data.results?.length || 0,
          data,
        };
      } catch (e) {
        results.checks.openSanctions = { success: false, error: String(e) };
      }

      // Check specific lists via OpenSanctions
      const lists = ['ofac', 'un_sc_sanctions', 'eu_fsf'];
      for (const list of lists) {
        try {
          const headers: HeadersInit = { 'Accept': 'application/json' };
          if (osKey) headers['Authorization'] = `ApiKey ${osKey}`;

          const res = await fetch(
            `https://api.opensanctions.org/search/default?q=${encodeURIComponent(input)}&datasets=${list}&limit=5`,
            { headers }
          );
          const data = await res.json();
          results.checks[list] = {
            success: res.ok,
            matchCount: data.results?.length || 0,
            matches: data.results?.slice(0, 3).map((r: Record<string, unknown>) => ({
              name: r.caption,
              score: r.score,
              datasets: r.datasets,
            })),
          };
        } catch (e) {
          results.checks[list] = { success: false, error: String(e) };
        }
      }

    } else if (type === 'watchlist') {
      // INTERPOL Red Notices
      try {
        const res = await fetch(
          `https://ws-public.interpol.int/notices/v1/red?name=${encodeURIComponent(input)}&resultPerPage=10`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          const notices = data._embedded?.notices || [];
          results.checks.interpol = {
            success: true,
            matchCount: notices.length,
            matches: notices.slice(0, 5).map((n: Record<string, unknown>) => ({
              name: `${n.forename} ${n.name}`,
              nationality: n.nationalities,
              entityId: n.entity_id,
            })),
          };
        } else {
          results.checks.interpol = { success: true, matchCount: 0, message: 'No matches found' };
        }
      } catch (e) {
        results.checks.interpol = { success: false, error: String(e) };
      }

      // FBI Most Wanted
      try {
        const res = await fetch(
          `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(input)}&pageSize=10`,
          { headers: { 'Accept': 'application/json' } }
        );
        const data = await res.json();
        results.checks.fbi = {
          success: true,
          matchCount: data.items?.length || 0,
          matches: data.items?.slice(0, 5).map((i: Record<string, unknown>) => ({
            title: i.title,
            subjects: i.subjects,
            url: i.url,
          })),
        };
      } catch (e) {
        results.checks.fbi = { success: false, error: String(e) };
      }

      // Europol via OpenSanctions
      const osKey = process.env.NEXT_PUBLIC_OPENSANCTIONS_API_KEY;
      try {
        const headers: HeadersInit = { 'Accept': 'application/json' };
        if (osKey) headers['Authorization'] = `ApiKey ${osKey}`;

        const res = await fetch(
          `https://api.opensanctions.org/search/default?q=${encodeURIComponent(input)}&datasets=eu_most_wanted&limit=5`,
          { headers }
        );
        const data = await res.json();
        results.checks.europol = {
          success: res.ok,
          matchCount: data.results?.length || 0,
          matches: data.results?.slice(0, 3),
        };
      } catch (e) {
        results.checks.europol = { success: false, error: String(e) };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to run OSINT checks', details: String(error) },
      { status: 500 }
    );
  }
}
