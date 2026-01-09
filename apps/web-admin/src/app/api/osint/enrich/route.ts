import { NextRequest, NextResponse } from 'next/server';
import * as truecallerjs from 'truecallerjs';

interface EnrichedProfile {
  input: { type: string; value: string };
  timestamp: string;
  // Discovered data
  phones: PhoneInfo[];
  emails: EmailInfo[];
  socialProfiles: SocialProfile[];
  names: string[];
  locations: string[];
  // Verification results
  breaches: BreachInfo[];
  sanctions: SanctionMatch[];
  watchlists: WatchlistMatch[];
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
}

interface PhoneInfo {
  number: string;
  carrier?: string;
  type?: string;
  country?: string;
  valid?: boolean;
  source: string;
}

interface EmailInfo {
  email: string;
  valid?: boolean;
  disposable?: boolean;
  reputation?: number;
  breachCount?: number;
  source: string;
}

interface SocialProfile {
  platform: string;
  username?: string;
  url?: string;
  name?: string;
  photo?: string;
  source: string;
}

interface BreachInfo {
  name: string;
  date: string;
  dataTypes: string[];
}

interface SanctionMatch {
  list: string;
  name: string;
  score: number;
  reason?: string;
}

interface WatchlistMatch {
  source: string;
  name: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    const profile: EnrichedProfile = {
      input: { type, value: input },
      timestamp: new Date().toISOString(),
      phones: [],
      emails: [],
      socialProfiles: [],
      names: [],
      locations: [],
      breaches: [],
      sanctions: [],
      watchlists: [],
      riskScore: 0,
      riskFactors: [],
    };

    // Step 1: Initial enrichment based on input type
    if (type === 'phone') {
      await enrichFromPhone(input, profile);
    } else if (type === 'email') {
      await enrichFromEmail(input, profile);
    } else if (type === 'name') {
      await enrichFromName(input, profile);
    }

    // Step 2: Cross-reference discovered data
    // Check discovered emails for breaches
    for (const email of profile.emails) {
      await checkEmailBreaches(email.email, profile);
      await checkEmailReputation(email.email, profile);
    }

    // Step 3: Check names against sanctions/watchlists
    for (const name of profile.names) {
      await checkSanctions(name, profile);
      await checkWatchlists(name, profile);
    }

    // Step 4: Calculate risk score
    calculateRiskScore(profile);

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { error: 'Enrichment failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function enrichFromPhone(phone: string, profile: EnrichedProfile) {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Add initial phone
  profile.phones.push({
    number: cleanPhone,
    source: 'input',
  });

  // Try Sync.ME / GetContact style lookup via available services
  // These services have crowd-sourced contact databases

  // 1. Try WhatsApp check (via CallMeBot or similar - indicates active user)
  // 2. Try Telegram check
  // 3. Try social media phone lookup

  // Epieos - Free service that can find accounts linked to phone
  try {
    const epieosRes = await fetch('https://api.epieos.com/v1/phone-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone }),
    });
    if (epieosRes.ok) {
      const data = await epieosRes.json();
      if (data.name) profile.names.push(data.name);
      if (data.email) {
        profile.emails.push({ email: data.email, source: 'epieos' });
      }
      if (data.profiles) {
        for (const p of data.profiles) {
          profile.socialProfiles.push({
            platform: p.platform,
            url: p.url,
            username: p.username,
            source: 'epieos',
          });
        }
      }
    }
  } catch (e) {
    // Epieos may not be available
  }

