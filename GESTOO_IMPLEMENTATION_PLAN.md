# GESTOO - Implementation Plan (Supabase Edition)

## Context Summary
- **Team**: Small (2-5 developers)
- **Core Backend**: Supabase (Auth, DB, Storage, Real-time, Edge Functions)
- **Custom Services**: Node.js (WhatsApp), Python (Intelligence/ML)
- **WhatsApp**: BSP Partner (360dialog/Twilio)
- **Deployment**: Supabase Cloud + VPS for Python services
- **Timeline**: Quality-focused, no fixed deadline

---

## Project Structure (Monorepo)

```
gestoo/
├── apps/
│   ├── web-admin/              # Next.js - Police & Ministry Dashboard
│   ├── web-landlord/           # Next.js - Landlord Portal
│   ├── web-public/             # Next.js - Public verification
│   └── mobile-police/          # React Native - Police app
├── services/
│   ├── chatbot-service/        # Node.js - WhatsApp bot
│   ├── intelligence-service/   # Python - Scraping engine
│   ├── image-service/          # Python - Image recognition
│   └── llm-service/            # Python - Claude AI
├── supabase/
│   ├── migrations/             # Database migrations
│   ├── functions/              # Edge Functions (Deno)
│   │   ├── payment-webhook/    # Wave/OM webhooks
│   │   ├── police-alert/       # Alert triggers
│   │   ├── tpt-calculator/     # Tax calculations
│   │   └── ocr-process/        # Document processing trigger
│   └── seed.sql                # Initial data & test fixtures
├── packages/
│   ├── shared-types/           # TypeScript types
│   ├── supabase-client/        # Typed Supabase client
│   └── ui/                     # Shared UI components
├── docker/
│   └── docker-compose.yml      # Python services local dev
└── docs/
```

---

## Phase 0: Foundation (Weeks 1-2)

### 0.1 Repository Setup
- [ ] Initialize monorepo with pnpm workspaces
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Setup Husky pre-commit hooks
- [ ] Create shared packages

### 0.2 Supabase Project Setup
- [ ] Create Supabase project (Pro tier for production)
- [ ] Configure auth providers (Phone OTP)
- [ ] Setup storage buckets:
  - `id-documents` (private, authenticated)
  - `property-photos` (public with CDN)
  - `receipts` (private)
- [ ] Initialize local development with Supabase CLI

### 0.3 Database Schema
- [ ] Design and implement migrations
- [ ] Setup Row Level Security (RLS) policies
- [ ] Create database functions and triggers
- [ ] Seed development data

### 0.4 CI/CD Pipeline
- [ ] GitHub Actions for:
  - Type checking and linting
  - Supabase migrations deployment
  - Edge functions deployment
  - Apps deployment (Vercel)
- [ ] Environment configuration (dev, staging, prod)

**Deliverable**: Working monorepo with Supabase, auth, and local dev environment

---

## Phase 1: Property & Landlord Core (Weeks 3-6)

### 1.1 Database Tables (Supabase)
- [ ] `landlords` - Owner profiles linked to auth.users
- [ ] `properties` - All property types with license numbers
- [ ] `property_photos` - Images linked to storage
- [ ] `property_documents` - CNI, business registration
- [ ] Setup RLS: Landlords see only their data

### 1.2 Landlord Web Portal (Next.js + Supabase)
- [ ] Phone OTP authentication flow
- [ ] Property registration wizard:
  - Basic info (name, type, address)
  - GPS location capture
  - Photo upload (drag & drop)
  - Document upload (CNI)
- [ ] Dashboard with property cards
- [ ] Profile management

### 1.3 WhatsApp Chatbot Service (Node.js)
- [ ] 360dialog Cloud API integration
- [ ] Conversation state machine (Redis)
- [ ] Message templates (pre-approved)
- [ ] Core flows:
  - `ONBOARDING` - New landlord registration
  - `ADD_PROPERTY` - Register new property
  - `STATUS` - Check property/compliance status
- [ ] Supabase client for data operations
- [ ] Multi-language (French, Wolof, English)

### 1.4 Edge Functions
- [ ] `generate-license` - Create TRG-YYYY-XXXXX license
- [ ] `compliance-score` - Calculate property compliance

**Deliverable**: Landlords can register via web or WhatsApp

---

## Phase 2: Guest Registration & Tax (Weeks 7-11)

### 2.1 Database Tables
- [ ] `guests` - Guest identity information
- [ ] `stays` - Check-in/out records
- [ ] `tax_liabilities` - TPT calculations
- [ ] `payments` - Payment records
- [ ] `payment_webhooks` - Webhook logs
- [ ] RLS policies for guest data access

