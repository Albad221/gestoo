/**
 * Booking.com Scraper
 * Scrapes vacation rental and apartment listings from Booking.com for Senegal
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class BookingScraper extends BaseScraper {
  platform: Platform = 'booking';
  baseUrl = 'https://www.booking.com';

  constructor() {
    super({
      platform: 'booking',
      rateLimit: 8, // Lower rate limit to avoid blocks
      maxConcurrent: 1, // Sequential requests to be safer
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  /**
   * Map Senegalese cities to Booking.com destination IDs
   */
  private getDestinationId(city: string): string {
    const destinationMap: Record<string, string> = {
      dakar: '-2271854',
      'saint-louis': '-2280036',
      saly: '-2279538',
      mbour: '-2275689',
      'cap skirring': '-2269855',
      ziguinchor: '-2282912',
      thies: '-2281143',
      senegal: '-2271854', // Default to Dakar for country-wide
    };
    return destinationMap[city.toLowerCase()] || destinationMap['dakar'];
  }

  /**
   * Build Booking.com search URL for apartments/vacation rentals in Senegal
   */
  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    const searchParams = new URLSearchParams();

    // Set destination (default to Senegal/Dakar)
    const city = params.city || 'Senegal';
    searchParams.set('ss', city);
    searchParams.set('dest_id', this.getDestinationId(city));
    searchParams.set('dest_type', 'city');

    // Set dates (default to next month for 7 days)
    const today = new Date();
    const checkIn = params.checkIn || this.formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
    const checkOut = params.checkOut || this.formatDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000));

    searchParams.set('checkin', checkIn);
    searchParams.set('checkout', checkOut);

    // Guests
    searchParams.set('group_adults', (params.guests || 2).toString());
    searchParams.set('no_rooms', '1');
    searchParams.set('group_children', '0');

    // Filter for apartments and vacation rentals (nflt parameter)
    // ht_id=201 = Apartments, ht_id=220 = Vacation Homes
    searchParams.set('nflt', 'ht_id=201;ht_id=220');

    // Price range if specified
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      const minPrice = params.minPrice || 0;
      const maxPrice = params.maxPrice || 999999;
      // Convert XOF to EUR approximately (1 EUR ~ 656 XOF)
      const minPriceEur = Math.floor(minPrice / 656);
      const maxPriceEur = Math.ceil(maxPrice / 656);
      searchParams.set('price_filter_currencycode', 'EUR');
      searchParams.set('price_min', minPriceEur.toString());
      searchParams.set('price_max', maxPriceEur.toString());
    }

    // Sort by popularity
    searchParams.set('order', 'popularity');

    // Set language to French (common in Senegal)
    searchParams.set('lang', 'fr');
    searchParams.set('selected_currency', 'XOF');

    return `${this.baseUrl}/searchresults.fr.html?${searchParams.toString()}`;
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Override dismissPopups for Booking.com specific modals
   */
  protected async dismissPopups(page: Page): Promise<void> {
    try {
      // Booking.com cookie consent
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        '[data-testid="accept-btn"]',
        'button[aria-label*="Accept"]',
        '.bui-button--secondary[type="submit"]',
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
          // Continue
        }
      }

      // Close any dismissible banners
      const dismissSelectors = [
        '[data-testid="header-close-button"]',
        'button[aria-label="Dismiss"]',
        '.bui-modal__close',
        '[data-dismiss="modal"]',
      ];

      for (const selector of dismissSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await this.randomDelay(300, 500);
          }
        } catch {
          // Continue
        }
      }

      // Close sign-in popup if present
      try {
        const signInClose = await page.$('[aria-label="Fermer la fenêtre de connexion"]');
        if (signInClose) {
          await signInClose.click();
          await this.randomDelay(300, 500);
        }
      } catch {
        // Ignore
      }
    } catch {
      // Ignore popup dismissal errors
    }
  }

  /**
   * Wait for listings to load on search results page
   */
  protected async waitForListings(page: Page): Promise<void> {
    try {
      // Primary selector for property cards
      await page.waitForSelector('[data-testid="property-card"]', { timeout: 15000 });
    } catch {
      // Fallback selectors
      try {
        await page.waitForSelector('.sr_property_block, .hotel_list_item', { timeout: 10000 });
      } catch {
        console.log('[booking] No listings found on page');
      }
    }
  }

  /**
   * Navigate to next page of results
   */
  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      // Booking.com uses offset-based pagination
      const nextButton = await page.$(
        'button[aria-label="Page suivante"], a[aria-label="Next page"], [data-testid="pagination-next"]'
      );

      if (nextButton) {
        const isDisabled = await nextButton.evaluate((el) => {
          return el.hasAttribute('disabled') || el.classList.contains('disabled');
        });

        if (!isDisabled) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomDelay(2000, 4000); // Extra delay for Booking.com
          return true;
        }
      }
    } catch (error) {
      console.log('[booking] No more pages or navigation error');
    }
    return false;
  }

  /**
   * Parse search results page and extract listing cards
   */
  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      // Wait for any dynamic content
      await this.randomDelay(1000, 2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      // Select property cards
      $('[data-testid="property-card"], .sr_property_block, .hotel_list_item').each((_, element) => {
        try {
          const listing: Partial<ScrapedListing> = {
            platform: 'booking',
          };

          // Get URL and extract property ID
          const linkElement = $(element).find('a[data-testid="title-link"], a.hotel_name_link, a[href*="/hotel/"]').first();
          const href = linkElement.attr('href');

          if (href) {
            // Clean URL (remove tracking params)
            const url = new URL(href, this.baseUrl);
            url.searchParams.delete('aid');
            url.searchParams.delete('dest_id');
            url.searchParams.delete('dest_type');
            listing.url = url.toString();

            // Extract property ID from URL
            const idMatch = href.match(/\/hotel\/sn\/([^/?#]+)/);
            if (idMatch) {
              listing.platformId = idMatch[1];
            } else {
              // Try alternative ID extraction
              const altMatch = href.match(/hotel_id=(\d+)/);
              if (altMatch) {
                listing.platformId = altMatch[1];
              }
            }
          }

          // Get title
          const titleElement = $(element).find(
            '[data-testid="title"], .sr-hotel__name, h3, .hotel_name_link span'
          ).first();
          listing.title = titleElement.text().trim();

          // Get price
          const priceElement = $(element).find(
            '[data-testid="price-and-discounted-price"], .bui-price-display__value, .prco-valign-middle-helper, .price'
          ).first();
          const priceText = priceElement.text().trim();
          listing.pricePerNight = this.parsePrice(priceText);

          // Detect currency
          if (priceText.includes('FCFA') || priceText.includes('XOF') || priceText.includes('CFA')) {
            listing.currency = 'XOF';
          } else if (priceText.includes('EUR') || priceText.includes('€')) {
            listing.currency = 'EUR';
          } else if (priceText.includes('$') || priceText.includes('USD')) {
            listing.currency = 'USD';
          } else {
            listing.currency = 'XOF'; // Default for Senegal
          }

          // Get location
          const locationElement = $(element).find(
            '[data-testid="address"], .sr_card_address_line, .bui-card__subtitle'
          ).first();
          listing.locationText = locationElement.text().trim();

          if (listing.locationText) {
            const parts = listing.locationText.split(',').map((p) => p.trim());
            if (parts.length >= 2) {
              listing.neighborhood = parts[0];
              listing.city = parts[1];
            } else if (parts.length === 1) {
              listing.city = parts[0];
            }
          }

          // Get rating
          const ratingElement = $(element).find(
            '[data-testid="review-score"] > div:first-child, .bui-review-score__badge, .review-score-badge'
          ).first();
          const ratingText = ratingElement.text().trim();
          if (ratingText) {
            const ratingMatch = ratingText.match(/(\d+[.,]?\d*)/);
            if (ratingMatch) {
              // Booking uses 10-point scale, normalize to 5
              const rating = parseFloat(ratingMatch[1].replace(',', '.'));
              listing.rating = rating > 5 ? rating / 2 : rating;
            }
          }

          // Get review count
          const reviewCountElement = $(element).find(
            '[data-testid="review-score"] > div:last-child, .bui-review-score__text, .review-score-widget__subtext'
          ).first();
          const reviewText = reviewCountElement.text().trim();
          if (reviewText) {
            const reviewMatch = reviewText.match(/(\d[\d\s]*)/);
            if (reviewMatch) {
              listing.reviewCount = parseInt(reviewMatch[1].replace(/\s/g, ''), 10);
            }
          }

          // Get property type from subtitle/tags
          const propertyTypeElement = $(element).find(
            '[data-testid="recommended-units"], .room_link, .sr_room_type'
          ).first();
          const propertyTypeText = propertyTypeElement.text().toLowerCase();

          if (propertyTypeText) {
            listing.propertyType = this.detectPropertyType(propertyTypeText);
          } else if (listing.title) {
            listing.propertyType = this.detectPropertyType(listing.title);
          }

          // Get first image
          const imgElement = $(element).find('img[data-testid="image"], img.hotel_image, .sr_item_photo_link img').first();
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
          if (imgSrc && !imgSrc.includes('data:image')) {
            listing.photos = [imgSrc];
          }

          // Only add if we have essential data
          if (listing.url && listing.platformId && listing.title) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[booking] Error parsing listing card:', error);
        }
      });
    } catch (error) {
      console.error('[booking] Error parsing search results:', error);
    }

    return listings;
  }

  /**
   * Parse full listing details from property page
   */
  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      // Add extra headers to avoid detection
      await detailPage.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      });

      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);

      // Wait for content
      await detailPage.waitForSelector('h2, #hp_hotel_name', { timeout: 15000 }).catch(() => {});
      await this.randomDelay(1000, 2000);

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract platform ID from URL
      const idMatch = listingUrl.match(/\/hotel\/sn\/([^/?#]+)/);
      const platformId = idMatch ? idMatch[1] : listingUrl;

      // Get title
      const title =
        $('h2.pp-header__title, #hp_hotel_name, .hp__hotel-name').first().text().trim() ||
        $('h1').first().text().trim();

      // Get description
      const description = $(
        '[data-testid="property-description"], #property_description_content, .hotel-description-content'
      )
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 2000); // Limit description length

      // Get location
      const locationText = $(
        '[data-testid="address"], .hp_address_subtitle, .jq_tooltip.loc_block_link_underline_fix'
      )
        .first()
        .text()
        .trim();

      let city: string | undefined;
      let neighborhood: string | undefined;
      if (locationText) {
        const parts = locationText.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          neighborhood = parts[0];
          city = parts[1];
        } else {
          city = parts[0];
        }
      }

      // Get coordinates from map or data attributes
      let latitude: number | undefined;
      let longitude: number | undefined;

      // Try to extract from page data
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const content = $(script).html() || '';
        if (content.includes('booking.env.b_map_center_latitude')) {
          const latMatch = content.match(/b_map_center_latitude\s*[=:]\s*['"]?(-?\d+\.?\d*)['"]?/);
          const lngMatch = content.match(/b_map_center_longitude\s*[=:]\s*['"]?(-?\d+\.?\d*)['"]?/);
          if (latMatch && lngMatch) {
            latitude = parseFloat(latMatch[1]);
            longitude = parseFloat(lngMatch[1]);
          }
        }
        // Alternative JSON-LD extraction
        if (content.includes('"geo"') || content.includes('"latitude"')) {
          try {
            const jsonMatch = content.match(/\{[^{}]*"latitude"\s*:\s*(-?\d+\.?\d*)[^{}]*"longitude"\s*:\s*(-?\d+\.?\d*)/);
            if (jsonMatch) {
              latitude = parseFloat(jsonMatch[1]);
              longitude = parseFloat(jsonMatch[2]);
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }

      // Get price
      const priceElement = $(
        '[data-testid="price-and-discounted-price"], .bui-price-display__value, .prco-valign-middle-helper'
      ).first();
      const priceText = priceElement.text().trim();
      const pricePerNight = this.parsePrice(priceText);

      // Determine currency
      let currency: string = 'XOF';
      if (priceText.includes('EUR') || priceText.includes('€')) {
        currency = 'EUR';
      } else if (priceText.includes('$') || priceText.includes('USD')) {
        currency = 'USD';
      }

      // Get rating
      let rating: number | undefined;
      const ratingElement = $(
        '[data-testid="review-score-component"], .review-score-badge, .bui-review-score__badge'
      ).first();
      const ratingText = ratingElement.text().trim();
      if (ratingText) {
        const ratingMatch = ratingText.match(/(\d+[.,]?\d*)/);
        if (ratingMatch) {
          const rawRating = parseFloat(ratingMatch[1].replace(',', '.'));
          // Normalize 10-point scale to 5-point
          rating = rawRating > 5 ? rawRating / 2 : rawRating;
        }
      }

      // Get review count
      let reviewCount: number | undefined;
      const reviewCountElement = $(
        '[data-testid="review-score-right-component"] > div:last-child, .bui-review-score__text'
      ).first();
      const reviewCountText = reviewCountElement.text().trim();
      if (reviewCountText) {
        const reviewMatch = reviewCountText.match(/(\d[\d\s]*)/);
        if (reviewMatch) {
          reviewCount = parseInt(reviewMatch[1].replace(/\s/g, ''), 10);
        }
      }

      // Get amenities/facilities
      const amenities: string[] = [];
      $(
        '[data-testid="property-most-popular-facilities-wrapper"] li, .hp_desc_important_facilities li, .facilitiesChecklist li, [data-testid="facility-group-icon-row"]'
      ).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 100) {
          amenities.push(text);
        }
      });

      // Also check for individual facility items
      $('[data-testid="facility-list-item"], .bui-list__item').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 100 && !amenities.includes(text)) {
          amenities.push(text);
        }
      });

      // Get photos
      const photos: string[] = [];
      $(
        '[data-testid="gallery-image"] img, .bh-photo-grid img, .hotel_image, #photo_wrapper img, .hp-gallery img'
      ).each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src && !src.includes('data:image') && !src.includes('placeholder')) {
          // Get high-res version if available
          const highRes = src.replace(/max\d+/, 'max1024').replace(/square\d+/, 'square600');
          photos.push(highRes);
        }
      });

      // Get room/unit details
      let bedrooms: number | undefined;
      let bathrooms: number | undefined;
      let maxGuests: number | undefined;

      const roomDetails = $('[data-testid="room-unit-configuration"], .hprt-roomtype-bed').text().toLowerCase();
      const facilityDetails = $('.roomType, .hprt-table, [data-testid="property-section-room"]').text().toLowerCase();
      const allDetails = roomDetails + ' ' + facilityDetails;

      // Extract bedrooms
      const bedroomMatch = allDetails.match(/(\d+)\s*(?:chambre|bedroom|bed|lit)/);
      if (bedroomMatch) {
        bedrooms = parseInt(bedroomMatch[1], 10);
      }

      // Extract bathrooms
      const bathroomMatch = allDetails.match(/(\d+)\s*(?:salle de bain|bathroom|sdb)/);
      if (bathroomMatch) {
        bathrooms = parseInt(bathroomMatch[1], 10);
      }

      // Extract max guests
      const guestMatch = allDetails.match(/(\d+)\s*(?:personne|guest|voyageur|occupant|adulte)/);
      if (guestMatch) {
        maxGuests = parseInt(guestMatch[1], 10);
      }

      // Determine property type
      const propertyType = this.detectPropertyType(title + ' ' + (description || ''));

      // Get host/property owner info (if available)
      const hostName = $('[data-testid="host-name"], .hp_hotel_operator_name').first().text().trim() || undefined;

      return {
        platform: 'booking',
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
        currency,
        propertyType,
        bedrooms,
        bathrooms,
        maxGuests,
        amenities: amenities.slice(0, 50), // Limit amenities
        photos: photos.slice(0, 15), // Limit photos
        rating,
        reviewCount,
        rawData: {
          priceText,
          ratingText,
          scrapedAt: new Date().toISOString(),
          sourceUrl: listingUrl,
        },
      };
    } finally {
      await detailPage.close();
    }
  }

  /**
   * Override detectPropertyType for Booking.com specific types
   */
  protected detectPropertyType(text: string): ScrapedListing['propertyType'] {
    const lower = text.toLowerCase();

    // Booking.com specific property types
    if (lower.includes('villa') || lower.includes('chalet')) return 'villa';
    if (lower.includes('studio')) return 'studio';
    if (
      lower.includes('appartement') ||
      lower.includes('apartment') ||
      lower.includes('flat') ||
      lower.includes('loft')
    ) {
      return 'apartment';
    }
    if (
      lower.includes('maison') ||
      lower.includes('house') ||
      lower.includes('home') ||
      lower.includes('bungalow')
    ) {
      return 'house';
    }
    if (lower.includes('chambre') || lower.includes('room') || lower.includes('suite')) return 'room';
    if (
      lower.includes('hotel') ||
      lower.includes('hôtel') ||
      lower.includes('resort')
    ) {
      return 'hotel';
    }
    if (
      lower.includes('guesthouse') ||
      lower.includes("maison d'hotes") ||
      lower.includes('guest house') ||
      lower.includes('b&b') ||
      lower.includes('bed and breakfast')
    ) {
      return 'guesthouse';
    }

    return 'other';
  }
}
