import { NextRequest, NextResponse } from 'next/server';
import * as truecallerjs from 'truecallerjs';
import crypto from 'crypto';
import { checkEmailSites } from '@/lib/osint/email-sites-checker';
import { checkEmailWithHolehe } from '@/lib/osint/holehe';

interface FullProfile {
  input: { type: string; value: string };
  timestamp: string;

  // Identity
  names: string[];
  photos: PhotoInfo[];
  dateOfBirth?: string;
  gender?: string;

  // Contact
  phones: PhoneInfo[];
  emails: EmailInfo[];
  addresses: AddressInfo[];

  // Online presence
  socialProfiles: SocialProfile[];
  websites: string[];
  usernames: string[];

  // Digital footprint
  breaches: BreachInfo[];
  registeredSites: RegisteredSite[];

  // Risk assessment
  sanctions: SanctionMatch[];
  watchlists: WatchlistMatch[];
  riskScore: number;
  riskFactors: string[];

  // Metadata
  sources: string[];
  confidence: number;
}

interface PhotoInfo {
  url: string;
  source: string;
}

interface PhoneInfo {
  number: string;
  type?: string;
  carrier?: string;
  country?: string;
  verified?: boolean;
  source: string;
}

interface EmailInfo {
  email: string;
  verified?: boolean;
  personal?: boolean;
  disposable?: boolean;
  breachCount?: number;
  source: string;
}

interface AddressInfo {
  formatted: string;
  city?: string;
  country?: string;
  source: string;
}

interface SocialProfile {
  platform: string;
  url?: string;
  username?: string;
  name?: string;
  bio?: string;
  followers?: number;
  photo?: string;
  verified?: boolean;
  source: string;
}

interface RegisteredSite {
  name: string;
  url: string;
  exists: boolean;
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
}

interface WatchlistMatch {
  source: string;
  name: string;
  details?: string;
}

// Gravatar lookup from email
function getGravatarUrl(email: string): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=400&d=404`;
}

// Check if Gravatar exists
async function checkGravatar(email: string): Promise<string | null> {
  const url = getGravatarUrl(email);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return url;
  } catch {}
  return null;
}

// GitHub lookup by email
async function searchGitHub(email: string): Promise<SocialProfile | null> {
  try {
    const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TerangaSafe/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items?.[0]) {
        const user = data.items[0];
        // Get full profile
        const profileRes = await fetch(user.url, {
          headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TerangaSafe/1.0' }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          return {
            platform: 'github',
            url: profile.html_url,
            username: profile.login,
            name: profile.name,
            bio: profile.bio,
            followers: profile.followers,
            photo: profile.avatar_url,
            source: 'github_api'
          };
        }
      }
    }
  } catch {}
  return null;
}

// Check common sites for email registration (simulated holehe)
async function checkEmailRegistrations(email: string): Promise<RegisteredSite[]> {
  const sites: RegisteredSite[] = [];

  // Check Gravatar (indicates WordPress/Gravatar account)
  const gravatar = await checkGravatar(email);
  if (gravatar) {
    sites.push({ name: 'Gravatar/WordPress', url: 'https://gravatar.com', exists: true });
  }

  // Check GitHub
  try {
    const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`, {
      headers: { 'User-Agent': 'TerangaSafe/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      sites.push({ name: 'GitHub', url: 'https://github.com', exists: data.total_count > 0 });
    }
  } catch {}

  // Check if email domain suggests work account
  const domain = email.split('@')[1];
  if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
    sites.push({ name: `Work/Company (${domain})`, url: `https://${domain}`, exists: true });
  }

  return sites;
}