### 2.2 Guest Service (Supabase + Edge Functions)
- [ ] Guest check-in workflow
- [ ] Document OCR trigger (Edge Function → external API)
- [ ] Age calculation and minor detection
- [ ] Guardian verification
- [ ] Stay duration tracking
- [ ] Automatic check-out reminders

### 2.3 OCR Integration
- [ ] Edge Function: `process-document`
  - Receive image from storage trigger
  - Call Google Cloud Vision API
  - Parse MRZ (passports) / CNI format
  - Store extracted data
- [ ] Validation rules per document type
- [ ] Manual review queue for failures

### 2.4 Tax Service (Edge Functions)
- [ ] `calculate-tpt` - 1,000 FCFA × guests × nights
- [ ] `generate-invoice` - PDF invoice generation
- [ ] `send-reminder` - Outstanding balance notifications

### 2.5 Payment Integration (Edge Functions)
- [ ] `payment-webhook-wave` - Wave callback handler
- [ ] `payment-webhook-orange` - Orange Money handler
- [ ] Payment initiation from chatbot
- [ ] Receipt generation and storage
- [ ] Reconciliation tracking

### 2.6 WhatsApp Flows (Extended)
- [ ] `GUEST_CHECKIN` - Photo capture → OCR → confirmation
- [ ] `GUEST_CHECKOUT` - End stay, show balance
- [ ] `PAY_TPT` - Initiate Wave/OM payment
- [ ] `VIEW_BALANCE` - Outstanding amount
- [ ] `VIEW_HISTORY` - Recent guests and payments

### 2.7 Real-time Subscriptions
- [ ] Payment confirmation notifications
- [ ] Guest registration confirmations

**Deliverable**: Full guest lifecycle with mobile money payments

---

## Phase 3: Police & Ministry Dashboards (Weeks 12-17)

### 3.1 Database Tables
- [ ] `alerts` - Security alerts
- [ ] `alert_assignments` - Officer assignments
- [ ] `jurisdictions` - Geographic zones
- [ ] `police_users` - Police accounts (separate from landlords)
- [ ] `ministry_users` - Ministry accounts
- [ ] `audit_logs` - All data access logged

### 3.2 Alert System
- [ ] Database triggers for alert creation:
  - Minor without guardian → CRITICAL
  - Suspicious guardian → HIGH
  - Document validation failure → MEDIUM
- [ ] Real-time subscriptions for alerts
- [ ] SMS integration for CRITICAL (Twilio/Infobip)

### 3.3 Police Dashboard (Next.js)
- [ ] Secure authentication (email + MFA)
- [ ] Real-time map view (Mapbox GL JS):
  - Property markers (green/yellow/red)
  - Heat map overlay
  - Clustering for density
- [ ] Alert center:
  - Filter by severity, status, jurisdiction
  - Real-time updates via Supabase subscriptions
  - Assignment workflow
- [ ] Search functionality:
  - Person search (name, ID, nationality)
  - Property search (address, license, owner)
- [ ] Owner dossier view:
  - All properties
  - Guest history
  - Payment status
  - Risk score

### 3.4 Ministry Dashboard (Next.js)
- [ ] Market overview:
  - Total properties by type and region
  - Registered vs unregistered estimates
  - Occupancy trends
- [ ] Establishment registry:
  - Property list with filters
  - License status management
  - Export to CSV/Excel
- [ ] Revenue dashboard:
  - TPT collection by region
  - Collection rate trends
  - Top contributors/delinquents

### 3.5 Police Mobile App (React Native)
- [ ] Push notifications (Expo + Supabase)
- [ ] QR code scanner for verification
- [ ] Quick search
- [ ] Alert acknowledgment

### 3.6 Edge Functions
- [ ] `send-police-alert` - Triggered by alert creation
- [ ] `generate-dossier` - Compile owner information
- [ ] `export-report` - Generate ministry reports

**Deliverable**: Operational dashboards for law enforcement and ministry

---

## Phase 4: Intelligence Engine (Weeks 18-24)

### 4.1 Intelligence Service (Python)
- [ ] FastAPI application setup
- [ ] Celery + Redis for task queue
- [ ] Supabase Python client integration
- [ ] Scrapy project structure

### 4.2 Platform Scrapers
- [ ] Airbnb scraper (highest priority)
  - Listing details, photos, pricing
  - Host information
  - Calendar/availability
- [ ] Booking.com scraper
- [ ] Expat-Dakar scraper
- [ ] Facebook Marketplace (limited)

### 4.3 Data Processing
- [ ] Listing normalization pipeline
- [ ] Deduplication (same listing, multiple platforms)
- [ ] Geocoding and location normalization
- [ ] Revenue estimation algorithms

