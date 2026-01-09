'use client';

import { useState, useRef } from 'react';

interface ExtractedDocument {
  documentType: 'passport' | 'cni' | 'other';
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
  documentExpiry: string;
  gender: 'M' | 'F' | '';
  placeOfBirth: string;
  mrz?: string;
  rawText: string;
  confidence: number;
}

interface VerificationResult {
  input: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    documentType: 'passport' | 'cni' | 'other';
    documentNumber: string;
    documentExpiry?: string;
    gender?: 'M' | 'F';
    placeOfBirth?: string;
    phone: string;
    email?: string;
  };
  timestamp: string;
  identity: {
    documentValid: boolean;
    documentIssues: string[];
    nameFromPhone?: string;
    nameMatch: boolean;
    nameMatchScore: number;
    photoUrl?: string;
  };
  contact: {
    phoneValid: boolean;
    phoneCarrier?: string;
    phoneCountry?: string;
    phoneType?: string;
    emailsFound: string[];
    emailVerified: boolean;
  };
  digitalFootprint: {
    accountsFound: Array<{ name: string; url: string; type: string }>;
    breaches: Array<{ name: string; date: string; severity: string }>;
    totalAccounts: number;
    totalBreaches: number;
  };
  securityChecks: {
    sanctions: Array<{ list: string; matchName: string; score: number }>;
    watchlists: Array<{ source: string; name: string; details?: string }>;
    interpol: boolean;
    pep: boolean;
  };
  risk: {
    score: number;
    level: 'clear' | 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendations: string[];
  };
  summary: {
    identityVerified: boolean;
    contactVerified: boolean;
    securityCleared: boolean;
    overallStatus: 'approved' | 'review' | 'flagged' | 'rejected';
  };
  sources: string[];
  processingTime: number;
}

