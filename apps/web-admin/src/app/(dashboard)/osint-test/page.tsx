'use client';

import { useState } from 'react';

export default function OSINTTestPage() {
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<'email' | 'phone' | 'sanctions' | 'watchlist'>('phone');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const response = await fetch('/api/osint/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: testType, input: input.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (check: { success?: boolean; matchCount?: number; error?: string }) => {
    if (check.error) {
      return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Error</span>;
    }
    if (check.success === false) {
      return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">Failed</span>;
    }
    if (check.matchCount && check.matchCount > 0) {
      return <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">{check.matchCount} matches</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">OK</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSINT API Test</h1>
        <p className="text-gray-500 dark:text-gray-400">Test all configured OSINT verification APIs</p>
      </div>

      {/* Test Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { id: 'email', label: 'Email', icon: 'mail', placeholder: 'test@gmail.com' },
            { id: 'phone', label: 'Phone', icon: 'phone', placeholder: '+221771234567' },
            { id: 'sanctions', label: 'Sanctions', icon: 'gavel', placeholder: 'Full Name' },
            { id: 'watchlist', label: 'Watchlist', icon: 'search', placeholder: 'Full Name' },
          ] as const).map((type) => (
            <button
              key={type.id}
              onClick={() => { setTestType(type.id); setInput(''); setResults(null); }}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                testType === type.id
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
            onKeyDown={(e) => e.key === 'Enter' && runTest()}
            placeholder={
              testType === 'email' ? 'Enter email address...' :
              testType === 'phone' ? 'Enter phone number (+221...)' :
              'Enter full name...'
            }
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={runTest}
            disabled={loading || !input.trim()}
            className="px-8 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Run Test
              </>
            )}
          </button>
        </div>

        {/* Quick Examples */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-500">Quick test:</span>
          {testType === 'email' && (
            <>
              <button onClick={() => setInput('test@gmail.com')} className="text-sm text-primary hover:underline">test@gmail.com</button>
              <button onClick={() => setInput('info@government.gov')} className="text-sm text-primary hover:underline">info@government.gov</button>
            </>
          )}
          {testType === 'phone' && (
            <>
              <button onClick={() => setInput('+221771234567')} className="text-sm text-primary hover:underline">+221771234567</button>
              <button onClick={() => setInput('+33612345678')} className="text-sm text-primary hover:underline">+33612345678</button>
            </>
          )}
          {testType === 'sanctions' && (
            <>
              <button onClick={() => setInput('John Smith')} className="text-sm text-primary hover:underline">John Smith</button>
            </>
          )}
          {testType === 'watchlist' && (
            <>
              <button onClick={() => setInput('John Doe')} className="text-sm text-primary hover:underline">John Doe</button>
            </>
          )}
        </div>
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
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">checklist</span>
                Results Summary
              </h2>
              <span className="text-sm text-gray-500">{results.timestamp as string}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(results.checks as Record<string, Record<string, unknown>>).map(([name, check]) => (
                <div
                  key={name}
                  className={`p-4 rounded-lg border ${
                    check.error ? 'border-red-200 bg-red-50 dark:bg-red-900/10' :
                    check.matchCount && (check.matchCount as number) > 0 ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10' :
                    'border-green-200 bg-green-50 dark:bg-green-900/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {name.replace(/_/g, ' ')}
                    </span>
                    {getStatusBadge(check)}
                  </div>
                  {check.error ? (
                    <p className="text-xs text-red-600 truncate">{check.error as string}</p>
                  ) : null}
                  {check.matchCount !== undefined ? (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {check.matchCount as number} result(s)
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500">code</span>
              Full API Response
            </h2>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* API Status Info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">APIs Being Tested</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Email Tests:</h3>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Hunter.io - Email verification</li>
              <li>• EmailRep.io - Reputation score</li>
              <li>• Have I Been Pwned - Breach check</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Tests:</h3>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Local - Senegal operator detection</li>
              <li>• Numverify - International validation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Sanctions Tests:</h3>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• OpenSanctions - Aggregated</li>
              <li>• OFAC SDN - US Treasury</li>
              <li>• UN Sanctions - Security Council</li>
              <li>• EU FSF - European Union</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Watchlist Tests:</h3>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• INTERPOL - Red Notices</li>
              <li>• FBI - Most Wanted</li>
              <li>• Europol - EU Most Wanted</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