### 4.4 Database Tables (Supabase)
- [ ] `scraped_listings` - Raw scraped data
- [ ] `normalized_listings` - Processed listings
- [ ] `listing_matches` - Matches to registered properties
- [ ] `scrape_jobs` - Job tracking

### 4.5 Image Service (Python)
- [ ] Feature extraction (ResNet50)
- [ ] Vector storage (pgvector in Supabase)
- [ ] Similarity search API
- [ ] Cross-platform matching
- [ ] Registered property matching

### 4.6 LLM Service (Python)
- [ ] Claude API integration
- [ ] Entity extraction from listings
- [ ] Review sentiment analysis
- [ ] Risk score generation
- [ ] Chatbot enhancement

### 4.7 Integration with Dashboards
- [ ] Unregistered property markers on map
- [ ] Match suggestions for ministry review
- [ ] Automated enforcement alerts

**Deliverable**: Automated market surveillance with AI matching

---

## Phase 5: Knowledge Graph & Advanced (Weeks 25-30)

### 5.1 Graph Database (Neo4j Aura)
- [ ] Schema implementation
- [ ] Sync from Supabase (CDC or batch)
- [ ] GraphQL API for queries

### 5.2 Graph Nodes
- [ ] Person (landlords, guests)
- [ ] Property (registered)
- [ ] Listing (scraped)
- [ ] Stay (guest visits)
- [ ] Transaction (payments)

### 5.3 Graph Relationships
- [ ] OWNS (Person → Property)
- [ ] HAS_LISTING (Property → Listing)
- [ ] STAYED_AT (Person → Stay)
- [ ] PAID (Person → Transaction)
- [ ] RELATED_TO (Person → Person)

### 5.4 Advanced Police Features
- [ ] Network analysis queries
- [ ] Relationship visualization (D3.js/vis.js)
- [ ] Path finding between entities
- [ ] Anomaly detection

### 5.5 OSINT Enrichment
- [ ] Phone number lookup integration
- [ ] Social media profile linking
- [ ] Business registry lookup (NINEA)

### 5.6 Public Verification Portal
- [ ] QR code verification page
- [ ] Property legitimacy badge
- [ ] Guest-facing check-in portal

**Deliverable**: Full knowledge graph with network analysis

---

## Phase 6: Hardening & Launch (Weeks 31-36)

### 6.1 Security
- [ ] Penetration testing
- [ ] RLS policy audit
- [ ] API security review
- [ ] Data encryption verification
- [ ] CDP compliance documentation

### 6.2 Performance
- [ ] Database query optimization
- [ ] Index tuning
- [ ] Edge function optimization
- [ ] Load testing

### 6.3 Monitoring
- [ ] Supabase dashboard monitoring
- [ ] Custom metrics (Prometheus)
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring

### 6.4 Documentation & Training
- [ ] User guides
- [ ] API documentation
- [ ] Admin training
- [ ] Runbooks

**Deliverable**: Production-ready, secure platform

---

## Supabase Database Schema

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For image embeddings

-- Enums
CREATE TYPE property_type AS ENUM ('hotel', 'meuble', 'guesthouse', 'short_term');
CREATE TYPE property_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE document_type AS ENUM ('cni', 'passport', 'cedeao_id', 'residence_permit');
CREATE TYPE stay_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('wave', 'orange_money', 'card', 'cash');
CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE alert_status AS ENUM ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed');
CREATE TYPE user_role AS ENUM ('landlord', 'police', 'ministry', 'admin');

-- Landlords (extends auth.users)
CREATE TABLE landlords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    cni_number TEXT,
    cni_photo_url TEXT,
    business_name TEXT,
    ninea_number TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type property_type NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    license_number TEXT UNIQUE,
    status property_status DEFAULT 'pending',
    capacity_rooms INTEGER,
    capacity_beds INTEGER,
    compliance_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Photos
CREATE TABLE property_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    embedding VECTOR(2048),  -- For image matching
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    nationality TEXT,
    document_type document_type,
    document_number TEXT,
    document_photo_url TEXT,
    document_expiry DATE,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stays
CREATE TABLE stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id),
    guardian_id UUID REFERENCES guests(id),
    check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out TIMESTAMPTZ,
    nights INTEGER,
    num_guests INTEGER DEFAULT 1,
    status stay_status DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Liabilities
