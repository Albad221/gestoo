'use client';

import { useState } from 'react';

interface FullProfile {
  input: { type: string; value: string };
  timestamp: string;
  names: string[];
  photos: Array<{ url: string; source: string }>;
  phones: Array<{ number: string; type?: string; carrier?: string; country?: string; verified?: boolean; source: string }>;
  emails: Array<{ email: string; verified?: boolean; disposable?: boolean; breachCount?: number; source: string }>;
  addresses: Array<{ formatted: string; city?: string; country?: string; source: string }>;
  socialProfiles: Array<{ platform: string; url?: string; username?: string; name?: string; bio?: string; followers?: number; photo?: string; source: string }>;
  websites: string[];
  usernames: string[];
  breaches: Array<{ name: string; date: string; dataTypes: string[] }>;
  registeredSites: Array<{ name: string; url: string; exists: boolean }>;
  sanctions: Array<{ list: string; name: string; score: number }>;
  watchlists: Array<{ source: string; name: string; details?: string }>;
  riskScore: number;
  riskFactors: string[];
  sources: string[];
  confidence: number;
}

export default function OSINTProfilePage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState<'phone' | 'email' | 'name'>('phone');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const buildProfile = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setProfile(null);
    setError(null);

    try {
      const response = await fetch('/api/osint/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: inputType, input: input.trim() }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-orange-500';
    if (score >= 20) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const platformIcons: Record<string, string> = {
    github: 'code',
    linkedin: 'work',
    twitter: 'tag',
    instagram: 'photo_camera',
    facebook: 'people',
    discord: 'headphones',
    spotify: 'music_note',
    steam: 'sports_esports',
    tiktok: 'movie',
    pinterest: 'push_pin',
    medium: 'article',
    gravatar: 'account_circle',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSINT Full Profile Builder</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Build a complete profile from a single data point - discovers connections across 30+ platforms
        </p>
      </div>

      {/* Input Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { id: 'phone', label: 'Phone Number', icon: 'phone' },
            { id: 'email', label: 'Email Address', icon: 'mail' },
            { id: 'name', label: 'Full Name', icon: 'person' },
          ] as const).map((type) => (
            <button
              key={type.id}
              onClick={() => { setInputType(type.id); setInput(''); setProfile(null); }}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                inputType === type.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buildProfile()}
            placeholder={
              inputType === 'phone' ? '+221772292865' :
              inputType === 'email' ? 'user@example.com' :
              'John Doe'
            }
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={buildProfile}
            disabled={loading || !input.trim()}
            className="px-8 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Building Profile...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">person_search</span>
                Build Profile
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Profile Results */}
      {profile && (
        <div className="space-y-6">
          {/* Header Card with Photo & Summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex items-start gap-6">
              {/* Photo */}
              <div className="flex-shrink-0">
                {profile.photos.length > 0 ? (
                  <img
                    src={profile.photos[0].url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-gray-400">person</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile.names[0] || 'Unknown'}
                </h2>
                {profile.names.length > 1 && (
                  <p className="text-sm text-gray-500">Also known as: {profile.names.slice(1).join(', ')}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {profile.emails[0] && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                      {profile.emails[0].email}
                    </span>
                  )}
                  {profile.phones[0] && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">phone</span>
                      {profile.phones[0].number}
                    </span>
                  )}
                  {profile.addresses[0] && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">location_on</span>
                      {typeof profile.addresses[0].formatted === 'string'
                        ? profile.addresses[0].formatted
                        : (profile.addresses[0].country || profile.addresses[0].city || 'Location found')}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-4 flex gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{profile.socialProfiles.length}</div>
                    <div className="text-xs text-gray-500">Social Profiles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{profile.registeredSites.filter(s => s.exists).length}</div>
                    <div className="text-xs text-gray-500">Accounts Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{profile.breaches.length}</div>
                    <div className="text-xs text-gray-500">Data Breaches</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{profile.sources.length}</div>
                    <div className="text-xs text-gray-500">Data Sources</div>
                  </div>
                </div>
              </div>

              {/* Risk & Confidence */}
              <div className="flex-shrink-0 text-right">
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">Risk Score</div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white ${getRiskColor(profile.riskScore)}`}>
                    <span className="material-symbols-outlined text-[16px]">shield</span>
                    {profile.riskScore}/100
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Confidence</div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500 text-white">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    {profile.confidence}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Alerts */}
          {(profile.sanctions.length > 0 || profile.watchlists.length > 0) && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/30 p-6">
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                CRITICAL ALERTS
              </h3>
              <div className="space-y-2">
                {profile.sanctions.map((s, i) => (
                  <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="font-medium text-red-700">{s.name}</p>
                    <p className="text-sm text-red-600">Sanctions list: {s.list}</p>
                  </div>
                ))}
                {profile.watchlists.map((w, i) => (
                  <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="font-medium text-red-700">{w.name}</p>
                    <p className="text-sm text-red-600">{w.source}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Social Profiles */}
            {profile.socialProfiles.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">share</span>
                  Social Profiles ({profile.socialProfiles.length})
                </h3>
                <div className="space-y-3">
                  {profile.socialProfiles.map((social, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">
                          {platformIcons[social.platform.toLowerCase()] || 'language'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white capitalize">{social.platform}</p>
                        {social.username && <p className="text-sm text-gray-500">@{social.username}</p>}
                        {social.bio && <p className="text-xs text-gray-400 truncate">{social.bio}</p>}
                      </div>
                      {social.url && (
                        <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <span className="material-symbols-outlined">open_in_new</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Sites */}
            {profile.registeredSites.filter(s => s.exists).length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">language</span>
                  Accounts Found ({profile.registeredSites.filter(s => s.exists).length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.registeredSites.filter(s => s.exists).map((site, i) => (
                    <a
                      key={i}
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      {site.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Data Breaches */}
            {profile.breaches.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">lock_open</span>
                  Data Breaches ({profile.breaches.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {profile.breaches.map((breach, i) => (
                    <div key={i} className="p-2 rounded bg-white/50 dark:bg-black/20">
                      <div className="flex justify-between">
                        <span className="font-medium text-red-700 dark:text-red-400">{breach.name}</span>
                        <span className="text-xs text-red-500">{breach.date}</span>
                      </div>
                      <p className="text-xs text-red-600/70 truncate">
                        {breach.dataTypes.slice(0, 4).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">contacts</span>
                Contact Information
              </h3>
              <div className="space-y-4">
                {profile.emails.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Emails</p>
                    {profile.emails.map((email, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-900 dark:text-white">{email.email}</span>
                        {email.breachCount && email.breachCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">
                            {email.breachCount} breaches
                          </span>
                        )}
                        {email.disposable && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                            disposable
                          </span>
                        )}
                        <span className="text-xs text-gray-400">({email.source})</span>
                      </div>
                    ))}
                  </div>
                )}
                {profile.phones.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Phones</p>
                    {profile.phones.map((phone, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-gray-900 dark:text-white">{phone.number}</span>
                        {phone.carrier && <span className="text-gray-500 ml-2">({phone.carrier})</span>}
                      </div>
                    ))}
                  </div>
                )}
                {profile.addresses.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Addresses</p>
                    {profile.addresses.map((addr, i) => (
                      <p key={i} className="text-sm text-gray-900 dark:text-white">
                        {typeof addr.formatted === 'string' ? addr.formatted : JSON.stringify(addr.formatted)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          {profile.riskFactors.length > 0 && (
            <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-6">
              <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined">info</span>
                Risk Factors
              </h3>
              <ul className="space-y-1">
                {profile.riskFactors.map((factor, i) => (
                  <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Sources */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Data Sources Used</h3>
            <div className="flex flex-wrap gap-2">
              {profile.sources.map((source, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                  {source}
                </span>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              View Raw Profile Data
            </summary>
            <pre className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
