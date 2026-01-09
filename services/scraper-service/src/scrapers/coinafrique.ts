/**
 * CoinAfrique Scraper
 * Scrapes rental listings from CoinAfrique Senegal (sn.coinafrique.com)
 * Targets: appartements meubles, locations, chambres
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class CoinAfriqueScraper extends BaseScraper {
  platform: Platform = 'coinafrique';
  baseUrl = 'https://sn.coinafrique.com';

  // Category paths for rental listings
  private readonly rentalCategories = [
    'appartements-meubles',  // Furnished apartments
    'appartements',          // Apartments
    'chambres',              // Rooms
    'maisons-de-vacances',   // Vacation houses
  ];

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    // Default to furnished apartments category
    let category = 'appartements-meubles';

    // Build base URL with category
    let url = `${this.baseUrl}/categorie/${category}`;

    const searchParams = new URLSearchParams();

    // Add city/region filter if specified
    if (params.city) {
      searchParams.set('ville', this.mapCityToSlug(params.city));
    }

    // Add price range filters
    if (params.minPrice) {
      searchParams.set('prix_min', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('prix_max', params.maxPrice.toString());
    }

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Map city name to CoinAfrique slug format
   */
  private mapCityToSlug(city: string): string {
    const cityMap: Record<string, string> = {
      'dakar': 'dakar',
      'saint-louis': 'saint-louis',
      'saint louis': 'saint-louis',
      'thies': 'thies',
      'mbour': 'mbour',
      'saly': 'saly',
      'rufisque': 'rufisque',
      'pikine': 'pikine',
      'guediawaye': 'guediawaye',
      'ziguinchor': 'ziguinchor',
      'kaolack': 'kaolack',
      'touba': 'touba',
    };
    return cityMap[city.toLowerCase()] || city.toLowerCase().replace(/\s+/g, '-');
  }

  protected async waitForListings(page: Page): Promise<void> {
    try {
      // Wait for listing cards to appear
      await page.waitForSelector('.card-annonce, .annonce, [class*="listing"], a[href*="/annonce/"]', {
        timeout: 15000,
      });
    } catch (error) {
      console.log('[coinafrique] Waiting for alternative selectors...');
      // Try alternative: wait for any link to an announcement
      await page.waitForSelector('a[href*="annonce"]', { timeout: 10000 });
    }
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      // CoinAfrique uses URL-based pagination with ?page=X
      const currentUrl = page.url();
      const url = new URL(currentUrl);
      const currentPage = parseInt(url.searchParams.get('page') || '1', 10);

      // Check if there's a next page link
      const nextPageExists = await page.evaluate((nextPage) => {
        const paginationLinks = document.querySelectorAll('a[href*="page="]');
        for (const link of paginationLinks) {
          const href = link.getAttribute('href');
          if (href && href.includes(`page=${nextPage}`)) {
            return true;
          }
        }
        // Also check for next arrow/chevron
        const nextArrow = document.querySelector('a[href*="page"]:has([class*="chevron_right"]), .pagination a:last-child');
        return !!nextArrow;
      }, currentPage + 1);

      if (nextPageExists) {
        url.searchParams.set('page', (currentPage + 1).toString());
        await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 30000 });
        return true;
      }
    } catch (error) {
      console.log('[coinafrique] No more pages or navigation error:', error);
    }
    return false;
  }

  protected async dismissPopups(page: Page): Promise<void> {
    try {
      // CoinAfrique may have cookie consent or promotional popups
      const popupSelectors = [
        'button[class*="accept"]',
        'button[class*="cookie"]',
        '[class*="modal"] button[class*="close"]',
        '[class*="popup"] button[class*="close"]',
        '.close-button',
        '[aria-label="Fermer"]',
        '[aria-label="Close"]',
      ];

      for (const selector of popupSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await this.randomDelay(300, 600);
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

      // Find all listing cards - CoinAfrique uses various card structures
      const cardSelectors = [
        'a[href*="/annonce/appartements"]',
        'a[href*="/annonce/chambres"]',
        'a[href*="/annonce/maisons"]',
        '.card-annonce',
        '.annonce-card',
        '[class*="listing-card"]',
      ];

      const processedUrls = new Set<string>();

      // Process links to announcements
      $('a[href*="/annonce/"]').each((_, element) => {
        try {
          const href = $(element).attr('href');
          if (!href || processedUrls.has(href)) return;

          // Skip non-rental categories
          if (!this.isRentalListing(href)) return;

          processedUrls.add(href);

          const listing: Partial<ScrapedListing> = {
            platform: 'coinafrique',
          };

          // Build full URL
          listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          // Extract platform ID from URL
          const idMatch = href.match(/(\d+)$/);
          if (idMatch) {
            listing.platformId = idMatch[1];
          } else {
            // Use URL slug as ID
            const slugMatch = href.match(/\/annonce\/[^/]+\/([^/]+)$/);
            listing.platformId = slugMatch ? slugMatch[1] : href;
          }

          // Get the card container (parent element containing all listing info)
          const cardContainer = $(element).closest('[class*="card"], [class*="annonce"], div').first();
          const contextElement = cardContainer.length ? cardContainer : $(element);

          // Extract title
          const titleElement = contextElement.find('h2, h3, [class*="title"], [class*="titre"]').first();
          listing.title = titleElement.text().trim() || $(element).text().trim().split('\n')[0];

          // Extract price - look for CFA pattern
          const priceText = contextElement.text();
          const priceMatch = priceText.match(/([\d\s]+)\s*(?:CFA|FCFA|F\s*CFA)/i);
          if (priceMatch) {
            listing.pricePerNight = this.parsePrice(priceMatch[1]);
            listing.currency = 'XOF';
          }

          // Extract location
          const locationText = this.extractLocation(contextElement, $);
          if (locationText) {
            listing.locationText = locationText;
            const locationParts = this.parseLocationText(locationText);
            listing.neighborhood = locationParts.neighborhood;
            listing.city = locationParts.city;
          }

          // Extract thumbnail image
          const imgElement = contextElement.find('img').first();
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
          if (imgSrc) {
            // Convert thumbnail to full size if possible
            const fullSizeUrl = imgSrc.replace('/thumb_', '/').replace('thumb_', '');
            listing.photos = [fullSizeUrl.startsWith('http') ? fullSizeUrl : `https:${fullSizeUrl}`];
          }

          // Detect property type from URL and title
          listing.propertyType = this.detectPropertyType(href + ' ' + (listing.title || ''));

          if (listing.url && listing.platformId) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[coinafrique] Error parsing listing card:', error);
        }
      });
    } catch (error) {
      console.error('[coinafrique] Error parsing search results:', error);
    }

    return listings;
  }

  /**
   * Check if URL corresponds to a rental listing
   */
  private isRentalListing(url: string): boolean {
    const rentalPatterns = [
      'appartements-meubles',
      'appartements',
      'chambres',
      'maisons-de-vacances',
      'location',
      'studio',
      'villa',
    ];
    return rentalPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  /**
   * Extract location text from element
   */
  private extractLocation(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
    // Look for location indicators
    const locationSelectors = [
      '[class*="location"]',
      '[class*="lieu"]',
      '[class*="address"]',
      'span:contains(",")',
    ];

    for (const selector of locationSelectors) {
      const locationEl = element.find(selector).first();
      if (locationEl.length) {
        const text = locationEl.text().trim();
        if (text && text.includes(',')) {
          return text;
        }
      }
    }

    // Fallback: search for text pattern like "Neighborhood, City, Country"
    const fullText = element.text();
    const locationMatch = fullText.match(/([A-Za-zÀ-ÿ\s-]+),\s*([A-Za-zÀ-ÿ\s-]+)(?:,\s*[A-Za-zÀ-ÿ\s-]+)?/);
    if (locationMatch) {
      return locationMatch[0].trim();
    }

    return '';
  }

  /**
   * Parse location text into components
   */
  private parseLocationText(locationText: string): { neighborhood?: string; city?: string } {
    const parts = locationText.split(',').map(p => p.trim());

    if (parts.length >= 2) {
      return {
        neighborhood: parts[0],
        city: parts[1],
      };
    } else if (parts.length === 1) {
      return {
        city: parts[0],
      };
    }

    return {};
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      console.log(`[coinafrique] Fetching details for: ${listingUrl}`);

      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);

      // Wait for main content
      await detailPage.waitForSelector('h1, [class*="title"], [class*="titre"]', { timeout: 15000 });

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract platform ID from URL
      const idMatch = listingUrl.match(/(\d+)$/);
      const platformId = idMatch ? idMatch[1] : listingUrl.split('/').pop() || listingUrl;

      // Get title
      const title = $('h1, [class*="detail-title"], [class*="annonce-title"]')
        .first()
        .text()
        .trim();

      // Get description
      const description = this.extractDescription($);

      // Get price
      const priceText = $('[class*="price"], [class*="prix"], [class*="montant"]')
        .first()
        .text()
        .trim();
      const priceMatch = priceText.match(/([\d\s]+)/);
      const pricePerNight = priceMatch ? this.parsePrice(priceMatch[1]) : undefined;

      // Get location
      const locationText = $('[class*="location"], [class*="lieu"], [class*="adresse"]')
        .first()
        .text()
        .trim();
      const locationParts = this.parseLocationText(locationText);

      // Get all photos
      const photos = this.extractPhotos($);

      // Get contact information (phone/WhatsApp)
      const contactInfo = await this.extractContactInfo(detailPage, $);

      // Get host/seller information
      const hostInfo = this.extractHostInfo($);

      // Get property details
      const propertyDetails = this.extractPropertyDetails($);

      // Get amenities
      const amenities = this.extractAmenities($);

      // Get posting date
      const postingDate = this.extractPostingDate($);

      // Determine property type
      const propertyType = this.detectPropertyType(title + ' ' + description);

      return {
        platform: 'coinafrique',
        platformId,
        url: listingUrl,
        title,
        description,
        locationText,
        city: locationParts.city,
        neighborhood: locationParts.neighborhood,
        hostName: hostInfo.name,
        hostId: hostInfo.id,
        hostProfileUrl: hostInfo.profileUrl,
        pricePerNight,
        currency: 'XOF',
        propertyType,
        bedrooms: propertyDetails.bedrooms,
        bathrooms: propertyDetails.bathrooms,
        amenities,
        photos,
        rawData: {
          phone: contactInfo.phone,
          whatsapp: contactInfo.whatsapp,
          sellerType: hostInfo.type,
          postingDate,
          fullDescription: description,
          surface: propertyDetails.surface,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[coinafrique] Error parsing listing details for ${listingUrl}:`, error);

      // Return minimal listing on error
      const idMatch = listingUrl.match(/(\d+)$/);
      return {
        platform: 'coinafrique',
        platformId: idMatch ? idMatch[1] : listingUrl,
        url: listingUrl,
        rawData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await detailPage.close();
    }
  }

  /**
   * Extract description from listing page
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    const descriptionSelectors = [
      '[class*="description"]',
      '[class*="detail-body"]',
      '[class*="annonce-content"]',
      '[class*="content"] p',
      'article p',
    ];

    for (const selector of descriptionSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.text().trim().replace(/\s+/g, ' ');
        if (text.length > 20) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Extract all photos from listing page
   */
  private extractPhotos($: cheerio.CheerioAPI): string[] {
    const photos: string[] = [];
    const seenUrls = new Set<string>();

    // Look for gallery images
    const imageSelectors = [
      '[class*="gallery"] img',
      '[class*="slider"] img',
      '[class*="carousel"] img',
      '[class*="photo"] img',
      'img[src*="coinafrique"]',
      'img[data-src*="coinafrique"]',
    ];

    for (const selector of imageSelectors) {
      $(selector).each((_, img) => {
        let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy');

        if (src && !seenUrls.has(src)) {
          // Skip thumbnails and placeholders
          if (src.includes('placeholder') || src.includes('icon') || src.includes('logo')) {
            return;
          }

          // Convert to full size URL
          src = src.replace('/thumb_', '/').replace('thumb_', '');

          // Ensure full URL
          if (!src.startsWith('http')) {
            src = src.startsWith('//') ? `https:${src}` : `${this.baseUrl}${src}`;
          }

          seenUrls.add(src);
          photos.push(src);
        }
      });
    }

    return photos.slice(0, 15); // Limit to 15 photos
  }

  /**
   * Extract contact information including phone and WhatsApp
   */
  private async extractContactInfo(page: Page, $: cheerio.CheerioAPI): Promise<{ phone?: string; whatsapp?: string }> {
    const contactInfo: { phone?: string; whatsapp?: string } = {};

    try {
      // Look for phone number in visible text
      const pageText = $('body').text();

      // Senegalese phone patterns: +221 XX XXX XX XX or 7X XXX XX XX
      const phonePatterns = [
        /\+221\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g,
        /221\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g,
        /7[0-9]\s*\d{3}\s*\d{2}\s*\d{2}/g,
        /3[0-3]\s*\d{3}\s*\d{2}\s*\d{2}/g, // Landline
      ];

      for (const pattern of phonePatterns) {
        const matches = pageText.match(pattern);
        if (matches && matches.length > 0) {
          contactInfo.phone = matches[0].replace(/\s+/g, '');
          break;
        }
      }

      // Check for WhatsApp links
      const whatsappLink = $('a[href*="whatsapp"], a[href*="wa.me"]').first();
      if (whatsappLink.length) {
        const href = whatsappLink.attr('href');
        if (href) {
          const waMatch = href.match(/(\d+)/);
          if (waMatch) {
            contactInfo.whatsapp = waMatch[1];
          }
        }
      }

      // Try to click "Afficher le numero" button if present
      try {
        const showPhoneButton = await page.$('button:has-text("numero"), button:has-text("telephone"), [class*="show-phone"]');
        if (showPhoneButton) {
          await showPhoneButton.click();
          await this.randomDelay(500, 1000);

          // Re-extract phone after click
          const newHtml = await page.content();
          const $new = cheerio.load(newHtml);
          const newPageText = $new('body').text();

          for (const pattern of phonePatterns) {
            const matches = newPageText.match(pattern);
            if (matches && matches.length > 0) {
              contactInfo.phone = matches[0].replace(/\s+/g, '');
              break;
            }
          }
        }
      } catch {
        // Button not found or click failed
      }

      // Look for tel: links
      $('a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const phone = href.replace('tel:', '').replace(/\s+/g, '');
          if (phone.length >= 9) {
            contactInfo.phone = phone;
          }
        }
      });

    } catch (error) {
      console.error('[coinafrique] Error extracting contact info:', error);
    }

    return contactInfo;
  }

  /**
   * Extract host/seller information
   */
  private extractHostInfo($: cheerio.CheerioAPI): { name?: string; id?: string; profileUrl?: string; type?: string } {
    const hostInfo: { name?: string; id?: string; profileUrl?: string; type?: string } = {};

    // Look for seller name
    const sellerSelectors = [
      '[class*="seller-name"]',
      '[class*="vendeur"]',
      '[class*="owner"]',
      '[class*="contact-name"]',
      '[class*="user-name"]',
    ];

    for (const selector of sellerSelectors) {
      const el = $(selector).first();
      if (el.length) {
        hostInfo.name = el.text().trim();
        break;
      }
    }

    // Look for profile link
    const profileLink = $('a[href*="/user/"], a[href*="/profil/"], a[href*="/vendeur/"]').first();
    if (profileLink.length) {
      const href = profileLink.attr('href');
      if (href) {
        hostInfo.profileUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const idMatch = href.match(/\/(?:user|profil|vendeur)\/([^/]+)/);
        if (idMatch) {
          hostInfo.id = idMatch[1];
        }
      }
    }

    // Check if professional seller
    if ($('[class*="pro"], [class*="professionnel"], img[src*="pro"]').length > 0) {
      hostInfo.type = 'professional';
    } else {
      hostInfo.type = 'individual';
    }

    return hostInfo;
  }

  /**
   * Extract property details (bedrooms, bathrooms, surface)
   */
  private extractPropertyDetails($: cheerio.CheerioAPI): { bedrooms?: number; bathrooms?: number; surface?: number } {
    const details: { bedrooms?: number; bathrooms?: number; surface?: number } = {};

    const detailsText = $('[class*="caracteristique"], [class*="detail"], [class*="spec"], [class*="feature"]').text();
    const fullText = $('body').text();
    const searchText = detailsText || fullText;

    // Extract bedrooms
    const bedroomPatterns = [
      /(\d+)\s*(?:chambre|piece|pcs|ch\.)/i,
      /(\d+)\s*(?:bedroom|bed)/i,
    ];
    for (const pattern of bedroomPatterns) {
      const match = searchText.match(pattern);
      if (match) {
        details.bedrooms = parseInt(match[1], 10);
        break;
      }
    }

    // Extract bathrooms
    const bathroomPatterns = [
      /(\d+)\s*(?:salle de bain|sdb|douche|wc)/i,
      /(\d+)\s*(?:bathroom|bath)/i,
    ];
    for (const pattern of bathroomPatterns) {
      const match = searchText.match(pattern);
      if (match) {
        details.bathrooms = parseInt(match[1], 10);
        break;
      }
    }

    // Extract surface area
    const surfacePatterns = [
      /(\d+)\s*(?:m2|m²|metre|sqm)/i,
    ];
    for (const pattern of surfacePatterns) {
      const match = searchText.match(pattern);
      if (match) {
        details.surface = parseInt(match[1], 10);
        break;
      }
    }

    return details;
  }

  /**
   * Extract amenities from listing
   */
  private extractAmenities($: cheerio.CheerioAPI): string[] {
    const amenities: string[] = [];
    const seenAmenities = new Set<string>();

    // Look for amenity lists
    const amenitySelectors = [
      '[class*="amenities"] li',
      '[class*="equipement"] li',
      '[class*="feature"] li',
      '[class*="caracteristique"] li',
      '[class*="option"] li',
    ];

    for (const selector of amenitySelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 2 && text.length < 50 && !seenAmenities.has(text.toLowerCase())) {
          seenAmenities.add(text.toLowerCase());
          amenities.push(text);
        }
      });
    }

    // Also look for common amenity keywords in description
    const commonAmenities = [
      { pattern: /climatisation|clim/i, name: 'Climatisation' },
      { pattern: /wifi|internet/i, name: 'WiFi' },
      { pattern: /parking/i, name: 'Parking' },
      { pattern: /piscine/i, name: 'Piscine' },
      { pattern: /cuisine|kitchen/i, name: 'Cuisine' },
      { pattern: /meuble|furnished/i, name: 'Meuble' },
      { pattern: /securite|gardien|security/i, name: 'Securite' },
      { pattern: /terrasse|balcon/i, name: 'Terrasse/Balcon' },
      { pattern: /jardin|garden/i, name: 'Jardin' },
      { pattern: /groupe electrogene|generateur/i, name: 'Groupe electrogene' },
    ];

    const bodyText = $('body').text();
    for (const amenity of commonAmenities) {
      if (amenity.pattern.test(bodyText) && !seenAmenities.has(amenity.name.toLowerCase())) {
        seenAmenities.add(amenity.name.toLowerCase());
        amenities.push(amenity.name);
      }
    }

    return amenities;
  }

  /**
   * Extract posting date
   */
  private extractPostingDate($: cheerio.CheerioAPI): string | undefined {
    const dateSelectors = [
      '[class*="date"]',
      '[class*="time"]',
      'time',
      '[datetime]',
    ];

    for (const selector of dateSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const datetime = el.attr('datetime');
        if (datetime) {
          return datetime;
        }
        const text = el.text().trim();
        if (text && (text.includes('heure') || text.includes('jour') || text.includes('minute'))) {
          return text;
        }
      }
    }

    return undefined;
  }

  /**
   * Scrape multiple rental categories
   */
  async scrapeAllCategories(job: ScrapeJob): Promise<ScrapedListing[]> {
    const allListings: ScrapedListing[] = [];

    for (const category of this.rentalCategories) {
      try {
        console.log(`[coinafrique] Scraping category: ${category}`);

        // Modify job params for this category
        const categoryJob = {
          ...job,
          targetParams: {
            ...job.targetParams,
            // Category is embedded in the URL
          },
        };

        // Build URL for this category
        const originalBuildUrl = this.buildSearchUrl.bind(this);
        this.buildSearchUrl = (params) => {
          let url = `${this.baseUrl}/categorie/${category}`;
          const searchParams = new URLSearchParams();

          if (params.city) {
            searchParams.set('ville', this.mapCityToSlug(params.city));
          }
          if (params.minPrice) {
            searchParams.set('prix_min', params.minPrice.toString());
          }
          if (params.maxPrice) {
            searchParams.set('prix_max', params.maxPrice.toString());
          }

          const queryString = searchParams.toString();
          return queryString ? `${url}?${queryString}` : url;
        };

        const listings = await this.scrape(categoryJob);
        allListings.push(...listings);

        // Restore original buildSearchUrl
        this.buildSearchUrl = originalBuildUrl;

        // Rate limit between categories
        await this.randomDelay(3000, 6000);
      } catch (error) {
        console.error(`[coinafrique] Error scraping category ${category}:`, error);
      }
    }

    return allListings;
  }
}