CREATE TABLE tax_liabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id),
    stay_id UUID REFERENCES stays(id),
    amount INTEGER NOT NULL,  -- In FCFA
    paid_amount INTEGER DEFAULT 0,
    status payment_status DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES landlords(id),
    tax_liability_id UUID REFERENCES tax_liabilities(id),
    amount INTEGER NOT NULL,
    method payment_method NOT NULL,
    provider_reference TEXT,
    status payment_status DEFAULT 'pending',
    receipt_url TEXT,
    treasury_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    severity alert_severity NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    property_id UUID REFERENCES properties(id),
    guest_id UUID REFERENCES guests(id),
    stay_id UUID REFERENCES stays(id),
    status alert_status DEFAULT 'new',
    assigned_to UUID,
    jurisdiction TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- Scraped Listings
CREATE TABLE scraped_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    property_type TEXT,
    address TEXT,
    city TEXT,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    price_per_night INTEGER,
    currency TEXT DEFAULT 'XOF',
    capacity_guests INTEGER,
    capacity_bedrooms INTEGER,
    host_name TEXT,
    host_id TEXT,
    rating DECIMAL(3, 2),
    review_count INTEGER,
    photos JSONB,
    amenities JSONB,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, external_id)
);

-- Listing Matches
CREATE TABLE listing_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scraped_listing_id UUID REFERENCES scraped_listings(id),
    property_id UUID REFERENCES properties(id),
    confidence DECIMAL(5, 4),
    match_type TEXT,  -- 'image', 'address', 'manual'
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_properties_landlord ON properties(landlord_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_region ON properties(region);
CREATE INDEX idx_stays_property ON stays(property_id);
CREATE INDEX idx_stays_status ON stays(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_scraped_listings_platform ON scraped_listings(platform);
CREATE INDEX idx_scraped_listings_city ON scraped_listings(city);

-- Row Level Security Policies

ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Landlords can only see their own data
CREATE POLICY "Landlords view own profile" ON landlords
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Landlords update own profile" ON landlords
    FOR UPDATE USING (auth.uid() = user_id);

-- Landlords can only see their own properties
CREATE POLICY "Landlords view own properties" ON properties
    FOR SELECT USING (
        landlord_id IN (SELECT id FROM landlords WHERE user_id = auth.uid())
    );

CREATE POLICY "Landlords insert own properties" ON properties
    FOR INSERT WITH CHECK (
        landlord_id IN (SELECT id FROM landlords WHERE user_id = auth.uid())
    );

-- Police can view all (with audit)
CREATE POLICY "Police view all properties" ON properties
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'police'
        )
    );

CREATE POLICY "Police view all alerts" ON alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' IN ('police', 'admin')
        )
    );
```

---

## Edge Functions Overview

### `payment-webhook-wave`
Handles Wave payment callbacks, updates payment status, triggers receipt generation.

### `payment-webhook-orange`
Handles Orange Money callbacks.

### `generate-license`
Creates unique license numbers: `TRG-{YEAR}-{SEQUENCE}`

### `calculate-tpt`
Calculates tax: `1000 × num_guests × nights`

### `process-document`
Triggered on document upload, calls OCR API, stores results.

### `send-alert`
Triggered on alert creation, sends SMS for CRITICAL, push for others.

### `compliance-check`
Scheduled function to recalculate compliance scores.

---

## Technology Stack (Updated)

### Core Backend
- **Supabase**: Auth, Database, Storage, Real-time, Edge Functions
- **Database**: PostgreSQL 15 with pgvector
- **Edge Functions**: Deno (TypeScript)

### Custom Services
- **WhatsApp Bot**: Node.js 20 + Express
- **Intelligence**: Python 3.11 + FastAPI + Scrapy
- **Image Service**: Python + PyTorch + Faiss
- **LLM Service**: Python + Claude API

### Frontend
- **Web Apps**: Next.js 14 + TypeScript + Tailwind
- **Components**: shadcn/ui
- **Maps**: Mapbox GL JS
- **Mobile**: React Native + Expo

### Infrastructure
- **Supabase**: Pro/Team tier
- **Python Services**: Railway / Render / VPS
- **CI/CD**: GitHub Actions
- **Monitoring**: Supabase Dashboard + Sentry

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| Supabase (scale usage) | ~$50-200 |
| Neo4j Aura | $65 |
| Railway/Render (Python) | ~$50-100 |
| 360dialog WhatsApp | ~$50 + per-message |
| Google Cloud Vision | ~$50-100 |
| Claude API | ~$100-500 |
| Mapbox | Free tier likely sufficient |
| **Total MVP** | **~$400-1000/month** |

---

## Next Steps

1. **Initialize monorepo** with Supabase project
2. **Setup database schema** and RLS policies
3. **Build landlord auth flow** (phone OTP)
4. **Create property registration** (web + WhatsApp)
5. **Deploy to staging** for early testing

Ready to start building?
