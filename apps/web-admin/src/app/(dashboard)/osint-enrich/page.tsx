'use client';

import { useState } from 'react';

interface EnrichedProfile {
  input: { type: string; value: string };
  timestamp: string;
  phones: Array<{ number: string; carrier?: string; type?: string; country?: string; valid?: boolean; source: string }>;
  emails: Array<{ email: string; valid?: boolean; disposable?: boolean; reputation?: number; breachCount?: number; source: string }>;
  socialProfiles: Array<{ platform: string; username?: string; url?: string; name?: string; photo?: string; source: string }>;
  names: string[];
  locations: string[];
  breaches: Array<{ name: string; date: string; dataTypes: string[] }>;
  sanctions: Array<{ list: string; name: string; score: number }>;
  watchlists: Array<{ source: string; name: string; details?: string }>;
  riskScore: number;
  riskFactors: string[];
}

export default function OSINTEnrichPage() {
  const [profile, setProfile] = useState<EnrichedProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState<'phone' | 'email' | 'name'>('phone');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runEnrichment = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setProfile(null);
    setError(null);

    try {
      const response = await fetch('/api/osint/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: inputType, input: input.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    if (score >= 40) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
    if (score >= 20) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-green-600 bg-green-100 dark:bg-green-900/30';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'HIGH RISK';
    if (score >= 40) return 'MEDIUM RISK';
    if (score >= 20) return 'LOW RISK';
    return 'CLEAR';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSINT Profile Enrichment</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Enter a phone, email, or name to discover connected information across multiple sources
        </p>
      </div>

      {/* Input Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { id: 'phone', label: 'Phone Number', icon: 'phone', placeholder: '+221771234567' },
            { id: 'email', label: 'Email Address', icon: 'mail', placeholder: 'user@example.com' },
            { id: 'name', label: 'Full Name', icon: 'person', placeholder: 'John Smith' },
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
            onKeyDown={(e) => e.key === 'Enter' && runEnrichment()}
            placeholder={
              inputType === 'phone' ? 'Enter phone number (+221...)' :
              inputType === 'email' ? 'Enter email address...' :
              'Enter full name...'
            }
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={runEnrichment}
            disabled={loading || !input.trim()}
            className="px-8 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enriching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">hub</span>
                Enrich Profile
              </span>
            )}
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          This will search across multiple databases and cross-reference discovered information
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <p className="text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </p>
        </div>
      )}

      {/* Results */}
      {profile && (
        <div className="space-y-6">
          {/* Risk Score Banner */}
          <div className={`rounded-xl p-6 ${getRiskColor(profile.riskScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{getRiskLabel(profile.riskScore)}</h2>
                <p className="opacity-80">Risk Score: {profile.riskScore}/100</p>
              </div>
              <div className="text-6xl font-bold opacity-20">
                {profile.riskScore}
              </div>
            </div>
            {profile.riskFactors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-current/20">
                <p className="font-medium mb-2">Risk Factors:</p>
                <ul className="space-y-1">
                  {profile.riskFactors.map((factor, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Discovered Profile Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Names */}
            {profile.names.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  Names Found
                </h3>
                <ul className="space-y-2">
                  {[...new Set(profile.names)].map((name, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">{name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Phones */}
            {profile.phones.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">phone</span>
                  Phone Numbers
                </h3>
                <ul className="space-y-3">
                  {profile.phones.map((phone, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium text-gray-900 dark:text-white">{phone.number}</p>
                      {phone.carrier && <p className="text-gray-500">Carrier: {phone.carrier}</p>}
                      {phone.type && <p className="text-gray-500">Type: {phone.type}</p>}
                      {phone.country && <p className="text-gray-500">Country: {phone.country}</p>}
                      <p className="text-xs text-gray-400">Source: {phone.source}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Emails */}
            {profile.emails.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">mail</span>
                  Email Addresses
                </h3>
                <ul className="space-y-3">
                  {profile.emails.map((email, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium text-gray-900 dark:text-white">{email.email}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {email.valid !== undefined && (
                          <span className={`px-2 py-0.5 rounded text-xs ${email.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {email.valid ? 'Valid' : 'Invalid'}
                          </span>
                        )}
                        {email.disposable && (
                          <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Disposable</span>
                        )}
                        {email.breachCount !== undefined && email.breachCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                            {email.breachCount} breach(es)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Source: {email.source}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Social Profiles */}
            {profile.socialProfiles.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">share</span>
                  Social Profiles
                </h3>
                <ul className="space-y-2">
                  {profile.socialProfiles.map((social, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                        {social.platform}
                      </span>
                      {social.username && (
                        <span className="text-gray-500">@{social.username}</span>
                      )}
                      {social.url && (
                        <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Locations */}
            {profile.locations.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  Locations
                </h3>
                <ul className="space-y-1">
                  {[...new Set(profile.locations)].map((loc, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">{loc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Breaches */}
            {profile.breaches.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined">lock_open</span>
                  Data Breaches
                </h3>
                <ul className="space-y-2">
                  {profile.breaches.slice(0, 5).map((breach, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium text-red-700 dark:text-red-400">{breach.name}</p>
                      <p className="text-red-600/70 dark:text-red-400/70 text-xs">
                        {breach.date} - {breach.dataTypes.slice(0, 3).join(', ')}
                      </p>
                    </li>
                  ))}
                  {profile.breaches.length > 5 && (
                    <li className="text-xs text-red-600/70">+{profile.breaches.length - 5} more breaches</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Sanctions & Watchlists */}
          {(profile.sanctions.length > 0 || profile.watchlists.length > 0) && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/30 p-6">
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">gpp_bad</span>
                CRITICAL ALERTS
              </h3>

              {profile.sanctions.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-red-600 mb-2">Sanctions Matches:</h4>
                  <ul className="space-y-2">
                    {profile.sanctions.map((s, i) => (
                      <li key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <p className="font-medium text-red-700 dark:text-red-400">{s.name}</p>
                        <p className="text-sm text-red-600/70">List: {s.list}</p>
                        <p className="text-sm text-red-600/70">Match Score: {(s.score * 100).toFixed(0)}%</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.watchlists.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">Watchlist Matches:</h4>
                  <ul className="space-y-2">
                    {profile.watchlists.map((w, i) => (
                      <li key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <p className="font-medium text-red-700 dark:text-red-400">{w.name}</p>
                        <p className="text-sm text-red-600/70">Source: {w.source}</p>
                        {w.details && <p className="text-sm text-red-600/70">{w.details}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              View Raw Response
            </summary>
            <pre className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* API Status */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Configuration Status</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phone → Name/Email Setup */}
          <div className="p-4 rounded-lg border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">settings</span>
              Phone → Name/Email Lookup (Setup Required)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">Truecaller (Recommended - FREE)</p>
                <p className="text-gray-600 dark:text-gray-400 mb-2">Run this command in terminal:</p>
                <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono">
                  node scripts/truecaller-setup.mjs
                </code>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-xs">
                  Requires a phone with Truecaller app installed to receive OTP
                </p>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                <p>Alternatives (paid):</p>
                <ul className="mt-1 space-y-1">
                  <li>• <strong>Pipl</strong> - <a href="https://pipl.com/api" target="_blank" className="text-yellow-600 underline">$99/mo</a></li>
                  <li>• <strong>FullContact</strong> - <a href="https://www.fullcontact.com/developer-portal/" target="_blank" className="text-yellow-600 underline">Contact sales</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Currently Working */}
          <div className="p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
            <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">check_circle</span>
              Currently Active
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>Hunter.io</strong> - Email validation
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>HIBP</strong> - Data breach check
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>Numverify</strong> - Phone validation
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>OpenSanctions</strong> - Sanctions screening
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>INTERPOL</strong> - Red Notices
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>FBI</strong> - Most Wanted
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Quick Setup:</strong> Run <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">node scripts/truecaller-setup.mjs</code> in terminal,
            enter your phone number (with Truecaller app), receive OTP, and add the installation ID to <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">.env.local</code>
          </p>
        </div>
      </div>
    </div>
  );
}