// Search social media by username
async function searchUsername(username: string): Promise<SocialProfile[]> {
  const profiles: SocialProfile[] = [];

  // Platform URL patterns
  const platforms = [
    { name: 'twitter', url: `https://twitter.com/${username}` },
    { name: 'instagram', url: `https://instagram.com/${username}` },
    { name: 'linkedin', url: `https://linkedin.com/in/${username}` },
    { name: 'facebook', url: `https://facebook.com/${username}` },
    { name: 'tiktok', url: `https://tiktok.com/@${username}` },
    { name: 'github', url: `https://github.com/${username}` },
    { name: 'medium', url: `https://medium.com/@${username}` },
  ];

  // Check each platform (basic HEAD request)
  for (const platform of platforms) {
    try {
      const res = await fetch(platform.url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TerangaSafe/1.0)' }
      });
      // 200 or redirect (302/301) usually means profile exists
      if (res.status === 200 || res.status === 301 || res.status === 302) {
        profiles.push({
          platform: platform.name,
          url: platform.url,
          username: username,
          source: 'username_search'
        });
      }
    } catch {}
  }

  return profiles;
}

// Extract username from email
function extractUsername(email: string): string {
  return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
}

// Main profile builder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    const profile: FullProfile = {
      input: { type, value: input },
      timestamp: new Date().toISOString(),
      names: [],
      photos: [],
      phones: [],
      emails: [],
      addresses: [],
      socialProfiles: [],
      websites: [],
      usernames: [],
      breaches: [],
      registeredSites: [],
      sanctions: [],
      watchlists: [],
      riskScore: 0,
      riskFactors: [],
      sources: [],
      confidence: 0,
    };

    // ========================================
    // PHASE 1: Initial data from input
    // ========================================

    if (type === 'phone') {
      await enrichFromPhone(input, profile);
    } else if (type === 'email') {
      profile.emails.push({ email: input, source: 'input' });
      profile.usernames.push(extractUsername(input));
    } else if (type === 'name') {
      profile.names.push(input);
    }

    // ========================================
    // PHASE 2: Expand from discovered emails
    // ========================================

    for (const emailInfo of [...profile.emails]) {
      const email = emailInfo.email;

      // Check Gravatar for photo
      const gravatarUrl = await checkGravatar(email);
      if (gravatarUrl) {
        profile.photos.push({ url: gravatarUrl, source: 'gravatar' });
        profile.sources.push('gravatar');
      }

      // Search GitHub
      const github = await searchGitHub(email);
      if (github) {
        profile.socialProfiles.push(github);
        if (github.name && !profile.names.includes(github.name)) {
          profile.names.push(github.name);
        }
        if (github.photo) {
          profile.photos.push({ url: github.photo, source: 'github' });
        }
        if (github.username && !profile.usernames.includes(github.username)) {
          profile.usernames.push(github.username);
        }
        profile.sources.push('github');
      }

      // Check email registrations using HOLEHE (120+ sites, verified)
      const holeheResults = await checkEmailWithHolehe(email);
      for (const result of holeheResults) {
        // Add to registered sites
        if (!profile.registeredSites.find(s => s.name.toLowerCase() === result.name.toLowerCase())) {
          profile.registeredSites.push({
            name: result.name,
            url: result.url,
            exists: true
          });
        }

        // Social platforms also go to socialProfiles
        const socialPlatforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'pinterest',
          'snapchat', 'tiktok', 'tumblr', 'reddit', 'discord', 'github', 'gitlab'];
        if (socialPlatforms.includes(result.name.toLowerCase())) {
          if (!profile.socialProfiles.find(p => p.platform.toLowerCase() === result.name.toLowerCase())) {
            profile.socialProfiles.push({
              platform: result.name,
              url: result.url,
              source: 'holehe'
            });
          }
        }
      }
      if (holeheResults.length > 0) {
        profile.sources.push('holehe');
      }

      // Also do basic checks (backup)
      const registrations = await checkEmailRegistrations(email);
      profile.registeredSites.push(...registrations.filter(r =>
        !profile.registeredSites.find(s => s.name.toLowerCase() === r.name.toLowerCase())
      ));

      // Check breaches (HIBP)
      await checkBreaches(email, profile);

      // Check email reputation (EmailRep)
      await checkEmailReputation(email, profile);
    }

    // ========================================
    // PHASE 3: Search by usernames (DISABLED - too many false positives)
    // ========================================
    // Username guessing leads to false positives - only use verified sources
    // Keeping usernames for reference but not searching social media by them

    // ========================================
    // PHASE 4: Check names against watchlists
    // ========================================

    for (const name of [...new Set(profile.names)]) {
      await checkSanctions(name, profile);
      await checkWatchlists(name, profile);
    }

    // ========================================
    // PHASE 5: Calculate risk score
    // ========================================

    calculateRiskScore(profile);
    calculateConfidence(profile);

    // Deduplicate
    profile.names = [...new Set(profile.names)];
    profile.usernames = [...new Set(profile.usernames)];
    profile.sources = [...new Set(profile.sources)];

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { error: 'Profile building failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function enrichFromPhone(phone: string, profile: FullProfile) {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  profile.phones.push({
    number: cleanPhone,
    source: 'input',
  });

  // Numverify for carrier info
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
        profile.phones[0].verified = true;
        if (data.location) {
          profile.addresses.push({ formatted: data.location, source: 'numverify' });
        }
        profile.sources.push('numverify');
      }
    } catch {}
  }

  // Truecaller for name, email, photo
  const truecallerInstallationId = process.env.TRUECALLER_INSTALLATION_ID;
  if (truecallerInstallationId) {
    try {
      let countryCode = 'SN';
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
      const rawData = response.json();

      // Extract name
      const name = response.getName();
      if (name && name !== 'Unknown') {
        profile.names.push(name);
      }

      // Extract email
      const email = response.getEmailId();
      if (email) {
        profile.emails.push({ email, source: 'truecaller' });
        profile.usernames.push(extractUsername(email));
      }

      // Extract photo
      if (rawData?.data?.[0]?.image) {
        profile.photos.push({ url: rawData.data[0].image, source: 'truecaller' });
      }

      // Extract address (handle both string and object)
      if (typeof response.getAddresses === 'function') {
        const address = response.getAddresses();
        if (address) {
          const formatted = typeof address === 'string' ? address :
            (address.city ? `${address.city}, ${address.countryCode || ''}` : JSON.stringify(address));
          profile.addresses.push({ formatted, source: 'truecaller' });
        }
      }
      // Also try from raw data
      if (rawData?.data?.[0]?.addresses) {
        for (const addr of rawData.data[0].addresses) {
          const parts = [addr.city, addr.countryCode].filter(Boolean);
          if (parts.length > 0 && !profile.addresses.find(a => a.formatted.includes(parts[0]))) {
            profile.addresses.push({
              formatted: parts.join(', '),
              city: addr.city,
              country: addr.countryCode,
              source: 'truecaller'
            });
          }
        }
      }

      // Extract alternate phones (check if method exists)
      if (typeof response.getAlternateNumber === 'function') {
        const altPhone = response.getAlternateNumber();
        if (altPhone && altPhone !== cleanPhone) {
          profile.phones.push({ number: altPhone, source: 'truecaller' });
        }
      }

      // Spam check
      if (rawData?.data?.[0]?.spamInfo?.spamScore > 3) {
        profile.riskFactors.push(`Phone flagged as spam (score: ${rawData.data[0].spamInfo.spamScore}/10)`);
      }

      // Internet addresses (additional emails/social)
      if (rawData?.data?.[0]?.internetAddresses) {
        for (const addr of rawData.data[0].internetAddresses) {
          if (addr.type === 'email' && !profile.emails.find(e => e.email === addr.id)) {
            profile.emails.push({ email: addr.id, source: 'truecaller' });
          } else if (addr.type === 'url') {
            profile.websites.push(addr.id);
          }
        }
      }

      profile.sources.push('truecaller');
    } catch (e) {
      console.error('Truecaller error:', e);
    }
  }
}

