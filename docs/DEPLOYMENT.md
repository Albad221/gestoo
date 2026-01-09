# Gestoo - Deployment Guide

## Prerequisites

Before deploying Gestoo, ensure you have:

### Required Accounts
- [Supabase](https://supabase.com) account (Pro tier recommended for production)
- [Vercel](https://vercel.com) account for web app hosting
- [GitHub](https://github.com) repository access
- [WATI](https://wati.io) or [360dialog](https://360dialog.com) account for WhatsApp
- [Wave](https://wave.com) merchant account
- [Orange Money](https://orangemoney.sn) merchant account

### Required Tools
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Supabase CLI
- Git

---

## Environment Variables

### Web Landlord App (`apps/web-landlord/.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics
NEXT_PUBLIC_GA_ID=UA-XXXXXXXXX
```

### Web Admin App (`apps/web-admin/.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Mapbox (for map visualization)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
```

### Chatbot Service (`services/chatbot-service/.env`)

```bash
# Server
PORT=4000
NODE_ENV=production

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://your-redis-host:6379

# WhatsApp (Meta Cloud API)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token

# WhatsApp (WATI Alternative)
WATI_API_URL=https://live-server-XXXXX.wati.io
WATI_API_TOKEN=your-wati-api-token
```

### Supabase Edge Functions

Set these in Supabase Dashboard > Settings > Edge Functions:

```bash
# Payment Providers
WAVE_WEBHOOK_SECRET=your-wave-webhook-secret
WAVE_API_KEY=your-wave-api-key
ORANGE_MONEY_WEBHOOK_SECRET=your-orange-webhook-secret
ORANGE_MONEY_API_KEY=your-orange-api-key

# OCR (optional)
GOOGLE_CLOUD_VISION_API_KEY=your-gcv-api-key
```

---

## Supabase Setup

### 1. Create Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

### 2. Run Migrations

```bash
# Push migrations to your project
supabase db push

# Or run migrations one by one
supabase migration up
```

### 3. Configure Authentication

In Supabase Dashboard:

1. Go to **Authentication > Providers**
2. Enable **Phone** provider
3. Configure SMS provider (Twilio/MessageBird)
4. Set up phone OTP templates

### 4. Configure Storage Buckets

Create the following buckets:

| Bucket Name | Public | Description |
|-------------|--------|-------------|
| `id-documents` | No | Guest ID documents |
| `property-photos` | Yes | Property images |
| `receipts` | No | Payment receipts |
| `cni-photos` | No | Landlord CNI photos |

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public) VALUES
  ('id-documents', 'id-documents', false),
  ('property-photos', 'property-photos', true),
  ('receipts', 'receipts', false),
  ('cni-photos', 'cni-photos', false);
```

### 5. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy individual function
supabase functions deploy generate-license
supabase functions deploy calculate-tpt
supabase functions deploy payment-webhook
supabase functions deploy minor-alert
supabase functions deploy generate-receipt
```

### 6. Set Edge Function Secrets

```bash
supabase secrets set WAVE_WEBHOOK_SECRET=your-secret
supabase secrets set WAVE_API_KEY=your-api-key
supabase secrets set ORANGE_MONEY_WEBHOOK_SECRET=your-secret
supabase secrets set ORANGE_MONEY_API_KEY=your-api-key
```

---

## Web App Deployment (Vercel)

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** > **Project**
3. Import your GitHub repository
4. Configure the project:

**For Web Landlord:**
- Root Directory: `apps/web-landlord`
- Framework: Next.js
- Build Command: `pnpm build`
- Output Directory: `.next`

**For Web Admin:**
- Root Directory: `apps/web-admin`
- Framework: Next.js
- Build Command: `pnpm build`
- Output Directory: `.next`

### 2. Configure Environment Variables

Add all required environment variables in Vercel project settings.

### 3. Configure Domains

Set up custom domains:
- `app.gestoo.sn` - Landlord portal
- `admin.gestoo.sn` - Admin dashboard

---

## Chatbot Service Deployment

### Option A: Docker (Recommended)

#### 1. Build Image

```bash
cd services/chatbot-service
docker build -t gestoo-chatbot:latest .
```

#### 2. Run Container

```bash
docker run -d \
  --name gestoo-chatbot \
  -p 4000:4000 \
  --env-file .env \
  gestoo-chatbot:latest
```

#### 3. Docker Compose (with Redis)

```bash
cd docker
docker-compose up -d chatbot redis
```

### Option B: PM2 (VPS)

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. Start Service

```bash
cd services/chatbot-service
pnpm install
pnpm build

pm2 start dist/index.js --name "gestoo-chatbot"
pm2 save
pm2 startup
```

### Option C: Railway/Render

Deploy directly from GitHub:

1. Create new service
2. Connect repository
3. Set root directory: `services/chatbot-service`
4. Add environment variables
5. Deploy

---

## WhatsApp Configuration

### WATI Setup

1. Create account at [wati.io](https://wati.io)
2. Connect your WhatsApp Business number
3. Get API credentials from Settings > API
4. Configure webhook URL:
   ```
   https://your-chatbot-domain.com/webhook
   ```

### Meta Cloud API Setup

1. Create Meta Business account
2. Create WhatsApp Business app
3. Get Phone Number ID and Access Token
4. Configure webhook:
   - URL: `https://your-chatbot-domain.com/webhook`
   - Verify Token: Your custom token
   - Subscribe to: `messages`

---

## Payment Provider Setup

### Wave Integration

1. Apply for Wave Business account
2. Get API credentials
3. Configure webhook URL:
   ```
   https://your-project.supabase.co/functions/v1/payment-webhook?provider=wave
   ```

### Orange Money Integration

1. Apply for Orange Money merchant account
2. Get API credentials
3. Configure webhook URL:
   ```
   https://your-project.supabase.co/functions/v1/payment-webhook?provider=orange_money
   ```

---

## CI/CD Pipeline

The project includes GitHub Actions workflows:

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push/PR:
- Linting
- Type checking
- Build verification
- Migration validation

### Staging Deployment (`.github/workflows/deploy-staging.yml`)

Runs on push to `develop`:
- Deploy to staging environment
- Run E2E tests

### Production Deployment (`.github/workflows/deploy-production.yml`)

Runs on push to `main`:
- Deploy to production
- Database migrations
- Edge function deployment

### Required Secrets

Set these in GitHub repository settings:

```
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_ID
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID_LANDLORD
VERCEL_PROJECT_ID_ADMIN
```

---

## Post-Deployment Checklist

### Security
- [ ] RLS policies verified
- [ ] API keys rotated
- [ ] SSL certificates active
- [ ] Webhook signatures configured
- [ ] Rate limiting enabled

### Monitoring
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring active
- [ ] Database metrics dashboard
- [ ] Alert notifications set up

### Testing
- [ ] End-to-end user flow tested
- [ ] Payment flow verified
- [ ] WhatsApp messages working
- [ ] Admin dashboard functional

### Documentation
- [ ] Runbook created
- [ ] Emergency contacts listed
- [ ] Recovery procedures documented

---

## Troubleshooting

### Common Issues

**Edge Functions not responding**
```bash
# Check function logs
supabase functions logs generate-license

# Redeploy function
supabase functions deploy generate-license
```

**Database connection issues**
```bash
# Check connection pooler status
supabase status

# Verify connection string
supabase db url
```

**WhatsApp webhook not receiving**
- Verify webhook URL is accessible
- Check verify token matches
- Ensure HTTPS is configured
- Review WATI/Meta logs

**Payment webhooks failing**
- Verify signature configuration
- Check Edge Function logs
- Validate webhook URL accessibility
- Review payment provider dashboard

---

## Rollback Procedures

### Database Migration Rollback

```bash
# Revert last migration
supabase migration repair --status reverted MIGRATION_ID
```

### Edge Function Rollback

```bash
# Deploy previous version
git checkout HEAD~1 -- supabase/functions/function-name
supabase functions deploy function-name
```

### Web App Rollback

In Vercel Dashboard:
1. Go to Deployments
2. Find previous stable deployment
3. Click "..." > "Promote to Production"

---

## Scaling Considerations

### Database
- Enable connection pooling (PgBouncer)
- Add read replicas for analytics
- Monitor query performance

### Edge Functions
- Consider region deployment
- Monitor cold start times
- Optimize function bundle size

### Chatbot Service
- Scale Redis cluster
- Add service replicas
- Implement queue for high volume

---

## Support

For deployment assistance:
- Technical Support: support@gestoo.sn
- Supabase Support: support@supabase.io
- Vercel Support: support@vercel.com
