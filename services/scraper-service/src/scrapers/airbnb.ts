/**
 * Airbnb Scraper
 * Scrapes Airbnb listings for Senegal
 */

import { Page } from 'puppeteer';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class AirbnbScraper extends BaseScraper {
  platform: Platform = 'airbnb';
  baseUrl = 'https://www.airbnb.com';

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    const searchParams = new URLSearchParams();

    // Default to Senegal
    const location = params.city || 'Dakar, Senegal';
    searchParams.set('query', location);

    // Add dates if specified
    if (params.checkIn) {
      searchParams.set('checkin', params.checkIn);
    }
    if (params.checkOut) {
      searchParams.set('checkout', params.checkOut);
    }

    // Add guest count
    if (params.guests) {
      searchParams.set('adults', params.guests.toString());
    }

    // Add price range
    if (params.minPrice) {
      searchParams.set('price_min', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('price_max', params.maxPrice.toString());
    }

    return `${this.baseUrl}/s/${encodeURIComponent(location)}/homes?${searchParams.toString()}`;
  }

  protected async waitForListings(page: Page): Promise<void> {
    try {
      await page.waitForSelector('[itemprop="itemListElement"]', { timeout: 15000 });
    } catch {
      // Try alternative selector
      await page.waitForSelector('[data-testid="card-container"]', { timeout: 10000 });
    }
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      const nextButton = await page.$('a[aria-label="Next"]');
      if (nextButton) {
        await nextButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        return true;
      }
    } catch (error) {
      console.log('[airbnb] No more pages or navigation error');
    }
    return false;
  }

  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      // Get all listing cards
      const cards = await page.$$('[itemprop="itemListElement"], [data-testid="card-container"]');

      for (const card of cards) {
        try {
          const listing: Partial<ScrapedListing> = {
            platform: 'airbnb',
          };

          // Get URL
          const linkElement = await card.$('a[href*="/rooms/"]');
          if (linkElement) {
            const href = await linkElement.evaluate(el => el.getAttribute('href'));
            if (href) {
              listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
              // Extract platform ID from URL
              const idMatch = href.match(/\/rooms\/(\d+)/);
              if (idMatch) {
                listing.platformId = idMatch[1];
              }
            }
          }

          // Get title
          const titleElement = await card.$('[data-testid="listing-card-title"], [id*="title"]');
          if (titleElement) {
            listing.title = await titleElement.evaluate(el => el.textContent?.trim());
          }

          // Get price
          const priceElement = await card.$('span[class*="price"], [data-testid*="price"]');
          if (priceElement) {
            const priceText = await priceElement.evaluate(el => el.textContent?.trim());
            if (priceText) {
              listing.pricePerNight = this.parsePrice(priceText);
              // Detect currency
              if (priceText.includes('FCFA') || priceText.includes('XOF')) {
                listing.currency = 'XOF';
              } else if (priceText.includes('$')) {
                listing.currency = 'USD';
              } else if (priceText.includes('EUR') || priceText.includes('€')) {
                listing.currency = 'EUR';
              }
            }
          }

          // Get rating
          const ratingElement = await card.$('span[class*="rating"]');
          if (ratingElement) {
            const ratingText = await ratingElement.evaluate(el => el.textContent?.trim());
            if (ratingText) {
              const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
              if (ratingMatch) {
                listing.rating = parseFloat(ratingMatch[1]);
              }
            }
          }

          // Get property type and details
          const subtitleElement = await card.$('[data-testid="listing-card-subtitle"]');
          if (subtitleElement) {
            const subtitle = await subtitleElement.evaluate(el => el.textContent?.trim());
            if (subtitle) {
              listing.propertyType = this.detectPropertyType(subtitle);

              // Try to extract bedroom count
              const bedroomMatch = subtitle.match(/(\d+)\s*(?:chambre|bedroom|bed)/i);
              if (bedroomMatch) {
                listing.bedrooms = parseInt(bedroomMatch[1], 10);
              }

              // Try to extract guest count
              const guestMatch = subtitle.match(/(\d+)\s*(?:voyageur|guest|personne)/i);
              if (guestMatch) {
                listing.maxGuests = parseInt(guestMatch[1], 10);
              }
            }
          }

          // Get first photo
          const imageElement = await card.$('img[src*="airbnbstatic"]');
          if (imageElement) {
            const src = await imageElement.evaluate(el => el.getAttribute('src'));
            if (src) {
              listing.photos = [src];
            }
          }

          if (listing.url && listing.platformId) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[airbnb] Error parsing listing card:', error);
        }
      }
    } catch (error) {
      console.error('[airbnb] Error parsing search results:', error);
    }

    return listings;
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);

      // Wait for content to load
      await detailPage.waitForSelector('h1', { timeout: 10000 });

      // Extract listing ID from URL
      const idMatch = listingUrl.match(/\/rooms\/(\d+)/);
      const platformId = idMatch ? idMatch[1] : listingUrl;

      // Get title
      const title = await detailPage.$eval('h1', el => el.textContent?.trim()).catch(() => undefined);

      // Get description
      const description = await detailPage.$eval(
        '[data-section-id="DESCRIPTION_DEFAULT"] span, [data-section-id="DESCRIPTION_MODAL"] span',
        el => el.textContent?.trim()
      ).catch(() => undefined);

      // Get location
      const locationText = await detailPage.$eval(
        '[data-section-id="LOCATION_DEFAULT"] button span, a[href*="maps"]',
        el => el.textContent?.trim()
      ).catch(() => undefined);

      // Parse city/neighborhood from location
      let city: string | undefined;
      let neighborhood: string | undefined;
      if (locationText) {
        const parts = locationText.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          neighborhood = parts[0];
          city = parts[1];
        } else {
          city = parts[0];
        }
      }

      // Get coordinates from page data or map
      let latitude: number | undefined;
      let longitude: number | undefined;

      // Try to get from script tags
      const scripts = await detailPage.$$eval('script[type="application/json"]', scripts =>
        scripts.map(s => s.textContent)
      );

      for (const script of scripts) {
        if (script) {
          try {
            const data = JSON.parse(script);
            // Search for lat/lng in the data structure
            const findCoords = (obj: any): { lat?: number; lng?: number } | null => {
              if (!obj || typeof obj !== 'object') return null;
              if ('lat' in obj && 'lng' in obj) {
                return { lat: obj.lat, lng: obj.lng };
              }
              if ('latitude' in obj && 'longitude' in obj) {
                return { lat: obj.latitude, lng: obj.longitude };
              }
              for (const value of Object.values(obj)) {
                const found = findCoords(value);
                if (found) return found;
              }
              return null;
            };
            const coords = findCoords(data);
            if (coords) {
              latitude = coords.lat;
              longitude = coords.lng;
            }
          } catch {
            // Not JSON or parsing error
          }
        }
      }

      // Get host info
      const hostName = await detailPage.$eval(
        '[data-section-id="HOST_PROFILE_DEFAULT"] h2, [class*="host"] h2',
        el => el.textContent?.replace(/^Hosted by\s*/i, '').trim()
      ).catch(() => undefined);

      // Get price
      const priceText = await detailPage.$eval(
        'span[class*="_tyxjp1"], [data-testid="price-element"]',
        el => el.textContent?.trim()
      ).catch(() => '');
      const pricePerNight = this.parsePrice(priceText);

      // Get amenities
      const amenities = await detailPage.$$eval(
        '[data-section-id="AMENITIES_DEFAULT"] button span',
        elements => elements.map(el => el.textContent?.trim()).filter(Boolean) as string[]
      ).catch(() => []);

      // Get photos
      const photos = await detailPage.$$eval(
        'img[src*="airbnbstatic"][class*="photo"], picture img[src*="airbnb"]',
        imgs => imgs.map(img => img.getAttribute('src')).filter(Boolean).slice(0, 10) as string[]
      ).catch(() => []);

      // Get details (bedrooms, bathrooms, guests)
      const detailsText = await detailPage.$eval(
        'ol[class*="lgx66tx"]',
        el => el.textContent
      ).catch(() => '');

      const bedroomMatch = detailsText.match(/(\d+)\s*(?:chambre|bedroom)/i);
      const bathroomMatch = detailsText.match(/(\d+)\s*(?:salle de bain|bathroom)/i);
      const guestMatch = detailsText.match(/(\d+)\s*(?:voyageur|guest)/i);

      // Get rating and reviews
      const ratingText = await detailPage.$eval(
        '[class*="rating"] span, [data-testid="pdp-reviews-highlight-banner-host-rating"]',
        el => el.textContent?.trim()
      ).catch(() => '');
      const ratingMatch = ratingText.match(/(\d+\.?\d*)/);

      const reviewText = await detailPage.$eval(
        '[class*="rating"] button, [class*="reviews"]',
        el => el.textContent?.trim()
      ).catch(() => '');
      const reviewMatch = reviewText.match(/(\d+)\s*(?:avis|review)/i);

      // Determine property type
      const propertyType = this.detectPropertyType(title || description || '');

      return {
        platform: 'airbnb',
        platformId,
        url: listingUrl,
        title,
        description,
        locationText,
        city,
        neighborhood,
        latitude,
        longitude,
        hostName,
        pricePerNight,
        currency: 'XOF',
        propertyType,
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
        maxGuests: guestMatch ? parseInt(guestMatch[1], 10) : undefined,
        amenities,
        photos,
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
        reviewCount: reviewMatch ? parseInt(reviewMatch[1], 10) : undefined,
        rawData: {
          detailsText,
          ratingText,
          reviewText,
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await detailPage.close();
    }
  }
}
