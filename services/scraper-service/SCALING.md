# GESTOO Intelligence System - Scaling Architecture

## The Problem

```
Current: 10 listings scraped manually
Target:  12,000+ listings across 7 platforms, updated daily
```

## Cost Analysis

### Scraping Costs
| Platform     | Listings | Method         | Monthly Cost |
|--------------|----------|----------------|--------------|
| Expat-Dakar  | ~8,600   | HTTP Fetch     | $0 (free)    |
| Jumia House  | ~500     | HTTP Fetch     | $0 (free)    |
| Airbnb       | ~2,000   | Proxy + Browser| ~$50/month   |
| Booking.com  | ~800     | Proxy + Browser| ~$30/month   |
| Others       | ~1,000   | Mixed          | ~$20/month   |

**Scraping Total: ~$100/month**

### LLM Analysis Costs
| Task                  | Volume    | LLM Calls | Cost/Call | Monthly   |
|-----------------------|-----------|-----------|-----------|-----------|
| New listing analysis  | 500/day   | 100 (20%) | $0.01     | ~$30      |
| Owner clustering      | Weekly    | 50        | $0.02     | ~$4       |
| Compliance reports    | On-demand | 20        | $0.05     | ~$1       |

**LLM Total: ~$35/month** (using GPT-4o-mini with smart filtering)

### Infrastructure
| Service        | Provider  | Monthly Cost |
|----------------|-----------|--------------|
| Supabase       | Pro plan  | $25          |
| Scraper host   | Railway   | $20          |
| Proxy service  | BrightData| $50          |

**Total Monthly Cost: ~$230/month**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCRAPING LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Expat-Dakar  │  │ Jumia House  │  │   Airbnb     │          │
│  │ (HTTP Fetch) │  │ (HTTP Fetch) │  │ (Puppeteer)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         │    ┌────────────┴────────────┐    │                   │
│         └────►   BATCH SCRAPER QUEUE   ◄────┘                   │
│              │   (Rate Limited)        │                         │
│              │   - 10 req/min          │                         │
│              │   - Retry on fail       │                         │
│              │   - Progress tracking   │                         │
│              └────────────┬────────────┘                         │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ scraped_listings │    │   scrape_jobs    │                   │
│  │   (~12,000)      │    │   (job tracking) │                   │
│  └────────┬─────────┘    └──────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ listing_matches  │    │ detected_owners  │                   │
│  │ (compliance)     │    │ (clustering)     │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYSIS LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   TIER 1: RULES (FREE)                   │   │
│  │  - No registration number? +20 risk                      │   │
│  │  - Commercial keywords? +25 risk                         │   │
│  │  - 3+ bedrooms? +10 risk                                 │   │
│  │  - Tourist zone? +10 risk                                │   │
│  │                                                          │   │
│  │  ► Handles 80% of listings                               │   │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│              Risk 30-70?  │  Yes                                │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   TIER 2: LLM ($0.01/call)               │   │
│  │  - GPT-4o-mini for uncertain cases                       │   │
│  │  - Deep description analysis                             │   │
│  │  - Commercial intent detection                           │   │
│  │                                                          │   │
│  │  ► Only ~20% of listings need this                       │   │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Review Queue │  │   Alerts     │  │   Reports    │          │
│  │ (web-admin)  │  │  (Ministry)  │  │  (exports)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scheduling Strategy

### Daily (Automated)
```cron
# Incremental scrape - new listings only
0 2 * * * npm run batch-scrape expat_dakar Dakar 10
0 3 * * * npm run batch-scrape jumia_house Dakar 10
```

### Weekly (Automated)
```cron
# Full scrape - all platforms
0 1 * * 0 npm run batch-scrape expat_dakar Dakar 100
0 1 * * 0 npm run batch-scrape jumia_house Dakar 50

# Owner clustering
0 6 * * 0 npm run cluster-owners
```

### Monthly (Manual)
- Full Airbnb/Booking scrape (needs proxy refresh)
- Compliance reports for Ministry
- Database cleanup (inactive listings)

---

## Running at Scale

### 1. Start batch scrape
```bash
cd services/scraper-service

# Full Expat-Dakar scrape (432 pages, ~5 hours)
npx tsx src/workers/batch-scraper.ts start expat_dakar Dakar 432

# Monitor progress
npx tsx src/workers/batch-scraper.ts status

# Pause if needed (Ctrl+C saves progress)
# Resume later
npx tsx src/workers/batch-scraper.ts resume <job-id>
```

### 2. Run analysis
```bash
# Analyze new listings (rules + selective LLM)
npx tsx src/analysis/run-analysis.ts

# Cluster owners
npx tsx src/analysis/run-analysis.ts cluster
```

### 3. Deploy to production
```bash
# Railway/Render deployment
git push origin main

# Or Docker
docker build -t gestoo-scraper .
docker run -d gestoo-scraper npm run cron
```

---

## Platform-Specific Notes

### Expat-Dakar (EASY)
- No anti-bot protection
- HTTP fetch works perfectly
- 20 listings/page, 432 pages
- Full scrape: ~5 hours

### Jumia House (EASY)
- Light protection
- HTTP fetch works
- ~500 listings total
- Full scrape: ~1 hour

### Airbnb (HARD)
- Heavy anti-bot (DataDome)
- Needs residential proxies ($50/month)
- Rate limit: 2 req/minute
- Consider: Apify pre-built scraper ($40/month)

### Booking.com (HARD)
- Cloudflare protection
- Needs proxy rotation
- API available for partners

---

## Quick Wins (Do First)

1. **Run full Expat-Dakar scrape** (~8,600 listings, free)
   ```bash
   npx tsx src/workers/batch-scraper.ts start expat_dakar Dakar 432
   ```

2. **Run Jumia House scrape** (~500 listings, free)
   ```bash
   npx tsx src/workers/batch-scraper.ts start jumia_house Dakar 50
   ```

3. **Run owner clustering** (find professional operators)
   ```bash
   npx tsx src/analysis/run-analysis.ts cluster
   ```

4. **Match against registered properties**
   - Need Ministry data import first
   - Compare phone numbers, addresses, names

---

## Data You'll Have After Full Scrape

```
scraped_listings: 12,000+ records
├── expat_dakar: 8,600
├── jumia_house: 500
├── airbnb: 2,000 (with proxy)
├── booking: 800 (with proxy)
└── others: 1,000

detected_owners: 500+ profiles
├── 1-2 listings: 400 (hobbyists, low risk)
├── 3-5 listings: 80 (semi-pro, medium risk)
└── 6+ listings: 20 (professional, high risk)

listing_matches: comparing to registered
├── matched (compliant): ???
├── unmatched (investigate): ???
└── uncertain (review queue): ???
```

---

## Next Steps

1. [ ] Run full Expat-Dakar batch scrape
2. [ ] Import Ministry registered properties data
3. [ ] Run matching algorithm
4. [ ] Review flagged listings in web-admin
5. [ ] Set up cron jobs for daily updates
6. [ ] Add proxy support for Airbnb/Booking
