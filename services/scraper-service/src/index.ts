/**
 * Scraper Service - Main Entry Point
 * Exports service classes for programmatic use
 */

export { ScraperService } from './service.js';
export { ListingMatcher } from './matcher.js';
export { BaseScraper, createScraper, SUPPORTED_PLATFORMS } from './scrapers/index.js';
export * from './types.js';

// For scheduled jobs
import 'dotenv/config';
import cron from 'node-cron';
import { ScraperService } from './service.js';
import { SUPPORTED_PLATFORMS } from './scrapers/index.js';

const SENEGAL_CITIES = ['Dakar', 'Saint-Louis', 'Saly', 'Cap Skirring', 'Mbour'];

/**
 * Start scheduled scraping jobs
 */
export function startScheduler(): void {
  const service = new ScraperService();

  console.log('[Scheduler] Starting scraper scheduler...');

  // Daily scrape at 2 AM for all platforms and cities
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running daily scrape job...');

    for (const platform of SUPPORTED_PLATFORMS) {
      for (const city of SENEGAL_CITIES) {
        try {
          console.log(`[Scheduler] Scraping ${platform} for ${city}...`);

          await service.runScrapeJob({
            platform,
            jobType: 'incremental',
            targetParams: {
              city,
              maxPages: 5,
            },
          });

          // Wait between jobs to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } catch (error) {
          console.error(`[Scheduler] Error scraping ${platform} ${city}:`, error);
        }
      }
    }

    console.log('[Scheduler] Daily scrape completed');
  });

  // Weekly market intelligence generation on Sundays at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Scheduler] Running weekly market intelligence...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    for (const city of SENEGAL_CITIES) {
      try {
        await service.generateMarketIntelligence(city, startDate, endDate);
        console.log(`[Scheduler] Generated metrics for ${city}`);
      } catch (error) {
        console.error(`[Scheduler] Error generating metrics for ${city}:`, error);
      }
    }

    console.log('[Scheduler] Weekly market intelligence completed');
  });

  // Daily cleanup at 4 AM - mark listings not seen in 14 days as inactive
  cron.schedule('0 4 * * *', async () => {
    console.log('[Scheduler] Running daily cleanup...');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    for (const platform of SUPPORTED_PLATFORMS) {
      try {
        const count = await service.markInactiveListings(platform, cutoff);
        console.log(`[Scheduler] Marked ${count} ${platform} listings as inactive`);
      } catch (error) {
        console.error(`[Scheduler] Error during cleanup for ${platform}:`, error);
      }
    }

    console.log('[Scheduler] Daily cleanup completed');
  });

  console.log('[Scheduler] Scheduler started. Jobs:');
  console.log('  - Daily scrape: 2 AM');
  console.log('  - Weekly metrics: Sundays at 3 AM');
  console.log('  - Daily cleanup: 4 AM');
}

// Start scheduler if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startScheduler();
}
