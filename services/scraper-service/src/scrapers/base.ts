/**
 * Base Scraper Class
 * Provides common functionality for all platform scrapers
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import PQueue from 'p-queue';
import { ScrapedListing, Platform, ScrapeJob, ScraperConfig } from '../types.js';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected queue: PQueue;
  protected config: ScraperConfig;

  abstract platform: Platform;
  abstract baseUrl: string;

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      platform: 'airbnb' as Platform,
      enabled: true,
      rateLimit: 10,
      maxConcurrent: 2,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config,
    };

    this.queue = new PQueue({
      concurrency: this.config.maxConcurrent,
      interval: 60000,
      intervalCap: this.config.rateLimit,
    });
  }

  /**
   * Initialize the browser instance
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
        ],
        protocolTimeout: 120000,
      });
      console.log(`[${this.platform}] Browser initialized`);
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log(`[${this.platform}] Browser closed`);
    }
  }

  /**
   * Create a new page with default settings
   */
  protected async newPage(): Promise<Page> {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser!.newPage();

    // Set user agent
    if (this.config.userAgent) {
      await page.setUserAgent(this.config.userAgent);
    }

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Block images and fonts to speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  /**
   * Build search URL for the platform
   */
  abstract buildSearchUrl(params: ScrapeJob['targetParams']): string;

  /**
   * Parse listing cards from search results page
   */
  abstract parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]>;

  /**
   * Parse full listing details from listing page
   */
  abstract parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing>;

  /**
   * Navigate to URL with retry logic
   */
  protected async navigateWithRetry(page: Page, url: string, maxRetries = 2): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${this.platform}] Navigation attempt ${attempt}...`);
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        return true;
      } catch (error: any) {
        console.log(`[${this.platform}] Attempt ${attempt} failed: ${error.message}`);
        if (attempt < maxRetries) {
          await this.randomDelay(2000, 4000);
        }
      }
    }
    return false;
  }

  /**
   * Run a scrape job
   */
  async scrape(job: ScrapeJob): Promise<ScrapedListing[]> {
    const listings: ScrapedListing[] = [];

    try {
      await this.init();

      // Build search URL
      const searchUrl = this.buildSearchUrl(job.targetParams);
      console.log(`[${this.platform}] Target URL: ${searchUrl}`);

      // Try navigation with fresh browser instances if needed
      let page: Page | null = null;
      let navigated = false;

      for (let attempt = 1; attempt <= 3 && !navigated; attempt++) {
        try {
          console.log(`[${this.platform}] Creating page (attempt ${attempt})...`);

          // Restart browser on retry
          if (attempt > 1) {
            console.log(`[${this.platform}] Restarting browser...`);
            await this.close();
            await this.randomDelay(2000, 3000);
            await this.init();
          }

          page = await this.newPage();

          await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });
          navigated = true;
          console.log(`[${this.platform}] Navigation successful`);
        } catch (navError: any) {
          console.log(`[${this.platform}] Navigation failed: ${navError.message}`);
          if (page) {
            try { await page.close(); } catch {}
            page = null;
          }
          if (attempt < 3) {
            await this.randomDelay(3000, 5000);
          }
        }
      }

      if (!page || !navigated) {
        throw new Error('Failed to navigate after 3 attempts');
      }

      // Wait for page to stabilize
      await this.randomDelay(3000, 5000);

      // Handle any popups/modals
      await this.dismissPopups(page);

      // Scrape search results
      let currentPage = 1;
      const maxPages = job.targetParams.maxPages || 5;

      while (currentPage <= maxPages) {
        console.log(`[${this.platform}] Scraping page ${currentPage}...`);

        // Wait for listings to load with error handling
        try {
          await this.waitForListings(page);
        } catch (waitError) {
          console.log(`[${this.platform}] Could not find listings selector, proceeding with page content...`);
        }

        // Parse listings from current page
        const pageListings = await this.parseSearchResults(page);
        console.log(`[${this.platform}] Found ${pageListings.length} listings on page ${currentPage}`);

        // Get full details for each listing
        for (const partialListing of pageListings) {
          if (partialListing.url) {
            try {
              const fullListing = await this.queue.add(async () => {
                return await this.parseListingDetails(page, partialListing.url!);
              });

              if (fullListing) {
                listings.push(fullListing);
              }
            } catch (error) {
              console.error(`[${this.platform}] Error scraping listing ${partialListing.url}:`, error);
            }
          }
        }

        // Try to go to next page
        const hasNextPage = await this.goToNextPage(page);
        if (!hasNextPage) {
          break;
        }

        currentPage++;

        // Random delay between pages
        await this.randomDelay(2000, 5000);
      }

      await page.close();
    } catch (error) {
      console.error(`[${this.platform}] Scraping error:`, error);
      throw error;
    }

    return listings;
  }

  /**
   * Dismiss any popups or cookie banners
   */
  protected async dismissPopups(page: Page): Promise<void> {
    // Override in platform-specific scrapers
    try {
      // Common cookie consent selectors
      const cookieSelectors = [
        'button[data-testid="accept-cookies"]',
        '[aria-label="Accept cookies"]',
        '#onetrust-accept-btn-handler',
        '.cookie-consent-accept',
        '[class*="cookie"] button',
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await this.randomDelay(500, 1000);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }
    } catch {
      // Ignore popup dismissal errors
    }
  }

  /**
   * Wait for listings to appear on page
   */
  protected abstract waitForListings(page: Page): Promise<void>;

  /**
   * Navigate to the next page of results
   */
  protected abstract goToNextPage(page: Page): Promise<boolean>;

  /**
   * Random delay to avoid detection
   */
  protected async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Extract coordinates from various formats
   */
  protected parseCoordinates(lat: any, lng: any): { latitude: number; longitude: number } | null {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }

  /**
   * Clean price string to number
   */
  protected parsePrice(priceStr: string): number | undefined {
    if (!priceStr) return undefined;

    // Remove currency symbols and non-numeric chars except decimal
    const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(',', '');
    const price = parseInt(cleaned, 10);

    return isNaN(price) ? undefined : price;
  }

  /**
   * Detect property type from text
   */
  protected detectPropertyType(text: string): ScrapedListing['propertyType'] {
    const lower = text.toLowerCase();

    if (lower.includes('villa')) return 'villa';
    if (lower.includes('studio')) return 'studio';
    if (lower.includes('appartement') || lower.includes('apartment')) return 'apartment';
    if (lower.includes('maison') || lower.includes('house')) return 'house';
    if (lower.includes('chambre') || lower.includes('room')) return 'room';
    if (lower.includes('hotel')) return 'hotel';
    if (lower.includes('guesthouse') || lower.includes("maison d'hotes")) return 'guesthouse';

    return 'other';
  }
}