const COUNTRIES = [
  { code: 'SN', name: 'Senegal' },
  { code: 'FR', name: 'France' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'MA', name: 'Morocco' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'ML', name: 'Mali' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GM', name: 'Gambia' },
  { code: 'MR', name: 'Mauritania' },
];

export default function VerifyTravelerPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ExtractedDocument | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: 'SN',
    documentType: 'passport' as 'passport' | 'cni' | 'other',
    documentNumber: '',
    documentExpiry: '',
    gender: '' as 'M' | 'F' | '',
    placeOfBirth: '',
    phone: '',
    email: '',
  });

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDocumentPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Send to OCR API
    setScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/osint/document-ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `OCR failed: ${response.status}`);
      }

      const data = await response.json();
      const extracted: ExtractedDocument = data.extracted;
      setScanResult(extracted);

      // Auto-fill form with extracted data
      setForm((prev) => ({
        ...prev,
        firstName: extracted.firstName || prev.firstName,
        lastName: extracted.lastName || prev.lastName,
        dateOfBirth: extracted.dateOfBirth || prev.dateOfBirth,
        nationality: extracted.nationality || prev.nationality,
        documentType: extracted.documentType || prev.documentType,
        documentNumber: extracted.documentNumber || prev.documentNumber,
        documentExpiry: extracted.documentExpiry || prev.documentExpiry,
        gender: extracted.gender || prev.gender,
        placeOfBirth: extracted.placeOfBirth || prev.placeOfBirth,
      }));
    } catch (err) {
      setError(`Document scan failed: ${err}`);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.phone || !form.documentNumber) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/osint/verify-traveler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gender: form.gender || undefined,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'review': return 'bg-yellow-500';
      case 'flagged': return 'bg-orange-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'clear': return 'bg-green-500';
      case 'low': return 'bg-blue-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      social: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      professional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      shopping: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      finance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      entertainment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      gaming: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      productivity: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      travel: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Traveler Verification</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Complete identity verification from passport/CNI + phone number
        </p>
      </div>

      {/* Document Scanner */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Upload Area */}
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">document_scanner</span>
              Scan Document (Passport / CNI)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Upload a scanned image or photo of the passport/CNI to automatically extract information
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleDocumentUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="w-full py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-600 dark:text-gray-400">Scanning document...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-4xl text-gray-400">upload_file</span>
                  <span className="text-gray-600 dark:text-gray-400">Click to upload or drag & drop</span>
                  <span className="text-xs text-gray-400">Supports JPG, PNG, PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Preview & Results */}
          {(documentPreview || scanResult) && (
            <div className="flex-1 space-y-4">
              {/* Document Preview */}
              {documentPreview && (
                <div className="relative">
                  <img
                    src={documentPreview}
                    alt="Document preview"
                    className="w-full max-h-48 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                  {scanResult && (
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        scanResult.confidence >= 70
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : scanResult.confidence >= 40
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {scanResult.confidence}% confidence
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Data Summary */}
              {scanResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Data Extracted
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {scanResult.lastName && (
                      <div>
                        <span className="text-gray-500">Name:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{scanResult.firstName} {scanResult.lastName}</span>
                      </div>
                    )}
                    {scanResult.documentNumber && (
                      <div>
                        <span className="text-gray-500">Document:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{scanResult.documentNumber}</span>
                      </div>
                    )}
                    {scanResult.dateOfBirth && (
                      <div>
                        <span className="text-gray-500">DOB:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{scanResult.dateOfBirth}</span>
                      </div>
                    )}
                    {scanResult.nationality && (
                      <div>
                        <span className="text-gray-500">Nationality:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{scanResult.nationality}</span>
                      </div>
                    )}
                  </div>
                  {scanResult.mrz && (
                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                      <span className="text-xs text-gray-500">MRZ:</span>
                      <p className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{scanResult.mrz}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">badge</span>
          Document Information
          {scanResult && (
            <span className="text-xs font-normal text-green-600 dark:text-green-400 ml-2">
              (Auto-filled from scan)
            </span>
          )}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Alioune"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Mbengue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nationality
            </label>
            <select
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type *
            </label>
            <select
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value as 'passport' | 'cni' | 'other' })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="passport">Passport</option>
              <option value="cni">CNI (National ID)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Number *
            </label>
            <input
              type="text"
              value={form.documentNumber}
              onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="A12345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Expiry
            </label>
            <input
              type="date"
              value={form.documentExpiry}
              onChange={(e) => setForm({ ...form, documentExpiry: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as 'M' | 'F' | '' })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Place of Birth
            </label>
            <input
              type="text"
              value={form.placeOfBirth}
              onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Dakar"
            />
          </div>
        </div>

        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">phone</span>
          Contact Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="+221772292865"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="user@example.com"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">verified_user</span>
              Verify Traveler
            </>
          )}
        </button>
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
      {result && (
        <div className="space-y-6">
          {/* Status Summary Header */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex flex-wrap items-start gap-6">
              {/* Photo */}
              <div className="flex-shrink-0">
                {result.identity.photoUrl ? (
                  <img
                    src={result.identity.photoUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-gray-400">person</span>
                  </div>
                )}
              </div>

              {/* Traveler Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.input.firstName} {result.input.lastName}
                </h2>
                {result.identity.nameFromPhone && !result.identity.nameMatch && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    Phone registered to: {result.identity.nameFromPhone}
                    ({Math.round(result.identity.nameMatchScore * 100)}% match)
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">badge</span>
                    {result.input.documentType.toUpperCase()}: {result.input.documentNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">flag</span>
                    {COUNTRIES.find(c => c.code === result.input.nationality)?.name || result.input.nationality}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">phone</span>
                    {result.input.phone}
                  </span>
                  {result.contact.emailsFound[0] && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                      {result.contact.emailsFound[0]}
                    </span>
                  )}
                </div>

                {/* Verification Badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.summary.identityVerified
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {result.summary.identityVerified ? 'Identity Verified' : 'Identity Unverified'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.summary.contactVerified
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {result.summary.contactVerified ? 'Contact Verified' : 'Contact Unverified'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.summary.securityCleared
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {result.summary.securityCleared ? 'Security Cleared' : 'Security Flagged'}
                  </span>
                </div>
              </div>

              {/* Status & Risk */}
              <div className="flex-shrink-0 text-right space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Overall Status</div>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-bold uppercase ${getStatusColor(result.summary.overallStatus)}`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {result.summary.overallStatus === 'approved' ? 'check_circle' :
                       result.summary.overallStatus === 'review' ? 'pending' :
                       result.summary.overallStatus === 'flagged' ? 'flag' : 'cancel'}
                    </span>
                    {result.summary.overallStatus}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Risk Level</div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white ${getRiskColor(result.risk.level)}`}>
                    <span className="material-symbols-outlined text-[16px]">shield</span>
                    {result.risk.score}/100 - {result.risk.level.toUpperCase()}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Processed in {result.processingTime}ms
                </div>
              </div>
            </div>
          </div>

          {/* Security Alerts */}
          {(result.securityChecks.sanctions.length > 0 || result.securityChecks.watchlists.length > 0 || result.securityChecks.interpol) && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/30 p-6">
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                SECURITY ALERTS
              </h3>
              <div className="space-y-3">
                {result.securityChecks.interpol && (
                  <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-red-300">
                    <p className="font-bold text-red-700 flex items-center gap-2">
                      <span className="material-symbols-outlined">gpp_bad</span>
                      INTERPOL Red Notice Match
                    </p>
                  </div>
                )}
                {result.securityChecks.pep && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-400">
                    <p className="font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                      <span className="material-symbols-outlined">account_balance</span>
                      Politically Exposed Person (PEP)
                    </p>
                  </div>
                )}
                {result.securityChecks.sanctions.map((s, i) => (
                  <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="font-medium text-red-700">{s.matchName}</p>
                    <p className="text-sm text-red-600">Lists: {s.list}</p>
                    <p className="text-xs text-red-500">Match score: {Math.round(s.score * 100)}%</p>
                  </div>
                ))}
                {result.securityChecks.watchlists.map((w, i) => (
                  <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="font-medium text-red-700">{w.name}</p>
                    <p className="text-sm text-red-600">{w.source}</p>
                    {w.details && <p className="text-xs text-red-500">{w.details}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Issues */}
          {result.identity.documentIssues.length > 0 && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4">
              <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined">description</span>
                Document Issues
              </h3>
              <ul className="space-y-1">
                {result.identity.documentIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Phone Details */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">phone</span>
                Phone Verification
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Valid</span>
                  <span className={result.contact.phoneValid ? 'text-green-600' : 'text-red-600'}>
                    {result.contact.phoneValid ? 'Yes' : 'No'}
                  </span>
                </div>
                {result.contact.phoneCarrier && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Carrier</span>
                    <span className="text-gray-900 dark:text-white">{result.contact.phoneCarrier}</span>
                  </div>
                )}
                {result.contact.phoneCountry && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Country</span>
                    <span className="text-gray-900 dark:text-white">{result.contact.phoneCountry}</span>
                  </div>
                )}
                {result.contact.phoneType && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Type</span>
                    <span className="text-gray-900 dark:text-white capitalize">{result.contact.phoneType}</span>
                  </div>
                )}
                {result.identity.nameFromPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Registered Name</span>
                    <span className="text-gray-900 dark:text-white">{result.identity.nameFromPhone}</span>
                  </div>
                )}
                {result.contact.emailsFound.length > 0 && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 text-sm">Emails Found</span>
                    {result.contact.emailsFound.map((email, i) => (
                      <p key={i} className="text-gray-900 dark:text-white font-mono text-sm">{email}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Digital Footprint Summary */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">fingerprint</span>
                Digital Footprint
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-primary">{result.digitalFootprint.totalAccounts}</div>
                  <div className="text-xs text-gray-500">Accounts Found</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-red-500">{result.digitalFootprint.totalBreaches}</div>
                  <div className="text-xs text-gray-500">Data Breaches</div>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts Found */}
          {result.digitalFootprint.accountsFound.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">language</span>
                Accounts Found ({result.digitalFootprint.accountsFound.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.digitalFootprint.accountsFound.map((account, i) => (
                  <a
                    key={i}
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-full text-sm hover:opacity-80 transition-opacity ${getAccountTypeColor(account.type)}`}
                  >
                    {account.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Breaches */}
          {result.digitalFootprint.breaches.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">lock_open</span>
                Data Breaches ({result.digitalFootprint.breaches.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.digitalFootprint.breaches.map((breach, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-white/50 dark:bg-black/20">
                    <div>
                      <span className="font-medium text-red-700 dark:text-red-400">{breach.name}</span>
                      <span className="text-xs text-red-500 ml-2">{breach.date}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      breach.severity === 'high' ? 'bg-red-500 text-white' :
                      breach.severity === 'medium' ? 'bg-orange-500 text-white' :
                      'bg-yellow-500 text-black'
                    }`}>
                      {breach.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors & Recommendations */}
          {(result.risk.factors.length > 0 || result.risk.recommendations.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {result.risk.factors.length > 0 && (
                <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-6">
                  <h3 className="font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">warning</span>
                    Risk Factors
                  </h3>
                  <ul className="space-y-2">
                    {result.risk.factors.map((factor, i) => (
                      <li key={i} className="text-sm text-orange-700 dark:text-orange-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.risk.recommendations.length > 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">lightbulb</span>
                    Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {result.risk.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Data Sources */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Data Sources Used</h3>
            <div className="flex flex-wrap gap-2">
              {result.sources.map((source, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                  {source}
                </span>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              View Raw Verification Data
            </summary>
            <pre className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
