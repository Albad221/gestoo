#!/bin/bash
# Production Scraper - GESTOO Intelligence System
# Runs all scrapers in optimal order

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CITY="${1:-Dakar}"
PAGES_LOCAL="${2:-10}"      # Pages for local sites (fast)
PAGES_AIRBNB="${3:-3}"      # Pages for Airbnb (slower)
DETAILS_AIRBNB="${4:-50}"   # Max details to fetch for Airbnb

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   GESTOO Production Scraper${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "City: ${GREEN}$CITY${NC}"
echo -e "Local site pages: ${GREEN}$PAGES_LOCAL${NC}"
echo -e "Airbnb pages: ${GREEN}$PAGES_AIRBNB${NC}"
echo -e "Airbnb details: ${GREEN}$DETAILS_AIRBNB${NC}"
echo ""

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Timestamp for logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="logs"
mkdir -p "$LOG_DIR"

# ============================================
# PHASE 1: Fast HTTP Scrapers (Local Sites)
# ============================================
echo -e "\n${YELLOW}━━━ PHASE 1: Local Platforms (HTTP) ━━━${NC}"

# Expat-Dakar (fastest - pure HTTP)
echo -e "\n${BLUE}[1/4] Scraping Expat-Dakar...${NC}"
start_time=$(date +%s)
npx tsx src/cli.ts scrape expat_dakar "$CITY" "$PAGES_LOCAL" 2>&1 | tee "$LOG_DIR/expat_dakar_$TIMESTAMP.log" || true
end_time=$(date +%s)
echo -e "${GREEN}✓ Expat-Dakar completed in $((end_time - start_time))s${NC}"

# Short delay between platforms
sleep 5

# ============================================
# PHASE 2: Puppeteer Scrapers (Need Browser)
# ============================================
echo -e "\n${YELLOW}━━━ PHASE 2: Browser-Based Scrapers ━━━${NC}"

# Jumia House
echo -e "\n${BLUE}[2/4] Scraping Jumia House...${NC}"
start_time=$(date +%s)
npx tsx src/cli.ts scrape jumia_house "$CITY" "$PAGES_LOCAL" 2>&1 | tee "$LOG_DIR/jumia_house_$TIMESTAMP.log" || true
end_time=$(date +%s)
echo -e "${GREEN}✓ Jumia House completed in $((end_time - start_time))s${NC}"

sleep 5

# CoinAfrique
echo -e "\n${BLUE}[3/4] Scraping CoinAfrique...${NC}"
start_time=$(date +%s)
npx tsx src/cli.ts scrape coinafrique "$CITY" "$PAGES_LOCAL" 2>&1 | tee "$LOG_DIR/coinafrique_$TIMESTAMP.log" || true
end_time=$(date +%s)
echo -e "${GREEN}✓ CoinAfrique completed in $((end_time - start_time))s${NC}"

# ============================================
# PHASE 3: Airbnb (Python Stealth Scraper)
# ============================================
echo -e "\n${YELLOW}━━━ PHASE 3: Airbnb (Stealth Browser) ━━━${NC}"

echo -e "\n${BLUE}[4/4] Scraping Airbnb...${NC}"
start_time=$(date +%s)

# Activate Python venv and run Airbnb scraper
cd python
source venv/bin/activate

# Export env vars for Python
export SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY

python airbnb_scraper.py airbnb \
    --city "$CITY" \
    --pages "$PAGES_AIRBNB" \
    --details "$DETAILS_AIRBNB" \
    --save-db \
    --output "../$LOG_DIR/airbnb_listings_$TIMESTAMP.json" \
    2>&1 | tee "../$LOG_DIR/airbnb_$TIMESTAMP.log" || true

cd ..
end_time=$(date +%s)
echo -e "${GREEN}✓ Airbnb completed in $((end_time - start_time))s${NC}"

# ============================================
# SUMMARY
# ============================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   SCRAPING COMPLETE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Generate metrics report
echo -e "${YELLOW}Generating market intelligence report...${NC}"
npx tsx src/cli.ts metrics "$CITY" 2>&1 || true

echo ""
echo -e "${GREEN}Logs saved to: $LOG_DIR/${NC}"
echo -e "${GREEN}Run 'npx tsx src/cli.ts unregistered $CITY' to see potential violations${NC}"
