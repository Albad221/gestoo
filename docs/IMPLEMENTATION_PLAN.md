# Gestoo Platform Simplification - Implementation Plan

## Executive Summary

This plan reorganizes Gestoo from **3 disconnected silos** into **2 unified experiences** with a single intelligence backend.

---

## Current vs. Target Architecture

### Current State (Problematic)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  LANDLORD   │  │   POLICE    │  │ INTELLIGENCE│
│    SILO     │  │    SILO     │  │    SILO     │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ WhatsApp    │  │ web-admin   │  │ scraper-svc │
│ web-landlord│  │ OSINT APIs  │  │ intel-svc   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────── NO COMMUNICATION ─────────┘
```

### Target State (Simplified)
```
┌─────────────────────────────────────────────────┐
│              UNIFIED BACKEND                     │
│         intelligence-service (NEW)              │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │ Enrichment│ Scraping │ Analytics│  Risk    │ │
│  │  (OSINT)  │ (market) │ (stats)  │ (scoring)│ │
│  └──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   LANDLORD    │           │  GOVERNMENT   │
│  EXPERIENCE   │           │  EXPERIENCE   │
├───────────────┤           ├───────────────┤
│ • WhatsApp bot│           │ • Dashboard   │
│ • Web portal  │           │ • Alerts      │
│ • Check-in    │           │ • Investigation│
│ • Payments    │           │ • Reports     │
│ • Compliance  │           │ • Map         │
└───────────────┘           └───────────────┘
```

---

## Phase 1: Fix Critical Issues (Week 1-2)

### 1.1 Enable Real-Time Guest Verification

**Goal**: Verify guests against watchlists DURING check-in, not after.

**Changes**:

```
services/chatbot-service/src/flows/guest-checkin.ts
```

Add verification step after document scan:

```typescript
// After extracting guest data from document
const verificationResult = await verifyGuest({
  firstName: guestData.firstName,
  lastName: guestData.lastName,
  nationality: guestData.nationality,
  documentNumber: guestData.documentNumber,
  dateOfBirth: guestData.dateOfBirth,
});

if (verificationResult.riskLevel === 'HIGH') {
  await sendMessage(phone, `⚠️ ATTENTION: Vérification requise pour ce client.`);
  await createAlert({
    type: 'high_risk_guest',
    severity: 'high',
    guestData,
    verificationResult,
  });
  // Continue but flag the stay
}
```

**New endpoint needed**:
```
POST /api/verify-guest
- Check against internal watchlist (guests table)
- Check against OpenSanctions API
- Return risk score
```

### 1.2 Add Environment Variables to Railway

**chatbot-service** needs:
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
WATI_API_URL=https://live-mt-server.wati.io/384776
WATI_API_TOKEN=
```

**web-admin** needs:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 1.3 Fix WATI Message Sending

Current issue: Messages received but no reply sent.

**Debug steps**:
1. Add logging after WATI API calls
2. Check for errors in Railway logs
3. Verify Supabase connection works

---

## Phase 2: Consolidate Intelligence (Week 3-4)

### 2.1 Merge OSINT into Intelligence Service

**Move from** `apps/web-admin/src/app/api/osint/*`
**To** `services/intelligence-service/src/enrichment/`

**New structure**:
```
services/intelligence-service/
├── src/
│   ├── enrichment/           # NEW - moved from web-admin
│   │   ├── truecaller.ts
│   │   ├── fullcontact.ts
│   │   ├── opensanctions.ts
│   │   ├── interpol.ts
│   │   └── index.ts          # Unified enrichment API
│   ├── scraping/             # NEW - moved from scraper-service
│   │   ├── scrapers/
│   │   ├── matcher.ts
│   │   └── scheduler.ts
│   ├── analytics/            # Existing
│   ├── risk/                 # Existing
│   └── api/
│       ├── enrichment-routes.ts
│       ├── scraping-routes.ts
│       ├── analytics-routes.ts
│       └── risk-routes.ts
```

### 2.2 Create Unified API

**Single endpoint for all intelligence**:
```
POST /api/intelligence/enrich
POST /api/intelligence/verify
POST /api/intelligence/scrape
GET  /api/intelligence/analytics
GET  /api/intelligence/risk/:entityId
```

### 2.3 Update Web-Admin to Call Intelligence Service

Replace direct API calls with intelligence service calls:

```typescript
// Before (in web-admin)
const result = await fetch('/api/osint/enrich', { ... });

// After (calls intelligence service)
const result = await fetch(`${INTELLIGENCE_SERVICE_URL}/api/enrich`, { ... });
```

---

## Phase 3: Simplify Web-Admin (Week 5-6)

### 3.1 Consolidate Pages

