#!/usr/bin/env node
/**
 * Scraper CLI
 * Command-line interface for running scrape jobs
 */

import 'dotenv/config';
import { ScraperService } from './service.js';
import { Platform } from './types.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const service = new ScraperService();

  switch (command) {
    case 'scrape': {
      const platform = args[1] as Platform;
      const city = args[2] || 'Dakar';
      const maxPages = parseInt(args[3] || '3', 10);

      if (!platform) {
        console.log('Usage: npm run scrape <platform> [city] [maxPages]');
        console.log(`Supported platforms: ${service.getSupportedPlatforms().join(', ')}`);
        process.exit(1);
      }

      console.log(`Starting scrape job for ${platform} in ${city}...`);

      try {
        const result = await service.runScrapeJob({
          platform,
          jobType: 'full_scan',
          targetParams: {
            city,
            maxPages,
          },
        });

        console.log('
Scrape job completed!');
        console.log(`- Listings found: ${result.listingsFound}`);
        console.log(`- New listings: ${result.listingsNew}`);
        console.log(`- Updated listings: ${result.listingsUpdated}`);
      } catch (error) {
        console.error('Scrape job failed:', error);
        process.exit(1);
      }
      break;
    }

    case 'unregistered': {
      const city = args[1] || 'Dakar';
      const limit = parseInt(args[2] || '20', 10);

      console.log(`Fetching unregistered listings in ${city}...`);

      try {
        const listings = await service.getUnregisteredListings({ city, limit });

        console.log(`
Found ${listings.length} potentially unregistered listings:
`);

        for (const listing of listings) {
          console.log(`- ${listing.title || 'No title'}`);
          console.log(`  Platform: ${listing.platform}`);
          console.log(`  URL: ${listing.url}`);
          console.log(`  Location: ${listing.location_text || listing.neighborhood || 'Unknown'}`);
          console.log(`  Price: ${listing.price_per_night?.toLocaleString()} ${listing.currency}/night`);
          console.log(`  Host: ${listing.host_name || 'Unknown'}`);
          console.log(`  First seen: ${new Date(listing.first_seen_at).toLocaleDateString()}`);
          console.log('');
        }
      } catch (error) {
        console.error('Error fetching listings:', error);
        process.exit(1);
      }
      break;
    }

    case 'metrics': {
      const city = args[1] || 'Dakar';

      console.log(`Generating market intelligence for ${city}...`);

      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        const metrics = await service.generateMarketIntelligence(city, startDate, endDate);

        console.log('
Market Intelligence Report');
        console.log('==========================');
        console.log(`City: ${city}`);
        console.log(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        console.log('');
        console.log(`Total Online Listings: ${metrics.totalListings}`);
        console.log(`Registered Properties: ${metrics.registeredListings}`);
        console.log(`Compliance Rate: ${(metrics.complianceRate * 100).toFixed(1)}%`);
        console.log('');
        console.log(`Average Price: ${metrics.avgPrice.toLocaleString()} FCFA/night`);
        console.log(`Price Range: ${metrics.priceRange.min.toLocaleString()} - ${metrics.priceRange.max.toLocaleString()} FCFA`);
        console.log('');
        console.log('Property Types:');
        for (const [type, count] of Object.entries(metrics.propertyTypes)) {
          console.log(`  ${type}: ${count}`);
        }
        console.log('');
        console.log('Platform Distribution:');
        for (const [platform, count] of Object.entries(metrics.platformDistribution)) {
          console.log(`  ${platform}: ${count}`);
        }
        console.log('');
        console.log(`New Listings This Period: ${metrics.newListings}`);
      } catch (error) {
        console.error('Error generating metrics:', error);
        process.exit(1);
      }
      break;
    }

    case 'cleanup': {
      const platform = args[1] as Platform;
      const days = parseInt(args[2] || '7', 10);

      if (!platform) {
        console.log('Usage: npm run scrape cleanup <platform> [days]');
        process.exit(1);
      }

      console.log(`Marking listings not seen in ${days} days as inactive...`);

      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const count = await service.markInactiveListings(platform, cutoff);
        console.log(`Marked ${count} listings as inactive.`);
      } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Teranga Safe - Scraper Service CLI');
      console.log('===================================
');
      console.log('Commands:');
      console.log('  scrape <platform> [city] [maxPages]  - Run a scrape job');
      console.log('  unregistered [city] [limit]          - List potentially unregistered properties');
      console.log('  metrics [city]                       - Generate market intelligence report');
      console.log('  cleanup <platform> [days]            - Mark old listings as inactive');
      console.log('');
      console.log(`Supported platforms: ${service.getSupportedPlatforms().join(', ')}`);
  }
}

main().catch(console.error);