  // Try reverse lookup via abstract API
  const abstractKey = process.env.NEXT_PUBLIC_ABSTRACT_API_KEY;
  if (abstractKey) {
    try {
      const res = await fetch(
        `https://phonevalidation.abstractapi.com/v1/?api_key=${abstractKey}&phone=${encodeURIComponent(cleanPhone)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.carrier) profile.phones[0].carrier = data.carrier;
        if (data.location) profile.locations.push(data.location);
      }
    } catch (e) {
      console.error('Abstract API error:', e);
    }
  }

  // Numverify - Get carrier info
  const numverifyKey = process.env.NEXT_PUBLIC_NUMVERIFY_API_KEY;
  if (numverifyKey) {
    try {
      const res = await fetch(
        `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${encodeURIComponent(cleanPhone)}&format=1`
      );
      const data = await res.json();
      if (data.valid) {
        profile.phones[0].carrier = data.carrier;
        profile.phones[0].type = data.line_type;
        profile.phones[0].country = data.country_name;
        profile.phones[0].valid = true;
        if (data.location) {
          profile.locations.push(data.location);
        }
      }
    } catch (e) {
      console.error('Numverify error:', e);
    }
  }

  // Try to find associated data via FullContact (if we had the key)
  // FullContact can return emails and social profiles from phone
  const fullContactKey = process.env.NEXT_PUBLIC_FULLCONTACT_API_KEY;
  if (fullContactKey) {
    try {
      const res = await fetch('https://api.fullcontact.com/v3/person.enrich', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fullContactKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      if (res.ok) {
        const data = await res.json();
        // Extract emails
        if (data.emails) {
          for (const email of data.emails) {
            profile.emails.push({
              email: email.value,
              source: 'fullcontact',
            });
          }
        }
        // Extract name
        if (data.fullName) {
          profile.names.push(data.fullName);
        }
        // Extract social profiles
        if (data.socialProfiles) {
          for (const social of data.socialProfiles) {
            profile.socialProfiles.push({
              platform: social.type,
              url: social.url,
              username: social.username,
              source: 'fullcontact',
            });
          }
        }
        // Extract location
        if (data.location) {
          profile.locations.push(data.location);
        }
      }
    } catch (e) {
      console.error('FullContact error:', e);
    }
  }

  // Try free reverse lookup services first
  // These have limited data but work without API keys

  // Check if phone might be on WhatsApp (indicates active number)
  // This is a basic check - WhatsApp Business API would give more info

  // Truecaller via truecallerjs - Get name, email, photo from phone
  const truecallerInstallationId = process.env.TRUECALLER_INSTALLATION_ID;
  if (truecallerInstallationId) {
    try {
      // Determine country code from phone
      let countryCode = 'SN'; // Default Senegal
      if (cleanPhone.startsWith('+33')) countryCode = 'FR';
      else if (cleanPhone.startsWith('+1')) countryCode = 'US';
      else if (cleanPhone.startsWith('+221')) countryCode = 'SN';
      else if (cleanPhone.startsWith('+234')) countryCode = 'NG';
      else if (cleanPhone.startsWith('+91')) countryCode = 'IN';

      const searchData = {
        number: cleanPhone.replace(/^\+/, ''),
        countryCode,
        installationId: truecallerInstallationId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await truecallerjs.search(searchData);

      // Get name
      const name = response.getName();
      if (name && name !== 'Unknown') {
        profile.names.push(name);
      }

      // Get email
      const email = response.getEmailId();
      if (email) {
        profile.emails.push({
          email,
          source: 'truecaller',
        });
      }

      // Get alternate phones (check if method exists)
      if (typeof response.getAlternateNumber === 'function') {
        const altPhone = response.getAlternateNumber();
        if (altPhone && altPhone !== cleanPhone) {
          profile.phones.push({
            number: altPhone,
            source: 'truecaller',
          });
        }
      }

      // Get address/location (check if method exists)
      if (typeof response.getAddresses === 'function') {
        const address = response.getAddresses();
        if (address) {
          profile.locations.push(address);
        }
      }

      // Check spam score
      const spamInfo = response.json()?.data?.[0]?.spamInfo;
      if (spamInfo?.spamScore && spamInfo.spamScore > 3) {
        profile.riskFactors.push(`Phone flagged as spam by Truecaller (score: ${spamInfo.spamScore}/10)`);
      }

      // Get image
      const image = response.json()?.data?.[0]?.image;
      if (image) {
        profile.socialProfiles.push({
          platform: 'truecaller',
          photo: image,
          source: 'truecaller',
        });
      }

    } catch (e) {
      console.error('Truecaller error:', e);
    }
  }

  // Pipl - Best for comprehensive people search
  const piplKey = process.env.PIPL_API_KEY;
  if (piplKey) {
    try {
      const res = await fetch(
        `https://api.pipl.com/search/?phone=${encodeURIComponent(cleanPhone)}&key=${piplKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.person) {
          // Names
          if (data.person.names) {
            for (const name of data.person.names) {
              if (name.display) profile.names.push(name.display);
            }
          }
          // Emails
          if (data.person.emails) {
            for (const email of data.person.emails) {
              profile.emails.push({
                email: email.address,
                source: 'pipl',
              });
            }
          }
          // Social profiles
          if (data.person.urls) {
            for (const url of data.person.urls) {
              profile.socialProfiles.push({
                platform: url.name || 'unknown',
                url: url.url,
                source: 'pipl',
              });
            }
          }
          // Addresses/locations
          if (data.person.addresses) {
            for (const addr of data.person.addresses) {
              if (addr.display) profile.locations.push(addr.display);
            }
          }
        }
      }
    } catch (e) {
      console.error('Pipl error:', e);
    }
  }
}