**Remove/Merge**:
| Current | Action | New Location |
|---------|--------|--------------|
| `/etablissements` | Merge | `/properties` (add filter) |
| `/osint-test` | Remove | Dev tools only |
| `/osint-profile` | Merge | `/travelers/[id]` |
| `/osint-enrich` | Merge | `/travelers/[id]` |
| `/osint-verify-traveler` | Merge | `/travelers/[id]` |
| `/statistics` | Merge | `/dashboard` |
| `/revenue` | Merge | `/dashboard` |
| `/map` | Embed | `/dashboard` |

**Final structure**:
```
/auth/login
/dashboard          # Stats + Map + Quick Actions
/properties         # All properties (hotels + registered)
/travelers          # All guests + verification tools
/alerts             # Unified alert management
/intelligence       # Scraping + Reports
```

### 3.2 Add Traveler Detail Page

New page: `/travelers/[id]`

**Features**:
- Basic guest info
- Travel history (all stays)
- Verification status
- **One-click OSINT enrichment**
- Risk score
- Related alerts

### 3.3 Unified Alert Workflow

**Alert states**:
```
NEW → REVIEWING → INVESTIGATING → RESOLVED
                              ↘ ESCALATED
```

**Alert assignment**:
- Guest security → Police
- Tax issues → Tax Authority
- Compliance → Ministry
- Property issues → Ministry

---

## Phase 4: Enhance Landlord Experience (Week 7-8)

### 4.1 Add Web Check-in Option

Currently WhatsApp-only. Add web alternative:

**New page**: `/apps/web-landlord/src/app/(dashboard)/guests/checkin/page.tsx`

Same flow as WhatsApp but in web UI:
1. Select property
2. Upload/scan document
3. Enter guest details
4. **See verification result**
5. Confirm check-in
6. Pay TPT

### 4.2 Add Compliance Dashboard

**New page**: `/apps/web-landlord/src/app/(dashboard)/compliance/page.tsx`

Shows:
- Property registration status
- Matched listings from Airbnb/Booking
- Compliance score
- Required actions
- Alerts on their properties

### 4.3 Add Notifications

Notify landlords when:
- Property flagged for compliance
- Guest alert created
- Tax payment due
- Tax payment received

**Implementation**:
- WhatsApp notifications (via chatbot)
- Email notifications (new)

---

## Phase 5: Database Optimization (Week 9-10)

### 5.1 Add Missing Tables

```sql
-- Verification results storage
CREATE TABLE guest_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  verification_type TEXT, -- 'sanctions', 'watchlist', 'enrichment'
  result JSONB,
  risk_score INTEGER,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landlord notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES landlords(id),
  type TEXT, -- 'alert', 'payment', 'compliance'
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance tracking
CREATE TABLE property_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  status TEXT, -- 'compliant', 'warning', 'non_compliant'
  issues JSONB,
  last_checked TIMESTAMPTZ,
  next_check TIMESTAMPTZ
);
```

### 5.2 Add Indexes

```sql
-- Faster guest lookups
CREATE INDEX idx_guests_document ON guests(document_number);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);

-- Faster alert queries
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_property ON alerts(property_id);

-- Faster stays queries
CREATE INDEX idx_stays_active ON stays(status) WHERE status = 'active';
```

### 5.3 Add Audit Logging

```sql
-- Track all sensitive operations
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 6: Testing & Documentation (Week 11-12)

### 6.1 Add Tests

**Priority test coverage**:
1. Guest check-in flow (chatbot)
2. Guest verification API
3. Alert creation triggers
4. Payment webhook handling

### 6.2 Create Documentation

- Architecture diagram
- Data flow diagrams
- API documentation
- Deployment guide

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Guest verification rate | 0% (manual) | 100% (automatic) |
| Time to check-in | 5-10 min | 2 min |
| Landlord alert visibility | 0% | 100% |
| Code duplication | High | Low |
| Service count | 3 + scattered APIs | 2 |
| Pages in web-admin | 15+ | 5 |

---

## Quick Wins (Can Do Today)

1. ✅ Fix WATI webhook (done)
2. ⏳ Add Supabase env vars to Railway
3. ⏳ Test chatbot end-to-end
4. ⏳ Merge établissements into properties page
5. ⏳ Add verification to guest check-in flow

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OSINT API costs | Cache results, verify only flagged guests |
| Service downtime | Blue-green deployment, health checks |
| Data migration | Backward compatible changes, feature flags |
| User disruption | Gradual rollout, keep WhatsApp working |

---

## Next Steps

1. **Immediate**: Set up Supabase and environment variables
2. **This week**: Get chatbot fully working
3. **Next week**: Add guest verification to check-in flow
4. **Following weeks**: Consolidate services and simplify UI