async function checkBreaches(email: string, profile: FullProfile) {
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

      for (const breach of breaches.slice(0, 15)) {
        if (!profile.breaches.find(b => b.name === breach.Name)) {
          profile.breaches.push({
            name: breach.Name,
            date: breach.BreachDate,
            dataTypes: breach.DataClasses || [],
          });

          // Add to registered sites
          if (!profile.registeredSites.find(s => s.name === breach.Name)) {
            profile.registeredSites.push({
              name: breach.Name,
              url: breach.Domain ? `https://${breach.Domain}` : '',
              exists: true
            });
          }
        }
      }

      if (breaches.length > 0) {
        profile.riskFactors.push(`Email found in ${breaches.length} data breach(es)`);
        profile.sources.push('hibp');
      }
    }
  } catch {}
}

async function checkEmailReputation(email: string, profile: FullProfile) {
  try {
    const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers: { 'User-Agent': 'TerangaSafe/1.0', 'Accept': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();

      // Update email info
      const emailInfo = profile.emails.find(e => e.email === email);
      if (emailInfo) {
        emailInfo.disposable = data.details?.disposable;
      }

      // Add social profiles from EmailRep
      if (data.details?.profiles) {
        for (const platform of data.details.profiles) {
          if (!profile.socialProfiles.find(p => p.platform === platform)) {
            profile.socialProfiles.push({
              platform,
              source: 'emailrep'
            });
          }
        }
      }

      // Risk factors
      if (data.suspicious) {
        profile.riskFactors.push('Email flagged as suspicious');
      }
      if (data.details?.malicious_activity) {
        profile.riskFactors.push('Email linked to malicious activity');
      }
      if (data.details?.spam) {
        profile.riskFactors.push('Email associated with spam');
      }

      profile.sources.push('emailrep');
    }
  } catch {}
}

