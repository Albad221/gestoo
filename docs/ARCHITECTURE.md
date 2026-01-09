# Gestoo - System Architecture

## Overview

Gestoo is built on a modern, scalable architecture leveraging Supabase as the core backend platform, with specialized microservices for WhatsApp integration and intelligence gathering.

---

## Architecture Diagram

```
                                   EXTERNAL SERVICES
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                                                                         │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
    │  │   WhatsApp   │  │    Wave      │  │ Orange Money │  │  Google     │ │
    │  │  Business    │  │    API       │  │    API       │  │  Vision OCR │ │
    │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
    └─────────┼─────────────────┼─────────────────┼─────────────────┼────────┘
              │                 │                 │                 │
              ▼                 └────────┬────────┘                 │
    ┌──────────────────┐                 │                          │
    │                  │                 ▼                          ▼
    │  Chatbot Service │        ┌──────────────────────────────────────────┐
    │    (Node.js)     │        │                                          │
    │                  │◄──────►│            SUPABASE CLOUD                │
    │  - Message Router│        │                                          │
    │  - Flow Handlers │        │  ┌────────────┐  ┌────────────────────┐  │
    │  - Session Mgmt  │        │  │            │  │                    │  │
    └────────┬─────────┘        │  │  Auth      │  │   Edge Functions   │  │
             │                  │  │  (Phone    │  │                    │  │
             ▼                  │  │   OTP)     │  │  - payment-webhook │  │
    ┌──────────────────┐        │  │            │  │  - generate-license│  │
    │                  │        │  └────────────┘  │  - calculate-tpt   │  │
    │      Redis       │        │                  │  - minor-alert     │  │
    │  (Session Store) │        │  ┌────────────┐  │  - generate-receipt│  │
    │                  │        │  │            │  └────────────────────┘  │
    └──────────────────┘        │  │ PostgreSQL │                          │
                                │  │   + RLS    │  ┌────────────────────┐  │
    ┌──────────────────┐        │  │            │  │                    │  │
    │                  │        │  └────────────┘  │     Storage        │  │
    │   Web Landlord   │◄──────►│                  │                    │  │
    │    (Next.js)     │        │  ┌────────────┐  │  - id-documents    │  │
    │                  │        │  │            │  │  - property-photos │  │
    │  - Dashboard     │        │  │  Realtime  │  │  - receipts        │  │
    │  - Properties    │        │  │            │  │                    │  │
    │  - Guests        │        │  └────────────┘  └────────────────────┘  │
    │  - Payments      │        │                                          │
    └──────────────────┘        └──────────────────────────────────────────┘
                                                   ▲
    ┌──────────────────┐                           │
    │                  │                           │
    │    Web Admin     │◄──────────────────────────┘
    │    (Next.js)     │
    │                  │
    │  - Alerts        │        ┌──────────────────────────────────────────┐
    │  - Statistics    │        │         INTELLIGENCE SERVICES            │
    │  - Properties    │        │                                          │
    │  - Guests Search │        │  ┌──────────────┐  ┌──────────────────┐  │
    └──────────────────┘        │  │  Scraping    │  │  Image Matching  │  │
                                │  │  Service     │  │  Service         │  │
                                │  │  (Python)    │  │  (Python)        │  │
                                │  └──────────────┘  └──────────────────┘  │
                                │                                          │
                                │  ┌──────────────────────────────────────┐ │
                                │  │       LLM Service (Claude API)       │ │
                                │  └──────────────────────────────────────┘ │
                                └──────────────────────────────────────────┘
```

---

## Service Descriptions

### Core Backend - Supabase

**Authentication**
- Phone OTP for landlords
- Email + MFA for police/ministry users
- JWT tokens with role-based claims
- Session management with refresh tokens

**PostgreSQL Database**
- Primary data store for all entities
- Row Level Security (RLS) for data isolation
- Triggers for automated workflows
- Custom functions for business logic

**Edge Functions (Deno)**
- Serverless functions for API endpoints
- Payment webhook handlers
- License generation
- Tax calculations
- Alert processing

**Storage**
- Secure document storage
- CDN for property photos
- Receipt file storage

**Realtime**
- WebSocket subscriptions for live updates
- Alert notifications
- Payment status updates

---

### Chatbot Service (Node.js)

The chatbot service handles WhatsApp interactions through the WATI API.

**Components:**
- **Message Router**: Routes incoming messages to appropriate flow handlers
- **Flow Handlers**: State machine implementations for each conversation flow
- **Session Manager**: Redis-backed session storage for conversation state
- **WhatsApp Client**: WATI API integration for sending/receiving messages

**Flows:**
| Flow | Description |
|------|-------------|
| Onboarding | New landlord registration |
| Property | Property registration wizard |
| Guest Check-in | Document capture and guest registration |
| Guest Checkout | Stay completion and TPT calculation |
| Payment | TPT payment via mobile money |

---

### Web Applications (Next.js)

**Web Landlord Portal**
- Property management dashboard
- Guest registration interface
- Payment history and receipts
- Profile management

**Web Admin Dashboard**
- Real-time alert center
- Property verification queue
- Guest search and investigation
- Revenue statistics
- Market intelligence

---

### Intelligence Services (Python)

**Scraping Service**
- Airbnb, Booking.com, Expat-Dakar scrapers
- Listing normalization pipeline
- Deduplication and geocoding

