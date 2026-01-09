/**
 * Batch Scraper Worker
 * Handles large-scale scraping with rate limiting, retries, and progress tracking
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ExpatDakarFetchScraper } from '../scrapers/expat-dakar-fetch.js';
import { ScrapedListing, Platform } from '../types.js';

interface BatchJob {
  id: string;
  platform: Platform;
  city: string;
  totalPages: number;
  currentPage: number;
  listingsScraped: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  errorCount: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
}

export class BatchScraper {
  private supabase: SupabaseClient;
  private isRunning = false;
  private currentJob: BatchJob | null = null;

  // Rate limiting config
  private readonly REQUESTS_PER_MINUTE = 10; // Conservative to avoid blocks
  private readonly DELAY_BETWEEN_PAGES = 6000; // 6 seconds
  private readonly DELAY_BETWEEN_LISTINGS = 1500; // 1.5 seconds
  private readonly MAX_ERRORS_BEFORE_PAUSE = 5;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Start a full platform scrape
   */
  async startFullScrape(platform: Platform, city: string, maxPages: number = 100): Promise<BatchJob> {
    const job: BatchJob = {
      id: crypto.randomUUID(),
      platform,
      city,
      totalPages: maxPages,
      currentPage: 1,
      listingsScraped: 0,
      status: 'running',
      errorCount: 0,
      startedAt: new Date(),
    };

    // Estimate completion time
    const estimatedMinutes = maxPages * (this.DELAY_BETWEEN_PAGES / 1000 / 60) * 1.5;
    job.estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    // Save job to database for tracking
    await this.saveJobProgress(job);

    this.currentJob = job;
    this.isRunning = true;

    // Run in background
    this.runBatchScrape(job).catch(console.error);

    return job;
  }

  /**
   * Main batch scraping loop
   */
  private async runBatchScrape(job: BatchJob): Promise<void> {
    console.log(`[BatchScraper] Starting ${job.platform} scrape for ${job.city}`);
    console.log(`[BatchScraper] Target: ${job.totalPages} pages, ~${job.totalPages * 20} listings`);
    console.log(`[BatchScraper] Estimated completion: ${job.estimatedCompletion?.toISOString()}`);

    const scraper = new ExpatDakarFetchScraper();

    while (job.currentPage <= job.totalPages && this.isRunning && job.status === 'running') {
      try {
        console.log(`\n[BatchScraper] Page ${job.currentPage}/${job.totalPages} (${Math.round(job.currentPage / job.totalPages * 100)}%)`);

        // Scrape single page
        const listings = await this.scrapePage(scraper, job);

        if (listings.length === 0) {
          console.log('[BatchScraper] No more listings found, stopping.');
          break;
        }

        // Save listings to database
        await this.saveListings(listings);
        job.listingsScraped += listings.length;
        job.errorCount = 0; // Reset error count on success

        console.log(`[BatchScraper] Saved ${listings.length} listings (total: ${job.listingsScraped})`);

        // Update progress
        await this.saveJobProgress(job);

        // Move to next page
        job.currentPage++;

        // Rate limiting delay
        if (job.currentPage <= job.totalPages) {
          const delay = this.DELAY_BETWEEN_PAGES + Math.random() * 2000; // Add jitter
          console.log(`[BatchScraper] Waiting ${Math.round(delay / 1000)}s before next page...`);
          await this.sleep(delay);
        }

      } catch (error) {
        job.errorCount++;
        console.error(`[BatchScraper] Error on page ${job.currentPage}:`, error);

        if (job.errorCount >= this.MAX_ERRORS_BEFORE_PAUSE) {
          console.log('[BatchScraper] Too many errors, pausing job.');
          job.status = 'paused';
          await this.saveJobProgress(job);
          break;
        }

        // Exponential backoff on errors
        const backoff = Math.min(30000, 5000 * Math.pow(2, job.errorCount));
        console.log(`[BatchScraper] Backing off for ${backoff / 1000}s...`);
        await this.sleep(backoff);
      }
    }

    // Mark job as completed
    if (job.status === 'running') {
      job.status = 'completed';
    }
    await this.saveJobProgress(job);

    console.log(`\n[BatchScraper] Job ${job.status}`);
    console.log(`[BatchScraper] Total listings scraped: ${job.listingsScraped}`);
  }

  /**
   * Scrape a single page
   */
  private async scrapePage(scraper: ExpatDakarFetchScraper, job: BatchJob): Promise<ScrapedListing[]> {
    const url = `https://www.expat-dakar.com/immobilier?q=${job.city}&page=${job.currentPage}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const partialListings = await scraper.parseSearchResults(html);

    // Get full details for each listing (with rate limiting)
    const fullListings: ScrapedListing[] = [];

    for (const partial of partialListings) {
      if (partial.url) {
        try {
          await this.sleep(this.DELAY_BETWEEN_LISTINGS);
          const full = await scraper.parseListingDetails(partial.url);
          if (full) {
            fullListings.push(full);
          }
        } catch (error) {
          // Log but continue
          console.warn(`[BatchScraper] Failed to get details for ${partial.url}`);
        }
      }
    }

    return fullListings;
  }

  /**
   * Save listings to database with ALL data
   */
  private async saveListings(listings: ScrapedListing[]): Promise<void> {
    for (const listing of listings) {
      const { error } = await this.supabase
        .from('scraped_listings')
        .upsert({
          platform: listing.platform,
          platform_id: listing.platformId,
          url: listing.url,
          title: listing.title,
          description: listing.description,
          price: listing.pricePerNight,
          currency: listing.currency || 'XOF',
          location_text: listing.locationText,
          city: listing.city || 'Dakar',
          host_name: listing.hostName,
          num_rooms: listing.bedrooms,
          num_guests: listing.maxGuests,
          photos: listing.photos,
          amenities: listing.amenities,
          raw_data: {
            ...listing.rawData,
            neighborhood: listing.neighborhood,
            bathrooms: listing.bathrooms,
          },
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'platform,platform_id',
        });

      if (error) {
        console.warn(`[BatchScraper] Save error: ${error.message}`);
      }
    }
  }

  /**
   * Save job progress for resumability
   */
  private async saveJobProgress(job: BatchJob): Promise<void> {
    await this.supabase
      .from('scrape_jobs')
      .upsert({
        id: job.id,
        platform: job.platform,
        job_type: 'batch',
        target_params: {
          city: job.city,
          totalPages: job.totalPages,
          currentPage: job.currentPage,
        },
        status: job.status,
        started_at: job.startedAt?.toISOString(),
        listings_found: job.listingsScraped,
        error_message: job.errorCount > 0 ? `${job.errorCount} errors` : null,
      }, {
        onConflict: 'id',
      });
  }

  /**
   * Pause current job
   */
  pause(): void {
    if (this.currentJob) {
      this.currentJob.status = 'paused';
    }
  }

  /**
   * Resume a paused job
   */
  async resume(jobId: string): Promise<void> {
    const { data } = await this.supabase
      .from('scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (data && data.status === 'paused') {
      const job: BatchJob = {
        id: data.id,
        platform: data.platform,
        city: data.target_params.city,
        totalPages: data.target_params.totalPages,
        currentPage: data.target_params.currentPage,
        listingsScraped: data.listings_found || 0,
        status: 'running',
        errorCount: 0,
        startedAt: new Date(data.started_at),
      };

      this.currentJob = job;
      this.isRunning = true;
      this.runBatchScrape(job).catch(console.error);
    }
  }

  /**
   * Get current job status
   */
  getStatus(): BatchJob | null {
    return this.currentJob;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const scraper = new BatchScraper();

  switch (command) {
    case 'start':
      const platform = (args[1] || 'expat_dakar') as Platform;
      const city = args[2] || 'Dakar';
      const pages = parseInt(args[3] || '50');

      console.log(`Starting batch scrape: ${platform} in ${city}, ${pages} pages`);
      const job = await scraper.startFullScrape(platform, city, pages);
      console.log(`Job started: ${job.id}`);
      console.log(`Estimated completion: ${job.estimatedCompletion}`);

      // Keep process running
      process.on('SIGINT', () => {
        console.log('\nPausing job...');
        scraper.pause();
        setTimeout(() => process.exit(0), 2000);
      });
      break;

    case 'resume':
      const jobId = args[1];
      if (!jobId) {
        console.error('Usage: batch-scraper resume <job-id>');
        process.exit(1);
      }
      await scraper.resume(jobId);
      break;

    default:
      console.log('Usage:');
      console.log('  batch-scraper start [platform] [city] [pages]');
      console.log('  batch-scraper resume <job-id>');
  }
}

if (process.argv[1].includes('batch-scraper')) {
  main().catch(console.error);
}
