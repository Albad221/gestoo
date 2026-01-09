# Gestoo

**National Accommodation Intelligence Platform for Senegal**

Gestoo is a comprehensive platform designed to modernize and digitize accommodation management in Senegal. It enables landlords to register properties, declare guests, and pay tourist taxes (TPT) while providing law enforcement and government agencies with real-time monitoring and security alerts.

---

## Architecture Overview

```
                                    +------------------+
                                    |   WhatsApp API   |
                                    |  (WATI/360dialog)|
                                    +--------+---------+
                                             |
+------------------+                +--------v---------+                +------------------+
|                  |                |                  |                |                  |
|  Web Landlord    +--------------->+  Supabase Cloud  +<---------------+  Web Admin       |
|  (Next.js)       |                |                  |                |  (Next.js)       |
|                  |                | - Auth           |                |  Police/Ministry |
+------------------+                | - PostgreSQL     |                +------------------+
                                    | - Storage        |
                                    | - Edge Functions |
                                    | - Realtime       |
+------------------+                +--------+---------+                +------------------+
|                  |                         |                          |                  |
|  Chatbot Service +-------------------------+                          |  Intelligence    |
|  (Node.js)       |                         |                          |  Service (Python)|
|                  |                         |                          |                  |
+------------------+                +--------v---------+                +------------------+
                                    |                  |
                                    |     Redis        |
                                    |  (Session Store) |
                                    |                  |
                                    +------------------+
```

---

## Features

### For Landlords
- Property registration via web portal or WhatsApp
- Guest check-in/check-out with document scanning
- TPT (Tourist Promotion Tax) calculation and payment
- Payment via Wave or Orange Money
- Digital receipts and compliance tracking

### For Authorities
- Real-time dashboard with property map
- Automated alerts for minors without guardians
- Guest search and verification
- Revenue tracking and statistics
- Market intelligence from scraped listings

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Auth, DB, Storage, Edge Functions) |
| Database | PostgreSQL 15 with pgvector |
| Chatbot | Node.js, Express, Redis |
| Intelligence | Python, FastAPI, Scrapy |
| Payments | Wave, Orange Money |
| WhatsApp | WATI / 360dialog API |
| Infrastructure | Vercel, Docker, GitHub Actions |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for local services)
- Supabase CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/gestoo.git
cd gestoo

# Install dependencies
pnpm install

# Start Supabase locally
pnpm supabase:start

# Run database migrations
pnpm supabase:migrate

# Start development servers
pnpm dev
```

### Environment Setup

Copy the example environment files:

```bash
cp apps/web-landlord/.env.example apps/web-landlord/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local
cp services/chatbot-service/.env.example services/chatbot-service/.env
```

---

## Project Structure

```
gestoo/
├── apps/
│   ├── web-admin/           # Police & Ministry Dashboard (Next.js)
│   └── web-landlord/        # Landlord Portal (Next.js)
├── services/
│   ├── chatbot-service/     # WhatsApp Bot (Node.js)
│   ├── intelligence-service/ # Scraping Engine (Python)
│   ├── image-service/       # Image Matching (Python)
│   └── llm-service/         # AI Assistant (Python)
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions (Deno)
├── packages/
│   ├── shared-types/        # TypeScript types
│   └── ui/                  # Shared UI components
├── docker/
│   └── docker-compose.yml   # Local development
└── docs/                    # Documentation
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and data flow |
| [Deployment](docs/DEPLOYMENT.md) | Setup and deployment guide |
| [API Reference](docs/API.md) | Edge Function endpoints |
| [Chatbot](docs/CHATBOT.md) | WhatsApp bot documentation |
| [Landlord Guide (FR)](docs/USER_GUIDE_LANDLORD.md) | Guide utilisateur proprietaire |
| [Admin Guide (FR)](docs/USER_GUIDE_ADMIN.md) | Guide utilisateur administrateur |
| [Contributing](docs/CONTRIBUTING.md) | Development guidelines |

---

## Scripts

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps
pnpm lint             # Run ESLint
pnpm type-check       # TypeScript checking
pnpm format           # Format code with Prettier

# Database
pnpm supabase:start   # Start local Supabase
pnpm supabase:stop    # Stop local Supabase
pnpm supabase:migrate # Run migrations
pnpm supabase:reset   # Reset database

# Clean
pnpm clean            # Remove all build artifacts
```

---

## License

This project is proprietary software developed for the Government of Senegal.

---

## Contact

- **Ministry of Tourism and Leisure**: tourisme@gouv.sn
- **Technical Support**: support@gestoo.sn