**Image Service**
- Feature extraction using ResNet50
- Vector similarity search
- Cross-platform property matching

**LLM Service**
- Claude API integration
- Entity extraction from listings
- Risk assessment
- Chatbot enhancement

---

## Data Flow Diagrams

### Guest Check-in Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Landlord │────►│ WhatsApp │────►│ Chatbot  │────►│ Supabase │
│          │     │          │     │ Service  │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                 │                │
                      │                 │                │
                      ▼                 ▼                ▼
                 ┌──────────┐     ┌──────────┐     ┌──────────┐
                 │  Photo   │────►│   OCR    │────►│  Guest   │
                 │  Upload  │     │ Process  │     │  Record  │
                 └──────────┘     └──────────┘     └──────────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │  Minor   │
                                                  │  Check   │
                                                  └──────────┘
                                                        │
                                              ┌─────────┴─────────┐
                                              │                   │
                                              ▼                   ▼
                                        ┌──────────┐        ┌──────────┐
                                        │  Stay    │        │  Alert   │
                                        │  Created │        │  Created │
                                        └──────────┘        └──────────┘
```

### Payment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Landlord │────►│ Initiate │────►│  Wave/   │────►│ Payment  │
│          │     │ Payment  │     │  Orange  │     │ Webhook  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
                      ┌─────────────────────────────────┘
                      │
                      ▼
                ┌──────────┐     ┌──────────┐     ┌──────────┐
                │  Update  │────►│ Generate │────►│  Send    │
                │  Payment │     │ Receipt  │     │ Confirm  │
                └──────────┘     └──────────┘     └──────────┘
```

---

## Database Schema Overview

### Core Entities

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    landlords    │       │   properties    │       │     guests      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │──┐    │ id              │──┐    │ id              │
│ user_id         │  │    │ landlord_id     │◄─┘    │ first_name      │
│ full_name       │  │    │ name            │       │ last_name       │
│ phone           │  │    │ type            │       │ date_of_birth   │
│ cni_number      │  │    │ address         │       │ nationality     │
│ verified        │  │    │ license_number  │       │ document_type   │
└─────────────────┘  │    │ status          │       │ document_number │
                     │    └─────────────────┘       └─────────────────┘
                     │            │                         │
                     │            │                         │
                     │            ▼                         ▼
                     │    ┌─────────────────┐       ┌─────────────────┐
                     │    │     stays       │◄──────│  (guest_id)     │
                     │    ├─────────────────┤       └─────────────────┘
                     │    │ id              │
                     │    │ property_id     │
                     │    │ guest_id        │
                     │    │ guardian_id     │
                     │    │ check_in        │
                     │    │ check_out       │
                     │    │ nights          │
                     │    └─────────────────┘
                     │            │
                     │            ▼
                     │    ┌─────────────────┐       ┌─────────────────┐
                     └───►│ tax_liabilities │──────►│    payments     │
                          ├─────────────────┤       ├─────────────────┤
                          │ id              │       │ id              │
                          │ property_id     │       │ landlord_id     │
                          │ landlord_id     │       │ tax_liability_id│
                          │ stay_id         │       │ amount          │
                          │ amount          │       │ method          │
                          │ status          │       │ status          │
                          └─────────────────┘       │ receipt_url     │
                                                    └─────────────────┘
```

### Security & Intelligence

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     alerts      │       │scraped_listings │       │  audit_logs     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ severity        │       │ platform        │       │ user_id         │
│ type            │       │ external_id     │       │ action          │
│ title           │       │ url             │       │ resource_type   │
│ property_id     │       │ title           │       │ old_data        │
│ guest_id        │       │ price_per_night │       │ new_data        │
│ status          │       │ host_name       │       │ ip_address      │
│ assigned_to     │       │ is_active       │       │ created_at      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## API Endpoints Summary

### Edge Functions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate-license` | POST | Generate property license number |
| `/calculate-tpt` | POST | Calculate tourist tax for a stay |
| `/payment-webhook` | POST | Handle Wave/Orange Money callbacks |
| `/minor-alert` | POST | Process minor check-in alerts |
| `/generate-receipt` | POST | Generate payment receipt |

### Chatbot Webhook

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | GET | WhatsApp verification |
| `/webhook` | POST | Incoming message handler |
| `/health` | GET | Service health check |

---

## Security Considerations

### Row Level Security (RLS)

All database tables have RLS enabled with policies that ensure:
- Landlords can only access their own data
- Police users can view all properties and guests
- Ministry users can view aggregated statistics
- Admin users have full access

### Authentication

- Phone OTP for landlord authentication
- Email + password with MFA for authority users
- JWT tokens with short expiration
- Service role keys for Edge Functions

### Data Protection

- Document storage with restricted access
- Encrypted connections (TLS)
- Audit logging for all data access
- GDPR/CDP compliance ready

---

## Scalability

The architecture is designed to scale:

- **Supabase**: Auto-scaling PostgreSQL with read replicas
- **Edge Functions**: Serverless, scales automatically
- **Chatbot**: Horizontally scalable with Redis clustering
- **Storage**: CDN distribution for static assets

---

## Monitoring

- Supabase Dashboard for database metrics
- Sentry for error tracking
- Custom Prometheus metrics
- Uptime monitoring for critical endpoints
