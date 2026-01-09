/**
 * Jumia House Senegal Scraper
 * Scrapes rental listings from house.jumia.sn
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class JumiaHouseScraper extends BaseScraper {
  platform: Platform = 'jumia_house';
  baseUrl = 'https://house.jumia.sn';

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    // Jumia House uses path-based URL structure for rentals
    // /locations for rentals, /ventes for sales
    let basePath = '/locations';

    const searchParams = new URLSearchParams();

    // Add city/region filter
    if (params.city) {
      basePath = `/locations/${this.mapCityToSlug(params.city)}`;
    }

    // Add price range
    if (params.minPrice) {
      searchParams.set('price__gte', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('price__lte', params.maxPrice.toString());
    }

    // Add bedrooms filter if available
    if (params.guests) {
      // Approximate bedrooms from guest count
      const bedrooms = Math.ceil(params.guests / 2);
      searchParams.set('bedrooms__gte', bedrooms.toString());
    }

    const queryString = searchParams.toString();
    return `${this.baseUrl}${basePath}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Map city names to Jumia House URL slugs
   */
  private mapCityToSlug(city: string): string {
    const cityMap: Record<string, string> = {
      'dakar': 'dakar',
      'dakar-region': 'dakar',
      'thies': 'thies',
      'thiès': 'thies',
      'saint-louis': 'saint-louis',
      'saly': 'saly',
      'mbour': 'mbour',
      'ziguinchor': 'ziguinchor',
      'cap skirring': 'cap-skirring',
      'rufisque': 'rufisque',
      'pikine': 'pikine',
      'guediawaye': 'guediawaye',
      'ngor': 'ngor',
      'almadies': 'almadies',
      'plateau': 'plateau',
      'mermoz': 'mermoz',
      'ouakam': 'ouakam',
      'yoff': 'yoff',
      'fann': 'fann',
      'point e': 'point-e',
      'sacre coeur': 'sacre-coeur',
    };
    return cityMap[city.toLowerCase()] || city.toLowerCase().replace(/\s+/g, '-');
  }

  protected async waitForListings(page: Page): Promise<void> {
    try {
      // Wait for listing cards to appear
      await page.waitForSelector('.listings-cards .listing-card, article.listing, [class*="listing-item"], .product-list .product', {
        timeout: 15000,
      });
    } catch {
      // Try alternative selectors
      await page.waitForSelector('.listings-wrapper, .search-results, [data-testid="listing"]', {
        timeout: 10000,
      });
    }
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      // Look for pagination controls
      const nextButton = await page.$(
        'a.page-link[rel="next"], a[aria-label="Next"], .pagination a:contains("Suivant"), .pagination li:last-child a, a.next-page'
      );

      if (nextButton) {
        const href = await nextButton.evaluate(el => el.getAttribute('href'));
        if (href && !href.includes('javascript:')) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomDelay(1000, 2000);
          return true;
        }
      }

      // Alternative: check for page number links
      const currentPage = await page.$eval('.pagination .active, .page-item.active', el => {
        return parseInt(el.textContent?.trim() || '1', 10);
      }).catch(() => 1);

      const nextPageLink = await page.$(`a[href*="page=${currentPage + 1}"], a[href*="page%3D${currentPage + 1}"]`);
      if (nextPageLink) {
        await nextPageLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomDelay(1000, 2000);
        return true;
      }
    } catch (error) {
      console.log('[jumia_house] No more pages or navigation error');
    }
    return false;
  }

  /**
   * Dismiss popups specific to Jumia House
   */
  protected async dismissPopups(page: Page): Promise<void> {
    await super.dismissPopups(page);

    try {
      // Dismiss any Jumia-specific modals
      const jumiaPopupSelectors = [
        '[class*="modal-close"]',
        'button[aria-label="Close"]',
        '.popup-close',
        '[data-dismiss="modal"]',
        '.newsletter-popup .close',
      ];

      for (const selector of jumiaPopupSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await this.randomDelay(300, 500);
          }
        } catch {
          // Continue to next selector
        }
      }
    } catch {
      // Ignore popup dismissal errors
    }
  }

  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      const html = await page.content();
      const $ = cheerio.load(html);

      // Multiple possible selectors for listing cards
      const listingSelectors = [
        '.listings-cards .listing-card',
        'article.listing',
        '.product-list .product',
        '[class*="listing-item"]',
        '.search-results .listing',
        'a[href*="/locations/"]',
      ];

      let listingElements: ReturnType<typeof $> | null = null;
      for (const selector of listingSelectors) {
        const found = $(selector);
        if (found.length > 0) {
          listingElements = found;
          break;
        }
      }

      if (!listingElements) return listings;

      listingElements.each((_, element) => {
        try {
          const listing: Partial<ScrapedListing> = {
            platform: 'jumia_house',
          };

          // Get URL and ID
          let linkElement = $(element);
          if (!linkElement.is('a')) {
            linkElement = $(element).find('a[href*="/locations/"], a[href*="/annonce/"], a[href*="/property/"]').first();
          }

          const href = linkElement.attr('href') || $(element).find('a').first().attr('href');
          if (href) {
            listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
            // Extract ID from URL (format: /locations/titre-123456.html or similar)
            const idMatch = href.match(/[-_](\d{4,})(?:\.html)?(?:\?|$)/) || href.match(/\/(\d{4,})(?:\.html)?(?:\?|$)/);
            if (idMatch) {
              listing.platformId = idMatch[1];
            } else {
              // Generate ID from URL hash
              listing.platformId = this.generateIdFromUrl(href);
            }
          }

          // Get title
          const titleElement = $(element).find('h2, h3, .title, .listing-title, [class*="title"]').first();
          listing.title = titleElement.text().trim() || $(element).attr('title');

          // Get price
          const priceElement = $(element).find('.price, [class*="price"], .amount, .listing-price').first();
          const priceText = priceElement.text().trim();
          listing.pricePerNight = this.parsePrice(priceText);
          listing.currency = 'XOF'; // Jumia House Senegal uses FCFA (XOF)

          // Get location
          const locationElement = $(element).find('.location, .address, [class*="location"], [class*="address"], .listing-location').first();
          listing.locationText = locationElement.text().trim();
          if (listing.locationText) {
            const locationParts = this.parseLocation(listing.locationText);
            listing.neighborhood = locationParts.neighborhood;
            listing.city = locationParts.city;
          }

          // Get main photo
          const imgElement = $(element).find('img').first();
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src') || imgElement.attr('data-lazy-src');
          if (imgSrc && !imgSrc.includes('placeholder') && !imgSrc.includes('default')) {
            listing.photos = [imgSrc.startsWith('http') ? imgSrc : `${this.baseUrl}${imgSrc}`];
          }

          // Get property details
          const detailsContainer = $(element).find('.features, .details, .specs, [class*="feature"], [class*="detail"]');
          const detailsText = detailsContainer.text();

          // Extract bedrooms
          const bedroomMatch = detailsText.match(/(\d+)\s*(?:chambre|ch\.|bedroom|bed|pcs|piece)/i);
          if (bedroomMatch) {
            listing.bedrooms = parseInt(bedroomMatch[1], 10);
          }

          // Extract bathrooms
          const bathroomMatch = detailsText.match(/(\d+)\s*(?:salle de bain|sdb|bathroom|bath|wc)/i);
          if (bathroomMatch) {
            listing.bathrooms = parseInt(bathroomMatch[1], 10);
          }

          // Detect property type
          if (listing.title) {
            listing.propertyType = this.detectPropertyType(listing.title);
          }

          if (listing.url && listing.platformId) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[jumia_house] Error parsing listing card:', error);
        }
      });
    } catch (error) {
      console.error('[jumia_house] Error parsing search results:', error);
    }

    return listings;
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract ID from URL
      const idMatch = listingUrl.match(/[-_](\d{4,})(?:\.html)?(?:\?|$)/) || listingUrl.match(/\/(\d{4,})(?:\.html)?(?:\?|$)/);
      const platformId = idMatch ? idMatch[1] : this.generateIdFromUrl(listingUrl);

      // Get title
      const title = $('h1, .listing-title, .property-title, [class*="title"]').first().text().trim();

      // Get description
      const description = $('.description, .listing-description, [class*="description"], .property-description, .content-text')
        .text()
        .trim()
        .replace(/\s+/g, ' ');

      // Get price
      const priceText = $('.price, .listing-price, [class*="price"], .amount').first().text().trim();
      const pricePerNight = this.parsePrice(priceText);

      // Determine if price is monthly or nightly
      const priceFrequency = this.detectPriceFrequency(priceText);

      // Get location details
      const locationText = $('.location, .address, [class*="location"], [class*="address"], .property-location')
        .first()
        .text()
        .trim();

      const locationParts = this.parseLocation(locationText);
      const city = locationParts.city;
      const neighborhood = locationParts.neighborhood;

      // Try to extract coordinates from embedded map or data attributes
      let latitude: number | undefined;
      let longitude: number | undefined;

      // Look for map data
      const mapElement = $('[data-lat][data-lng], [data-latitude][data-longitude]');
      if (mapElement.length > 0) {
        latitude = parseFloat(mapElement.attr('data-lat') || mapElement.attr('data-latitude') || '');
        longitude = parseFloat(mapElement.attr('data-lng') || mapElement.attr('data-longitude') || '');
      }

      // Look for coordinates in script tags
      if (!latitude || !longitude) {
        const scriptContent = $('script:contains("latitude"), script:contains("lng")').text();
        const latMatch = scriptContent.match(/["']?lat(?:itude)?["']?\s*[:=]\s*(-?\d+\.?\d*)/i);
        const lngMatch = scriptContent.match(/["']?(?:lng|longitude)["']?\s*[:=]\s*(-?\d+\.?\d*)/i);
        if (latMatch && lngMatch) {
          latitude = parseFloat(latMatch[1]);
          longitude = parseFloat(lngMatch[1]);
        }
      }

      // Get contact/host info
      const hostName = $(
        '.seller-name, .agent-name, .contact-name, [class*="owner"], [class*="seller"], [class*="agent"]'
      )
        .first()
        .text()
        .trim();

      // Get phone number
      const phoneElement = $('[href^="tel:"], .phone, .telephone, [class*="phone"]').first();
      const phoneNumber = phoneElement.attr('href')?.replace('tel:', '') || phoneElement.text().trim();

      // Get all photos
      const photos: string[] = [];
      $(
        '.gallery img, .photos img, .carousel img, .slider img, [class*="gallery"] img, [class*="photo"] img, .image-list img'
      ).each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
        if (src && !src.includes('placeholder') && !src.includes('default') && !src.includes('icon')) {
          const fullSrc = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          if (!photos.includes(fullSrc)) {
            photos.push(fullSrc);
          }
        }
      });

      // Get property features/details
      const featuresContainer = $(
        '.features, .specs, .details, .property-features, [class*="feature"], [class*="detail"], .caractéristiques'
      );
      const featuresText = featuresContainer.text();

      // Extract bedrooms
      const bedroomMatch = featuresText.match(/(\d+)\s*(?:chambre|ch\.|bedroom|bed|pcs|piece)/i);
      const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined;

      // Extract bathrooms
      const bathroomMatch = featuresText.match(/(\d+)\s*(?:salle de bain|sdb|bathroom|bath|wc)/i);
      const bathrooms = bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined;

      // Extract surface area
      const surfaceMatch = featuresText.match(/(\d+)\s*(?:m2|m²|sqm|square)/i);
      const surfaceArea = surfaceMatch ? parseInt(surfaceMatch[1], 10) : undefined;

      // Get amenities
      const amenities: string[] = [];
      $(
        '.amenities li, .features li, .equipements li, [class*="amenity"], [class*="feature"] li, .property-features li'
      ).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 100) {
          amenities.push(text);
        }
      });

      // Also extract amenities from icons/badges
      $('.amenity-icon, .feature-badge, [class*="amenity-item"]').each((_, el) => {
        const text = $(el).attr('title') || $(el).text().trim();
        if (text && text.length < 100 && !amenities.includes(text)) {
          amenities.push(text);
        }
      });

      // Detect property type
      const propertyType = this.detectPropertyType(title || description);

      // Get listing date if available
      const dateText = $('.date, .posted-date, [class*="date"]').first().text().trim();

      return {
        platform: 'jumia_house',
        platformId,
        url: listingUrl,
        title,
        description,
        locationText,
        city,
        neighborhood,
        latitude: latitude && !isNaN(latitude) ? latitude : undefined,
        longitude: longitude && !isNaN(longitude) ? longitude : undefined,
        hostName,
        pricePerNight: priceFrequency === 'monthly' ? Math.round((pricePerNight || 0) / 30) : pricePerNight,
        currency: 'XOF',
        propertyType,
        bedrooms,
        bathrooms,
        amenities: amenities.slice(0, 30),
        photos: photos.slice(0, 15),
        rawData: {
          phoneNumber,
          surfaceArea,
          priceFrequency,
          originalPrice: pricePerNight,
          featuresText,
          datePosted: dateText,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[jumia_house] Error parsing listing details for ${listingUrl}:`, error);
      throw error;
    } finally {
      await detailPage.close();
    }
  }

  /**
   * Parse location string into city and neighborhood
   */
  private parseLocation(locationText: string): { city?: string; neighborhood?: string } {
    if (!locationText) {
      return { city: 'Dakar' };
    }

    const parts = locationText.split(/[,\-]/).map(p => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      return {
        neighborhood: parts[0],
        city: parts[parts.length - 1] || 'Dakar',
      };
    } else if (parts.length === 1) {
      // Check if it's a known city
      const knownCities = ['dakar', 'thies', 'thiès', 'saint-louis', 'mbour', 'saly', 'ziguinchor', 'rufisque'];
      const normalized = parts[0].toLowerCase();
      if (knownCities.some(city => normalized.includes(city))) {
        return { city: parts[0] };
      }
      return { neighborhood: parts[0], city: 'Dakar' };
    }

    return { city: 'Dakar' };
  }

  /**
   * Detect if price is monthly or nightly
   */
  private detectPriceFrequency(priceText: string): 'monthly' | 'nightly' | 'unknown' {
    const lower = priceText.toLowerCase();
    if (lower.includes('/mois') || lower.includes('par mois') || lower.includes('mensuel') || lower.includes('/month')) {
      return 'monthly';
    }
    if (lower.includes('/nuit') || lower.includes('par nuit') || lower.includes('/jour') || lower.includes('/night') || lower.includes('/day')) {
      return 'nightly';
    }
    // Jumia House typically shows monthly prices for rentals
    return 'monthly';
  }

  /**
   * Generate a unique ID from URL when no numeric ID is available
   */
  private generateIdFromUrl(url: string): string {
    // Create a simple hash from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `jh_${Math.abs(hash).toString(36)}`;
  }
}