async function checkSanctions(name: string, profile: FullProfile) {
  const osKey = process.env.NEXT_PUBLIC_OPENSANCTIONS_API_KEY;
  const headers: HeadersInit = { 'Accept': 'application/json' };
  if (osKey) headers['Authorization'] = `ApiKey ${osKey}`;

  try {
    const res = await fetch(
      `https://api.opensanctions.org/search/default?q=${encodeURIComponent(name)}&limit=5`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      for (const result of (data.results || [])) {
        const matchScore = result.score ?? 1.0;
        if (matchScore >= 0.7 || result.datasets?.length > 3) {
          profile.sanctions.push({
            list: (result.datasets || []).slice(0, 3).join(', '),
            name: result.caption,
            score: matchScore,
          });
        }
      }
      if (profile.sanctions.length > 0) {
        profile.riskFactors.push(`Name matches ${profile.sanctions.length} sanctions record(s)`);
        profile.sources.push('opensanctions');
      }
    }
  } catch {}
}

async function checkWatchlists(name: string, profile: FullProfile) {
  // INTERPOL
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
      if (notices.length > 0) {
        profile.sources.push('interpol');
      }
    }
  } catch {}

  // FBI
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
      if (data.items?.length > 0) {
        profile.sources.push('fbi');
      }
    }
  } catch {}

  if (profile.watchlists.length > 0) {
    profile.riskFactors.push(`Name appears on ${profile.watchlists.length} watchlist(s)`);
  }
}

function calculateRiskScore(profile: FullProfile) {
  let score = 0;

  // Sanctions (high weight)
  score += profile.sanctions.length * 30;

  // Watchlists (high weight)
  score += profile.watchlists.length * 25;

  // Breaches (medium weight)
  score += Math.min(profile.breaches.length * 3, 20);

  // Suspicious/malicious flags
  score += profile.riskFactors.filter(f =>
    f.includes('suspicious') || f.includes('malicious') || f.includes('spam')
  ).length * 15;

  // Disposable email
  const disposableEmails = profile.emails.filter(e => e.disposable);
  score += disposableEmails.length * 10;

  profile.riskScore = Math.min(score, 100);
}

function calculateConfidence(profile: FullProfile) {
  let confidence = 0;

  // More sources = higher confidence
  confidence += profile.sources.length * 10;

  // Verified data
  if (profile.phones.some(p => p.verified)) confidence += 10;
  if (profile.names.length > 0) confidence += 15;
  if (profile.emails.length > 0) confidence += 15;
  if (profile.photos.length > 0) confidence += 10;
  if (profile.socialProfiles.length > 0) confidence += 10;

  profile.confidence = Math.min(confidence, 100);
}
