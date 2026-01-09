/**
 * Scraper Service
 * Main orchestration service for scraping and matching operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createScraper, SUPPORTED_PLATFORMS } from './scrapers/index.js';
import { ExpatDakarFetchScraper } from './scrapers/expat-dakar-fetch.js';
import { ListingMatcher } from './matcher.js';
import { ScrapedListing, ScrapeJob, Platform, MarketMetrics } from './types.js';

export class ScraperService {
  private supabase: SupabaseClient;
  private matcher: ListingMatcher;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.matcher = new ListingMatcher();
  }

  /**
   * Create and execute a scrape job
   */
  async runScrapeJob(job: Omit<ScrapeJob, 'status'>): Promise<ScrapeJob> {
    // Create job record
    const { data: jobRecord, error: jobError } = await this.supabase
      .from('scrape_jobs')
      .insert({
        platform: job.platform,
        job_type: job.jobType,
        target_params: job.targetParams,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating scrape job:', jobError);
      throw jobError;
    }

    console.log(`[ScraperService] Starting job ${jobRecord.id} for ${job.platform}`);

    try {
      let listings: ScrapedListing[];

      // Use fetch-based scraper for expat_dakar (avoids Cloudflare blocking)
      if (job.platform === 'expat_dakar') {
        const fetchScraper = new ExpatDakarFetchScraper();
        listings = await fetchScraper.scrape({
          ...job,
          status: 'running',
          id: jobRecord.id,
        });
      } else {
        // Use Puppeteer-based scraper for other platforms
        const scraper = createScraper(job.platform);
        listings = await scraper.scrape({
          ...job,
          status: 'running',
          id: jobRecord.id,
        });
        await scraper.close();
      }

      console.log(`[ScraperService] Scraped ${listings.length} listings`);

      // Save listings and run matching
      const stats = await this.saveAndMatchListings(listings);

      // Update job record
      await this.supabase
        .from('scrape_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          listings_found: listings.length,
          listings_new: stats.new,
          listings_updated: stats.updated,
        })
        .eq('id', jobRecord.id);

      return {
        ...job,
        id: jobRecord.id,
        status: 'completed',
        startedAt: new Date(jobRecord.started_at),
        completedAt: new Date(),
        listingsFound: listings.length,
        listingsNew: stats.new,
        listingsUpdated: stats.updated,
      };
    } catch (error) {
      // Update job as failed
      await this.supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobRecord.id);

      throw error;
    }
  }

  /**
   * Save scraped listings and run matching algorithm
   */
  private async saveAndMatchListings(
    listings: ScrapedListing[]
  ): Promise<{ new: number; updated: number }> {
    let newCount = 0;
    let updatedCount = 0;

    for (const listing of listings) {
      // Check if listing already exists
      const { data: existing } = await this.supabase
        .from('scraped_listings')
        .select('id')
        .eq('platform', listing.platform)
        .eq('platform_id', listing.platformId)
        .single();

      // Save ALL listing data
      const listingData = {
        platform: listing.platform,
        platform_id: listing.platformId,
        url: listing.url,
        title: listing.title,
        description: listing.description,
        price: listing.pricePerNight,
        currency: listing.currency || 'XOF',
        location_text: listing.locationText,
        city: listing.city || 'Dakar',
        latitude: listing.latitude,
        longitude: listing.longitude,
        host_name: listing.hostName,
        host_id: listing.hostId,
        num_rooms: listing.bedrooms,
        num_guests: listing.maxGuests,
        photos: listing.photos,
        amenities: listing.amenities,
        rating: listing.rating,
        num_reviews: listing.reviewCount,
        raw_data: {
          ...listing.rawData,
          neighborhood: listing.neighborhood,
          bathrooms: listing.bathrooms,
          hostProfileUrl: listing.hostProfileUrl,
        },
        last_seen_at: new Date().toISOString(),
      };

      let savedListingId: string;

      if (existing) {
        // Update existing listing
        const { error } = await this.supabase
          .from('scraped_listings')
          .update(listingData)
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating listing:', error);
          continue;
        }

        savedListingId = existing.id;
        updatedCount++;
      } else {
        // Insert new listing
        const { data: newListing, error } = await this.supabase
          .from('scraped_listings')
          .insert(listingData)
          .select('id')
          .single();

        if (error) {
          console.error('Error inserting listing:', error);
          continue;
        }

        savedListingId = newListing.id;
        newCount++;

        // Run matching for new listings only
        console.log(`[ScraperService] Running match for listing ${savedListingId}`);
        const matches = await this.matcher.findMatches(listing);
        await this.matcher.saveMatchResults(savedListingId, matches);
      }
    }

    return { new: newCount, updated: updatedCount };
  }

  /**
   * Mark listings not seen in recent scrapes as inactive
   */
  async markInactiveListings(platform: Platform, olderThan: Date): Promise<number> {
    const { data, error } = await this.supabase
      .from('scraped_listings')
      .update({ is_active: false })
      .eq('platform', platform)
      .lt('last_seen_at', olderThan.toISOString())
      .eq('is_active', true)
      .select('id');

    if (error) {
      console.error('Error marking inactive listings:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get unmatched/unregistered listings
   */
  async getUnregisteredListings(options: {
    city?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query = this.supabase
      .from('scraped_listings')
      .select(
        `
        *,
        listing_matches!left (
          match_type,
          match_score,
          status
        )
      `
      )
      .eq('is_active', true);

    if (options.city) {
      query = query.eq('city', options.city);
    }

    const { data, error } = await query
      .order('first_seen_at', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

    if (error) {
      console.error('Error fetching unregistered listings:', error);
      return [];
    }

    // Filter to only unmatched listings
    return (data || []).filter((listing) => {
      const matches = listing.listing_matches || [];
      return (
        matches.length === 0 ||
        matches.every(
          (m: any) => m.match_type === 'no_match' || m.status === 'verified_different'
        )
      );
    });
  }

  /**
   * Generate market intelligence metrics
   */
  async generateMarketIntelligence(
    city: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<MarketMetrics> {
    // Get scraped listings
    const { data: scrapedListings, error: scrapedError } = await this.supabase
      .from('scraped_listings')
      .select('*')
      .eq('city', city)
      .eq('is_active', true);

    if (scrapedError) {
      console.error('Error fetching scraped listings:', scrapedError);
      throw scrapedError;
    }

    // Get registered properties
    const { data: registeredProps, error: registeredError } = await this.supabase
      .from('properties')
      .select('id')
      .eq('city', city)
      .eq('status', 'active');

    if (registeredError) {
      console.error('Error fetching registered properties:', registeredError);
      throw registeredError;
    }

    // Get matched listings
    const { data: matchedListings, error: matchedError } = await this.supabase
      .from('listing_matches')
      .select('scraped_listing_id')
      .in('match_type', ['exact', 'probable'])
      .in('status', ['pending', 'verified_match']);

    if (matchedError) {
      console.error('Error fetching matched listings:', matchedError);
      throw matchedError;
    }

    const listings = scrapedListings || [];
    const matchedIds = new Set((matchedListings || []).map((m) => m.scraped_listing_id));

    // Calculate metrics
    const prices = listings.map((l) => l.price_per_night).filter((p) => p && p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    const propertyTypes: Record<string, number> = {};
    const platformDistribution: Record<string, number> = {};

    for (const listing of listings) {
      // Property types
      const type = listing.property_type || 'other';
      propertyTypes[type] = (propertyTypes[type] || 0) + 1;

      // Platform distribution
      platformDistribution[listing.platform] = (platformDistribution[listing.platform] || 0) + 1;
    }

    // Count new listings in period
    const newListings = listings.filter(
      (l) =>
        new Date(l.first_seen_at) >= periodStart && new Date(l.first_seen_at) <= periodEnd
    ).length;

    const metrics: MarketMetrics = {
      totalListings: listings.length,
      registeredListings: registeredProps?.length || 0,
      complianceRate:
        listings.length > 0 ? matchedIds.size / listings.length : 1,
      avgPrice: Math.round(avgPrice),
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
      propertyTypes: propertyTypes as any,
      newListings,
      removedListings: 0, // Would need historical data
      platformDistribution: platformDistribution as any,
    };

    // Save to database
    await this.supabase.from('market_intelligence').upsert({
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      city,
      metrics,
    });

    return metrics;
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): Platform[] {
    return SUPPORTED_PLATFORMS;
  }
}
