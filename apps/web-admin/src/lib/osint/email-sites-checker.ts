/**
 * Email Sites Checker - Holehe-style implementation
 * Checks if an email is registered on various websites
 */

interface SiteCheckResult {
  name: string;
  url: string;
  exists: boolean;
  error?: string;
}

interface SiteConfig {
  name: string;
  url: string;
  check: (email: string) => Promise<boolean | null>;
}

// Helper to safely check
async function safeCheck(fn: () => Promise<boolean | null>): Promise<boolean | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// Site configurations
const SITES: SiteConfig[] = [
  // ===== Social Media =====
  // NOTE: Most social media platforms block automated email checks
  // Only include platforms with reliable email-based verification
  {
    name: 'Twitter/X',
    url: 'https://twitter.com',
    check: async (email) => {
      // Twitter API often blocks - skip for reliability
      return null;
    }
  },

  // ===== Professional =====
  {
    name: 'GitHub',
    url: 'https://github.com',
    check: async (email) => {
      const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`, {
        headers: { 'User-Agent': 'TerangaSafe/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        return data.total_count > 0;
      }
      return null;
    }
  },
  {
    name: 'GitLab',
    url: 'https://gitlab.com',
    check: async (email) => {
      const res = await fetch('https://gitlab.com/users/password/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `user[email]=${encodeURIComponent(email)}`,
        redirect: 'manual'
      });
      return res.status === 302;
    }
  },
  {
    name: 'Bitbucket',
    url: 'https://bitbucket.org',
    check: async (email) => {
      const res = await fetch(`https://bitbucket.org/account/password/reset/?email=${encodeURIComponent(email)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const text = await res.text();
      return text.includes('password reset') && !text.includes('not found');
    }
  },
  {
    name: 'Stackoverflow',
    url: 'https://stackoverflow.com',
    check: async (email) => {
      const res = await fetch('https://stackoverflow.com/users/account-recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`
      });
      const text = await res.text();
      return text.includes('email has been sent') || text.includes('Account recovery');
    }
  },

  // ===== E-commerce =====
  {
    name: 'Amazon',
    url: 'https://amazon.com',
    check: async (email) => {
      const res = await fetch('https://www.amazon.com/ap/forgotpassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`,
        redirect: 'manual'
      });
      return res.status === 302;
    }
  },
  {
    name: 'eBay',
    url: 'https://ebay.com',
    check: async (email) => {
      const res = await fetch('https://signin.ebay.com/ws/eBayISAPI.dll?SignIn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `userid=${encodeURIComponent(email)}`,
        redirect: 'manual'
      });
      const text = await res.text();
      return text.includes('password') && !text.includes("don't recognize");
    }
  },
  {
    name: 'Etsy',
    url: 'https://etsy.com',
    check: async (email) => {
      const res = await fetch('https://www.etsy.com/api/v3/ajax/member/email-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        return data.exists === true;
      }
      return null;
    }
  },

  // ===== Productivity =====
  {
    name: 'Notion',
    url: 'https://notion.so',
    check: async (email) => {
      const res = await fetch('https://www.notion.so/api/v3/getSpaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.ok;
    }
  },
  {
    name: 'Trello',
    url: 'https://trello.com',
    check: async (email) => {
      const res = await fetch('https://trello.com/1/members/' + encodeURIComponent(email), {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return res.ok;
    }
  },
  {
    name: 'Slack',
    url: 'https://slack.com',
    check: async (email) => {
      const res = await fetch('https://slack.com/api/users.admin.checkEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`
      });
      if (res.ok) {
        const data = await res.json();
        return data.ok === true;
      }
      return null;
    }
  },

  // ===== Gaming =====
  {
    name: 'Discord',
    url: 'https://discord.com',
    check: async (email) => {
      const res = await fetch('https://discord.com/api/v9/auth/forgot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.status === 204 || res.ok;
    }
  },
  {
    name: 'Steam',
    url: 'https://store.steampowered.com',
    check: async (email) => {
      const res = await fetch('https://store.steampowered.com/join/ajaxverifyemail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`
      });
      if (res.ok) {
        const data = await res.json();
        return data.success === false; // false means email is taken
      }
      return null;
    }
  },
  {
    name: 'Epic Games',
    url: 'https://epicgames.com',
    check: async (email) => {
      // Epic has strong anti-bot
      return null;
    }
  },
  {
    name: 'Spotify',
    url: 'https://spotify.com',
    check: async (email) => {
      const res = await fetch(`https://spclient.wg.spotify.com/signup/public/v1/account?email=${encodeURIComponent(email)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const data = await res.json();
        return data.status === 20;
      }
      return null;
    }
  },

  // ===== Fitness =====
  {
    name: 'Strava',
    url: 'https://strava.com',
    check: async (email) => {
      const res = await fetch('https://www.strava.com/api/v3/athletes/email_check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.ok;
    }
  },

  // ===== Dating =====
  {
    name: 'Tinder',
    url: 'https://tinder.com',
    check: async (email) => {
      // Tinder has strong anti-bot
      return null;
    }
  },

  // ===== Other =====
  {
    name: 'Gravatar',
    url: 'https://gravatar.com',
    check: async (email) => {
      const crypto = await import('crypto');
      const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
      const res = await fetch(`https://www.gravatar.com/avatar/${hash}?d=404`, {
        method: 'HEAD'
      });
      return res.ok;
    }
  },
  {
    name: 'WordPress',
    url: 'https://wordpress.com',
    check: async (email) => {
      const res = await fetch('https://wordpress.com/wp-login.php?action=lostpassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `user_login=${encodeURIComponent(email)}`,
        redirect: 'manual'
      });
      return res.status === 302;
    }
  },
  {
    name: 'Medium',
    url: 'https://medium.com',
    check: async (email) => {
      const res = await fetch('https://medium.com/_/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.ok;
    }
  },
  {
    name: 'Quora',
    url: 'https://quora.com',
    check: async (email) => {
      // Quora has strong anti-bot
      return null;
    }
  },
  {
    name: 'Reddit',
    url: 'https://reddit.com',
    check: async (email) => {
      const res = await fetch('https://www.reddit.com/api/check_username.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`
      });
      return res.ok;
    }
  },
  {
    name: 'Dropbox',
    url: 'https://dropbox.com',
    check: async (email) => {
      const res = await fetch('https://www.dropbox.com/forgot_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
        },
        body: `email=${encodeURIComponent(email)}`,
        redirect: 'manual'
      });
      return res.status === 302;
    }
  },
  {
    name: 'Adobe',
    url: 'https://adobe.com',
    check: async (email) => {
      const res = await fetch('https://auth.services.adobe.com/signin/v1/users/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        return data.length > 0;
      }
      return null;
    }
  },
  {
    name: 'Netflix',
    url: 'https://netflix.com',
    check: async (email) => {
      const res = await fetch('https://www.netflix.com/api/shakti/vdtGzxsq/pathEvaluator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.ok;
    }
  },
  {
    name: 'Duolingo',
    url: 'https://duolingo.com',
    check: async (email) => {
      const res = await fetch(`https://www.duolingo.com/2017-06-30/users?email=${encodeURIComponent(email)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const data = await res.json();
        return data.users?.length > 0;
      }
      return null;
    }
  },
  {
    name: 'PayPal',
    url: 'https://paypal.com',
    check: async (email) => {
      // PayPal has strong security
      return null;
    }
  },
  {
    name: 'Airbnb',
    url: 'https://airbnb.com',
    check: async (email) => {
      const res = await fetch('https://www.airbnb.com/api/v2/passwords/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ email })
      });
      return res.ok;
    }
  },
  {
    name: 'Uber',
    url: 'https://uber.com',
    check: async (email) => {
      // Uber has strong anti-bot
      return null;
    }
  },
];

/**
 * Check which sites an email is registered on
 */
export async function checkEmailSites(email: string): Promise<SiteCheckResult[]> {
  const results: SiteCheckResult[] = [];

  // Run checks in parallel with timeout
  const promises = SITES.map(async (site) => {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const checkPromise = safeCheck(() => site.check(email));

    const exists = await Promise.race([checkPromise, timeoutPromise]);

    if (exists !== null) {
      results.push({
        name: site.name,
        url: site.url,
        exists,
      });
    }
  });

  await Promise.all(promises);

  // Sort: found accounts first
  return results.sort((a, b) => (b.exists ? 1 : 0) - (a.exists ? 1 : 0));
}

/**
 * Quick check of most reliable sites only
 */
export async function quickEmailCheck(email: string): Promise<SiteCheckResult[]> {
  const quickSites = ['GitHub', 'Gravatar', 'Discord', 'Spotify', 'Duolingo', 'Adobe'];
  const results: SiteCheckResult[] = [];

  const sites = SITES.filter(s => quickSites.includes(s.name));

  await Promise.all(sites.map(async (site) => {
    const exists = await safeCheck(() => site.check(email));
    if (exists !== null) {
      results.push({ name: site.name, url: site.url, exists });
    }
  }));

  return results;
}
