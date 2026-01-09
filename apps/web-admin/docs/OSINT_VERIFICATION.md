# Teranga Safe - OSINT Verification System

## Overview

The Teranga Safe platform includes a comprehensive traveler verification system using Open Source Intelligence (OSINT) techniques. This document describes the implemented verification checks and the roadmap for future government integrations.

---

## Currently Implemented (Public APIs)

These verification services are **fully implemented** and available through public APIs:

### Email Verification

| Service | Purpose | Cost | Implementation |
|---------|---------|------|----------------|
| **Hunter.io** | Email deliverability & validation | Free: 25/month, Paid: $49+ | `email-service.ts` |
| **EmailRep.io** | Email reputation scoring | Free: 5000/day | `email-service.ts` |
| **Have I Been Pwned** | Data breach history | $3.50/month | `email-service.ts` |
| **FullContact** | Social profile enrichment | Free: 100/month | `email-service.ts` |

**Checks performed:**
- Email format validity
- Mailbox deliverability
- Domain MX records
- Disposable email detection
- Reputation score (spam, malicious activity)
- Data breach exposure
- Linked social profiles (LinkedIn, Twitter, Facebook)

### Phone Verification

| Service | Purpose | Cost | Implementation |
|---------|---------|------|----------------|
| **Numverify** | Phone validation & carrier | Free: 100/month, Paid: $15+ | `phone-service.ts` |
| **Twilio Lookup** | Carrier & line type | ~$0.005/lookup | `phone-service.ts` |
| **Truecaller** | Caller ID & spam detection | Business partnership | `phone-service.ts` |
| **libphonenumber** | Local format validation | Free (local) | `phone-service.ts` |

**Checks performed:**
- Phone number format validity
- Country code verification
- Carrier identification
- Line type (mobile/landline/VoIP)
- Spam/scam flagging (Truecaller)
- Senegalese operator detection (Orange, Free, Expresso)

### Sanctions Screening

| Service | Purpose | Cost | Implementation |
|---------|---------|------|----------------|
| **OpenSanctions** | Aggregated global sanctions | Free: 1000/month, Paid: $500+ | `sanctions-service.ts` |
| **OFAC SDN** | US Treasury sanctions | Free (public data) | `sanctions-service.ts` |
| **UN Sanctions** | UN Security Council | Free (public data) | `sanctions-service.ts` |
| **EU Consolidated** | EU sanctions list | Free (public data) | `sanctions-service.ts` |

**Checks performed:**
- Name matching against 100+ sanctions lists
- Fuzzy matching with confidence scores
- Entity type identification
- Sanctions program details
- Date of birth correlation

### Public Watchlists

| Service | Purpose | Cost | Implementation |
|---------|---------|------|----------------|
| **INTERPOL Red Notices** | Wanted persons (public) | Free | `watchlist-service.ts` |
| **FBI Most Wanted** | US wanted list | Free | `watchlist-service.ts` |
| **Europol Most Wanted** | EU wanted list | Free | `watchlist-service.ts` |

**Checks performed:**
- Name matching against public notices
- Nationality correlation
- Age/DOB verification
- Charges/warrants information

### Document Validation

| Service | Purpose | Cost | Implementation |
|---------|---------|------|----------------|
| **MRZ Validator** | Passport MRZ parsing | Free (local) | `document-service.ts` |
| **ICAO Doc 9303** | Check digit validation | Free (local) | `document-service.ts` |
| **Format Validator** | Country-specific patterns | Free (local) | `document-service.ts` |

**Checks performed:**
- MRZ check digit verification
- Document number format validation
- Senegalese CNI format validation
- Passport expiration detection

---

## Future Integrations (Government Access Required)

The following integrations require official government credentials and partnership agreements:

### Phase 1: Ministry of Interior

| System | Purpose | Requirements |
|--------|---------|--------------|
| **INTERPOL I-24/7** | Full notices database | Police Nationale credentials |
| **INTERPOL SLTD** | Stolen/Lost Travel Documents | Police Nationale credentials |
| **Police Nationale DB** | National wanted list | Ministry agreement |

**Target:** Q2 2026

### Phase 2: Immigration (DGEF)