async function enrichFromEmail(email: string, profile: EnrichedProfile) {
  // Add initial email
  profile.emails.push({
    email,
    source: 'input',
  });

  // Hunter.io - Check deliverability
  const hunterKey = process.env.NEXT_PUBLIC_HUNTER_API_KEY;
  if (hunterKey) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterKey}`
      );
      const data = await res.json();
      if (data.data) {
        profile.emails[0].valid = data.data.status === 'valid';
        profile.emails[0].disposable = data.data.disposable;
        // Get name from email if available
        if (data.data.first_name || data.data.last_name) {
          profile.names.push(`${data.data.first_name || ''} ${data.data.last_name || ''}`.trim());
        }
      }
    } catch (e) {
      console.error('Hunter error:', e);
    }
  }

  // FullContact - Get social profiles from email
  const fullContactKey = process.env.NEXT_PUBLIC_FULLCONTACT_API_KEY;
  if (fullContactKey) {
    try {
      const res = await fetch('https://api.fullcontact.com/v3/person.enrich', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fullContactKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        // Extract phones
        if (data.phones) {
          for (const phone of data.phones) {
            profile.phones.push({
              number: phone.value,
              source: 'fullcontact',
            });
          }
        }
        // Extract name
        if (data.fullName) {
          profile.names.push(data.fullName);
        }
        // Extract social profiles
        if (data.socialProfiles) {
          for (const social of data.socialProfiles) {
            profile.socialProfiles.push({
              platform: social.type,
              url: social.url,
              username: social.username,
              name: social.name,
              photo: social.photo,
              source: 'fullcontact',
            });
          }
        }
        if (data.location) {
          profile.locations.push(data.location);
        }
      }
    } catch (e) {
      console.error('FullContact error:', e);
    }
  }

  // EmailRep - Get reputation score
  try {
    const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers: { 'User-Agent': 'TerangaSafe/1.0', 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      profile.emails[0].reputation = data.reputation === 'high' ? 90 :
                                     data.reputation === 'medium' ? 60 :
                                     data.reputation === 'low' ? 30 : 50;

      // Extract profile info
      if (data.details?.profiles) {
        for (const platform of data.details.profiles) {
          profile.socialProfiles.push({
            platform,
            source: 'emailrep',
          });
        }
      }
    }
  } catch (e) {
    console.error('EmailRep error:', e);
  }
}

async function enrichFromName(name: string, profile: EnrichedProfile) {
  profile.names.push(name);

  // Check sanctions immediately for name input
  await checkSanctions(name, profile);
  await checkWatchlists(name, profile);
}

async function checkEmailBreaches(email: string, profile: EnrichedProfile) {
  const hibpKey = process.env.NEXT_PUBLIC_HIBP_API_KEY;
  if (!hibpKey) return;

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
      const emailInfo = profile.emails.find(e => e.email === email);
      if (emailInfo) {
        emailInfo.breachCount = breaches.length;
      }

      for (const breach of breaches.slice(0, 10)) {
        profile.breaches.push({
          name: breach.Name,
          date: breach.BreachDate,
          dataTypes: breach.DataClasses || [],
        });
      }

      if (breaches.length > 0) {
        profile.riskFactors.push(`Email found in ${breaches.length} data breach(es)`);
      }
    }
  } catch (e) {
    console.error('HIBP error:', e);
  }
}

async function checkEmailReputation(email: string, profile: EnrichedProfile) {
  try {
    const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers: { 'User-Agent': 'TerangaSafe/1.0', 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.suspicious) {
        profile.riskFactors.push('Email flagged as suspicious');
      }
      if (data.details?.spam) {
        profile.riskFactors.push('Email associated with spam');
      }
      if (data.details?.malicious_activity) {
        profile.riskFactors.push('Email linked to malicious activity');
      }
    }
  } catch (e) {
    console.error('EmailRep check error:', e);
  }
}

async function checkSanctions(name: string, profile: EnrichedProfile) {
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
      for (const result of (data.results || []).slice(0, 5)) {
        // Accept if score is high OR if it's a direct match (score can be null for exact matches)
        const matchScore = result.score ?? 1.0;
        if (matchScore >= 0.5 || result.datasets?.length > 3) {
          profile.sanctions.push({
            list: (result.datasets || []).slice(0, 5).join(', '),
            name: result.caption,
            score: matchScore,
          });
        }
      }

      if (profile.sanctions.length > 0) {
        profile.riskFactors.push(`Name matches ${profile.sanctions.length} sanctions record(s)`);
      }
    }
  } catch (e) {
    console.error('Sanctions error:', e);
  }
}

async function checkWatchlists(name: string, profile: EnrichedProfile) {
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
        profile.watchlists.push({
          source: 'INTERPOL Red Notice',
          name: `${notice.forename} ${notice.name}`,
          details: notice.nationalities?.join(', '),
        });
      }
    }
  } catch (e) {
    console.error('INTERPOL error:', e);
  }

  // FBI Most Wanted
  try {
    const res = await fetch(
      `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(name)}&pageSize=5`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.items || [])) {
        profile.watchlists.push({
          source: 'FBI Most Wanted',
          name: item.title,
          details: item.subjects?.join(', '),
        });
      }
    }
  } catch (e) {
    console.error('FBI error:', e);
  }

  if (profile.watchlists.length > 0) {
    profile.riskFactors.push(`Name appears on ${profile.watchlists.length} watchlist(s)`);
  }
}

function calculateRiskScore(profile: EnrichedProfile) {
  let score = 0;

  // Sanctions matches (high weight)
  score += profile.sanctions.length * 30;

  // Watchlist matches (high weight)
  score += profile.watchlists.length * 25;

  // Breaches (medium weight)
  score += Math.min(profile.breaches.length * 5, 20);

  // Other risk factors
  score += profile.riskFactors.filter(f =>
    f.includes('suspicious') || f.includes('malicious')
  ).length * 15;

  // Invalid/disposable email
  const invalidEmails = profile.emails.filter(e => e.valid === false || e.disposable);
  score += invalidEmails.length * 10;

  // Cap at 100
  profile.riskScore = Math.min(score, 100);
}
