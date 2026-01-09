/**
 * Airbnb Scraper - Node.js wrapper for Python Scrapling-based scraper
 * Uses Python for anti-bot bypass, Node.js for database integration
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface AirbnbListing {
  platform: string;
  platform_id: string;
  scraped_at: string;
  url?: string;
  title?: string;
  price?: number;
  rating?: number;
  photos?: string[];
  property_type?: string;
  neighborhood?: string;
  city?: string;
}

export class AirbnbPythonScraper {
  platform: Platform = 'airbnb';
  private supabase: SupabaseClient;
  private pythonScript: string;
  private pythonPath: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Path to Python script
    this.pythonScript = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../python/airbnb_scraper.py'
    );

    // Use Python 3.11 from venv
    this.pythonPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../venv/bin/python'
    );
  }

  /**
   * Run the Python scraper and get listings
   */
  async scrape(job: ScrapeJob): Promise<ScrapedListing[]> {
    const city = job.targetParams?.city || 'Dakar';
    const maxPages = job.targetParams?.maxPages || 3;

    console.log(`[Airbnb] Starting Python scraper for ${city}, ${maxPages} pages...`);

    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScript,
        'airbnb',
        '--city', city,
        '--pages', maxPages.toString(),
        '--json-stdout'
      ];

      const pythonProcess = spawn(this.pythonPath, args, {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        // Log progress messages (they go to stderr)
        const message = data.toString();
        process.stderr.write(message);
        stderr += message;
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error(`[Airbnb] Python process exited with code ${code}`);
          console.error(`[Airbnb] stderr: ${stderr}`);
          reject(new Error(`Python scraper failed with code ${code}`));
          return;
        }

        try {
          // Parse JSON output
          const listings: AirbnbListing[] = JSON.parse(stdout);
          console.log(`[Airbnb] Received ${listings.length} listings from Python`);

          // Convert to ScrapedListing format
          const scrapedListings = listings.map(l => this.convertListing(l));

          resolve(scrapedListings);
        } catch (e) {
          console.error(`[Airbnb] Failed to parse Python output: ${e}`);
          console.error(`[Airbnb] stdout was: ${stdout.substring(0, 500)}...`);
          reject(e);
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`[Airbnb] Failed to start Python process: ${err}`);
        reject(err);
      });
    });
  }

  /**
   * Convert Python listing format to ScrapedListing
   */
  private convertListing(listing: AirbnbListing): ScrapedListing {
    return {
      platform: 'airbnb',
      platformId: listing.platform_id,
      url: listing.url || `https://airbnb.com/rooms/${listing.platform_id}`,
      title: listing.title,
      pricePerNight: listing.price,
      currency: 'USD', // Airbnb defaults to USD
      photos: listing.photos || [],
      rating: listing.rating,
      city: listing.city || 'Dakar',
      neighborhood: listing.neighborhood,
      rawData: {
        property_type: listing.property_type,
        scraped_at: listing.scraped_at,
      }
    };
  }

  /**
   * Save listings to database
   */
  async saveListings(listings: ScrapedListing[]): Promise<number> {
    let savedCount = 0;

    for (const listing of listings) {
      try {
        const { error } = await this.supabase
          .from('scraped_listings')
          .upsert({
            platform: listing.platform,
            platform_id: listing.platformId,
            url: listing.url,
            title: listing.title,
            price: listing.pricePerNight,
            currency: listing.currency || 'USD',
            location_text: listing.neighborhood,
            city: listing.city || 'Dakar',
            photos: listing.photos,
            rating: listing.rating,
            raw_data: listing.rawData,
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'platform,platform_id',
          });

        if (error) {
          console.warn(`[Airbnb] Save error for ${listing.platformId}: ${error.message}`);
        } else {
          savedCount++;
        }
      } catch (e) {
        console.error(`[Airbnb] Exception saving ${listing.platformId}: ${e}`);
      }
    }

    console.log(`[Airbnb] Saved ${savedCount}/${listings.length} listings to database`);
    return savedCount;
  }

  /**
   * Full scrape and save pipeline
   */
  async scrapeAndSave(job: ScrapeJob): Promise<number> {
    const listings = await this.scrape(job);
    return this.saveListings(listings);
  }
}