| System | Purpose | Requirements |
|--------|---------|--------------|
| **Entry/Exit Records** | Border crossing history | DGEF API access |
| **Visa Database** | Visa status verification | DGEF API access |
| **Overstay Detection** | Immigration violations | DGEF API access |

**Target:** Q3 2026

### Phase 3: Civil Registry

| System | Purpose | Requirements |
|--------|---------|--------------|
| **Direction État Civil** | CNI verification | Ministry agreement |
| **Biometric Database** | Fingerprint/photo match | High security clearance |
| **Birth Registry** | Identity confirmation | Civil registry access |

**Target:** Q4 2026

### Phase 4: Regional Integration

| System | Purpose | Requirements |
|--------|---------|--------------|
| **CEDEAO/ECOWAS** | Regional travel documents | ECOWAS membership |
| **WAPIS** | West African Police Info System | INTERPOL regional |
| **AFIS** | African Fingerprint System | AU partnership |

**Target:** 2027

---

## API Configuration

### Required Environment Variables

```bash
# Email Services
NEXT_PUBLIC_HUNTER_API_KEY=xxx
NEXT_PUBLIC_EMAILREP_API_KEY=xxx
NEXT_PUBLIC_HIBP_API_KEY=xxx
NEXT_PUBLIC_FULLCONTACT_API_KEY=xxx

# Phone Services
NEXT_PUBLIC_NUMVERIFY_API_KEY=xxx
NEXT_PUBLIC_TWILIO_ACCOUNT_SID=xxx
NEXT_PUBLIC_TWILIO_AUTH_TOKEN=xxx
NEXT_PUBLIC_TRUECALLER_API_KEY=xxx

# Sanctions (Recommended)
NEXT_PUBLIC_OPENSANCTIONS_API_KEY=xxx
```

### Estimated Monthly Costs

| Tier | Verifications/month | Est. Cost |
|------|---------------------|-----------|
| **Basic** | ~500 | Free |
| **Standard** | ~5,000 | ~$150/month |
| **Enterprise** | ~50,000 | ~$1,000/month |

---

## Usage

### Run Complete Verification

```typescript
import { runComprehensiveOSINT } from '@/lib/osint';

const result = await runComprehensiveOSINT({
  firstName: 'John',
  lastName: 'Doe',
  nationality: 'US',
  dateOfBirth: '1985-03-15',
  email: 'john.doe@example.com',
  phone: '+12025551234',
  documentType: 'passport',
  documentNumber: 'AB1234567',
});

console.log(result.summary);
// {
//   totalChecks: 15,
//   passedChecks: 14,
//   warningChecks: 1,
//   failedChecks: 0,
//   score: 92,
//   riskLevel: 'low',
//   alerts: ['Email found in 2 data breaches']
// }
```

### Individual Checks

```typescript
// Email only
import { runAllEmailChecks } from '@/lib/osint';
const emailResults = await runAllEmailChecks('user@example.com');

// Phone only
import { runAllPhoneChecks } from '@/lib/osint';
const phoneResults = await runAllPhoneChecks('+221771234567');

// Sanctions only
import { runAllSanctionsChecks } from '@/lib/osint';
const sanctionsResults = await runAllSanctionsChecks('John Doe', '1985-03-15', 'US');

// Watchlists only
import { runAllWatchlistChecks } from '@/lib/osint';
const watchlistResults = await runAllWatchlistChecks('John Doe', 'US', '1985-03-15');

// Document validation (local, no API)
import { validatePassportMRZ } from '@/lib/osint';
const mrzResult = validatePassportMRZ(mrzString);
```

---

## Security Considerations

1. **API Keys**: Never expose API keys in client-side code. Use server-side API routes.
2. **Rate Limiting**: Implement caching to avoid exceeding API limits.
3. **Data Retention**: OSINT results should follow data protection regulations.
4. **Audit Logging**: All verification requests should be logged for compliance.
5. **False Positives**: Sanctions matches require human review before action.

---

## Contact

For government API access requests, contact:
- Ministry of Interior: [to be determined]
- DGEF Immigration: [to be determined]
- Police Nationale: [to be determined]

---

*Last updated: January 2026*
