/**
 * Keur-Immo Scraper
 * Scrapes rental listings from keur-immo.com for Senegal
 * Supports daily and monthly rentals (furnished and unfurnished)
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class KeurImmoScraper extends BaseScraper {
  platform: Platform = 'keur_immo';
  baseUrl = 'https://keur-immo.com';

  // Rental type configurations
  private rentalTypes = {
    furnished_apartments: '/senegal/appartements-meubles-a-louer-dakar/',
    apartments: '/senegal/appartements-a-louer-dakar/',
    villas: '/senegal/villas-maisons-a-louer-dakar/',
    studios: '/senegal/chambres-studios-a-louer-dakar/',
    all_rentals: '/senegal/immobilier-a-louer-dakar/',
  };

  // City-specific URL mappings
  private cityPaths: Record<string, string> = {
    dakar: 'dakar',
    saly: 'saly',
    thies: 'thies',
    'saint-louis': 'saint-louis',
    mbour: 'mbour',
    somone: 'somone',
    ngaparou: 'ngaparou',
  };

  // Neighborhood mappings for Dakar
  private neighborhoodPaths: Record<string, string> = {
    almadies: 'almadies',
    plateau: 'au-plateau',
    mermoz: 'a-mermoz',
    ouakam: 'a-ouakam',
    'point-e': 'point-e',
    mamelles: 'mamelles',
    'sacre-coeur': 'sacre-coeur',
    ngor: 'ngor',
    fann: 'fann',
  };

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    const city = (params.city || 'dakar').toLowerCase();
    const cityPath = this.cityPaths[city] || 'dakar';

    // Default to furnished apartments (most relevant for short-term rentals)
    let basePath = `/senegal/appartements-meubles-a-louer-${cityPath}/`;

    // Handle different rental types based on neighborhood or preferences
    if (params.neighborhood) {
      const neighborhoodKey = params.neighborhood.toLowerCase();
      const neighborhoodPath = this.neighborhoodPaths[neighborhoodKey];
      if (neighborhoodPath && cityPath === 'dakar') {
        basePath = `/senegal/appartements-a-louer-${neighborhoodPath}/`;
      }
    }

    // For coastal areas, use villas path
    if (['saly', 'somone', 'ngaparou', 'mbour'].includes(city)) {
      basePath = `/senegal/villas-maisons-a-louer-${cityPath}/`;
    }

    return `${this.baseUrl}${basePath}`;
  }

  /**
   * Build multiple search URLs to cover different rental types
   */
  buildAllSearchUrls(params: ScrapeJob['targetParams']): string[] {
    const city = (params.city || 'dakar').toLowerCase();
    const cityPath = this.cityPaths[city] || 'dakar';

    const urls: string[] = [];

    // Furnished apartments (daily/monthly)
    urls.push(`${this.baseUrl}/senegal/appartements-meubles-a-louer-${cityPath}/`);

    // Regular apartments
    urls.push(`${this.baseUrl}/senegal/appartements-a-louer-${cityPath}/`);

    // Villas (especially for coastal areas)
    urls.push(`${this.baseUrl}/senegal/villas-maisons-a-louer-${cityPath}/`);

    return urls;
  }

  protected async waitForListings(page: Page): Promise<void> {
    try {
      // Wait for the main listing container
      await page.waitForSelector('.g5ere__property-featured, .g5ere__lam-content, article', {
        timeout: 15000,
      });
    } catch (error) {
      console.log('[keur_immo] No listings found or page timeout');
    }
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      // Look for the NEXT pagination link
      const nextButton = await page.$('a:has-text("NEXT"), .nav-pills a[href*="/page/"], .pagination a.next');

      if (nextButton) {
        const href = await nextButton.evaluate(el => el.getAttribute('href'));
        if (href && href.includes('/page/')) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomDelay(1000, 2000);
          return true;
        }
      }

      // Alternative: look for numbered pagination
      const currentPageUrl = page.url();
      const pageMatch = currentPageUrl.match(/\/page\/(\d+)\/?/);
      const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const nextPageUrl = currentPageUrl.includes('/page/')
        ? currentPageUrl.replace(/\/page\/\d+\/?/, `/page/${currentPage + 1}/`)
        : `${currentPageUrl.replace(/\/?$/, '')}/page/2/`;

      // Check if next page exists
      const nextLink = await page.$(`a[href*="/page/${currentPage + 1}"]`);
      if (nextLink) {
        await page.goto(nextPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        return true;
      }
    } catch (error) {
      console.log('[keur_immo] No more pages or navigation error:', error);
    }
    return false;
  }

  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      const html = await page.content();
      const $ = cheerio.load(html);

      // Select listing items using various possible selectors
      const listingSelectors = [
        '.g5ere__property-featured',
        '.g5ere__lam-content',
        'article[class*="property"]',
        '.listing-item',
      ];

      let foundListings = false;

      for (const selector of listingSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          foundListings = true;

          elements.each((_, element) => {
            try {
              const listing = this.parseListingCard($, element);
              if (listing && listing.url && listing.platformId) {
                listings.push(listing);
              }
            } catch (error) {
              console.error('[keur_immo] Error parsing listing card:', error);
            }
          });
          break;
        }
      }

      if (!foundListings) {
        console.log('[keur_immo] No listings found with known selectors');
      }
    } catch (error) {
      console.error('[keur_immo] Error parsing search results:', error);
    }

    return listings;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseListingCard($: cheerio.CheerioAPI, element: any): Partial<ScrapedListing> | null {
    const listing: Partial<ScrapedListing> = {
      platform: 'keur_immo',
    };

    const $el = $(element);

    // Get URL and ID
    const linkElement = $el.find('a[href*="/annonce-immobiliere-senegal/"], a[href*="/senegal/"]').first();
    let href = linkElement.attr('href');

    // If no direct link found, try the title link
    if (!href) {
      href = $el.find('.g5ere__property-title a, h2 a, h3 a').first().attr('href');
    }

    if (href) {
      listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      // Extract ID from URL - typically the last part before trailing slash
      const urlParts = href.split('/').filter(p => p.length > 0);
      const lastPart = urlParts[urlParts.length - 1];
      // Generate a unique ID from the URL slug
      listing.platformId = this.generatePlatformId(lastPart || href);
    }

    // Get title
    const titleElement = $el.find('.g5ere__property-title, h2, h3, .title').first();
    listing.title = titleElement.text().trim() || titleElement.find('a').text().trim();

    // Get price - look for FCFA pattern
    const cardText = $el.text();
    const priceMatch = cardText.match(/([\d\s]+)\s*(?:FCFA|CFA|F\s*CFA)/i);
    if (priceMatch) {
      listing.pricePerNight = this.parsePrice(priceMatch[1]);
    }
    listing.currency = 'XOF';

    // Detect rental period (daily vs monthly)
    const isDaily = cardText.toLowerCase().includes('par jour') ||
                    cardText.toLowerCase().includes('par nuit') ||
                    cardText.toLowerCase().includes('/jour') ||
                    cardText.toLowerCase().includes('/nuit');

    // Store rental period info in rawData
    listing.rawData = {
      ...listing.rawData,
      rentalPeriod: isDaily ? 'daily' : 'monthly',
      source: 'keur-immo',
    };

    // If monthly rate and we want nightly, estimate (divide by 30)
    if (!isDaily && listing.pricePerNight) {
      listing.rawData.monthlyPrice = listing.pricePerNight;
      // Keep original monthly price, don't convert
    }

    // Get location from title or dedicated location element
    const locationText = $el.find('.location, .lieu, [class*="location"]').text().trim();
    listing.locationText = locationText || this.extractLocationFromTitle(listing.title || '');

    if (listing.locationText) {
      const locationParts = this.parseLocation(listing.locationText);
      listing.city = locationParts.city;
      listing.neighborhood = locationParts.neighborhood;
    }

    // Get photo
    const imgSrc = $el.find('img').first().attr('src') ||
                   $el.find('img').first().attr('data-src') ||
                   $el.find('[style*="background-image"]').first().css('background-image');

    if (imgSrc) {
      let photoUrl = imgSrc;
      if (imgSrc.includes('url(')) {
        const urlMatch = imgSrc.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        photoUrl = urlMatch ? urlMatch[1] : imgSrc;
      }
      if (!photoUrl.startsWith('http')) {
        photoUrl = `${this.baseUrl}${photoUrl}`;
      }
      listing.photos = [photoUrl];
    }

    // Get property features
    const featuresText = $el.find('.g5ere__property-content, .features, .details, [class*="detail"]').text();

    // Bedrooms: "3 Ch." or "3 chambres"
    const bedroomMatch = featuresText.match(/(\d+)\s*(?:Ch\.|chambres?|bedroom)/i);
    if (bedroomMatch) {
      listing.bedrooms = parseInt(bedroomMatch[1], 10);
    }

    // Bathrooms: "2 Sdb" or "2 salles de bain"
    const bathroomMatch = featuresText.match(/(\d+)\s*(?:Sdb|salle[s]?\s*de\s*bain|bathroom)/i);
    if (bathroomMatch) {
      listing.bathrooms = parseInt(bathroomMatch[1], 10);
    }

    // Surface area
    const surfaceMatch = featuresText.match(/(\d+)\s*(?:m2|m²|sqm)/i);
    if (surfaceMatch) {
      listing.rawData = {
        ...listing.rawData,
        surface: parseInt(surfaceMatch[1], 10),
      };
    }

    // Determine property type from title
    if (listing.title) {
      listing.propertyType = this.detectPropertyType(listing.title);
    }

    // Check for professional/agency badge
    const isProfessional = $el.find('.ki-badge-pro, [class*="pro"]').length > 0;
    listing.rawData = {
      ...listing.rawData,
      isProfessional,
    };

    return listing;
  }

  private generatePlatformId(urlSlug: string): string {
    // Generate a consistent ID from the URL slug
    // Remove special characters and create a hash-like ID
    const cleaned = urlSlug.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    return `keurimmo_${cleaned.substring(0, 50)}`;
  }

  private extractLocationFromTitle(title: string): string {
    // Common Dakar neighborhoods in titles
    const neighborhoods = [
      'almadies', 'plateau', 'mermoz', 'ouakam', 'point-e', 'pointe e',
      'mamelles', 'sacre-coeur', 'sacrecoeur', 'ngor', 'fann',
      'yoff', 'hann', 'grand dakar', 'medina', 'gueule tapee',
      'sicap', 'liberte', 'parcelles', 'pikine', 'keur massar',
      'saly', 'mbour', 'somone', 'ngaparou', 'thies', 'saint-louis',
    ];

    const lowerTitle = title.toLowerCase();
    for (const neighborhood of neighborhoods) {
      if (lowerTitle.includes(neighborhood)) {
        return `${neighborhood.charAt(0).toUpperCase()}${neighborhood.slice(1)}, Dakar`;
      }
    }

    // Check for DAKAR pattern in title
    const dakarMatch = title.match(/DAKAR\s+([A-Z\s]+)/i);
    if (dakarMatch) {
      return `${dakarMatch[1].trim()}, Dakar`;
    }

    return 'Dakar, Senegal';
  }

  private parseLocation(locationText: string): { city?: string; neighborhood?: string } {
    const parts = locationText.split(',').map(p => p.trim());

    if (parts.length >= 2) {
      return {
        neighborhood: parts[0],
        city: parts[1],
      };
    }

    // Check if it's a known neighborhood
    const lowerText = locationText.toLowerCase();
    if (lowerText.includes('dakar') || this.isDakarNeighborhood(lowerText)) {
      return {
        neighborhood: locationText,
        city: 'Dakar',
      };
    }

    return {
      city: locationText || 'Dakar',
    };
  }

  private isDakarNeighborhood(text: string): boolean {
    const dakarNeighborhoods = [
      'almadies', 'plateau', 'mermoz', 'ouakam', 'point-e',
      'mamelles', 'sacre-coeur', 'ngor', 'fann', 'yoff',
    ];
    return dakarNeighborhoods.some(n => text.includes(n));
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);
      await this.randomDelay(500, 1000);

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract platform ID from URL
      const urlParts = listingUrl.split('/').filter(p => p.length > 0);
      const platformId = this.generatePlatformId(urlParts[urlParts.length - 1] || listingUrl);

      // Get title
      const title = $('h1, .property-title, .g5ere__property-title').first().text().trim();

      // Get description
      const description = $('.description, .property-description, [class*="description"], .content p')
        .map((_, el) => $(el).text().trim())
        .get()
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Get price
      const priceText = $('.price, .prix, [class*="price"]').first().text() ||
                        $('body').text().match(/([\d\s]+)\s*(?:FCFA|CFA)/)?.[0] || '';
      const pricePerNight = this.parsePrice(priceText);

      // Detect rental period
      const pageText = $('body').text().toLowerCase();
      const isDaily = pageText.includes('par jour') ||
                      pageText.includes('par nuit') ||
                      pageText.includes('/jour') ||
                      pageText.includes('/nuit');

      // Get location
      const locationText = $('.location, .lieu, .address, [class*="location"], [class*="address"]')
        .first()
        .text()
        .trim() || this.extractLocationFromTitle(title);

      const locationParts = this.parseLocation(locationText);

      // Get host/contact info
      const hostName = $('.contact-name, .agent-name, .annonceur, [class*="owner"], [class*="agent"] .name')
        .first()
        .text()
        .trim();

      // Get phone number
      const phoneText = $('[href^="tel:"]').first().attr('href')?.replace('tel:', '') ||
                        $('[href^="tel:"]').first().text().trim() ||
                        $('.phone, .telephone, [class*="phone"]').first().text().trim();

      // Get email
      const emailText = $('[href^="mailto:"]').first().attr('href')?.replace('mailto:', '') ||
                        $('[href^="mailto:"]').first().text().trim();

      // Get all photos
      const photos: string[] = [];
      $('img[src*="upload"], img[src*="photo"], .gallery img, .photos img, [class*="slider"] img, [class*="gallery"] img').each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src && !src.includes('placeholder') && !src.includes('icon') && !src.includes('logo')) {
          const photoUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          if (!photos.includes(photoUrl)) {
            photos.push(photoUrl);
          }
        }
      });

      // Get property features from details section
      const detailsContainer = $('.caracteristiques, .details, .features, [class*="specs"], [class*="features"], [class*="detail"]');
      const detailsText = detailsContainer.text() + ' ' + $('body').text();

      // Extract features
      const bedroomMatch = detailsText.match(/(\d+)\s*(?:Ch\.|chambres?|bedroom|pieces?)/i);
      const bathroomMatch = detailsText.match(/(\d+)\s*(?:Sdb|salle[s]?\s*de\s*bain|bathroom)/i);
      const surfaceMatch = detailsText.match(/(\d+)\s*(?:m2|m²|sqm)/i);
      const guestMatch = detailsText.match(/(\d+)\s*(?:personnes?|guests?|voyageurs?)/i);

      // Get amenities
      const amenities: string[] = [];
      $('.amenities li, .equipements li, [class*="amenity"], [class*="feature"] li, .features li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 100) {
          amenities.push(text);
        }
      });

      // Common amenities to detect from text
      const amenityKeywords = [
        { keyword: 'piscine', amenity: 'Piscine' },
        { keyword: 'pool', amenity: 'Piscine' },
        { keyword: 'climatisation', amenity: 'Climatisation' },
        { keyword: 'air conditionne', amenity: 'Climatisation' },
        { keyword: 'wifi', amenity: 'WiFi' },
        { keyword: 'internet', amenity: 'Internet' },
        { keyword: 'parking', amenity: 'Parking' },
        { keyword: 'garage', amenity: 'Garage' },
        { keyword: 'jardin', amenity: 'Jardin' },
        { keyword: 'terrasse', amenity: 'Terrasse' },
        { keyword: 'balcon', amenity: 'Balcon' },
        { keyword: 'meuble', amenity: 'Meuble' },
        { keyword: 'cuisine equipee', amenity: 'Cuisine equipee' },
        { keyword: 'securite', amenity: 'Securite' },
        { keyword: 'gardien', amenity: 'Gardien' },
        { keyword: 'ascenseur', amenity: 'Ascenseur' },
      ];

      const lowerText = detailsText.toLowerCase();
      for (const { keyword, amenity } of amenityKeywords) {
        if (lowerText.includes(keyword) && !amenities.includes(amenity)) {
          amenities.push(amenity);
        }
      }

      // Determine property type
      const propertyType = this.detectPropertyType(title || description);

      return {
        platform: 'keur_immo',
        platformId,
        url: listingUrl,
        title,
        description: description || undefined,
        locationText,
        city: locationParts.city,
        neighborhood: locationParts.neighborhood,
        hostName: hostName || undefined,
        pricePerNight,
        currency: 'XOF',
        propertyType,
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
        maxGuests: guestMatch ? parseInt(guestMatch[1], 10) : undefined,
        amenities: amenities.length > 0 ? amenities : undefined,
        photos: photos.slice(0, 15),
        rawData: {
          phone: phoneText || undefined,
          email: emailText || undefined,
          surface: surfaceMatch ? parseInt(surfaceMatch[1], 10) : undefined,
          rentalPeriod: isDaily ? 'daily' : 'monthly',
          source: 'keur-immo',
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await detailPage.close();
    }
  }

  /**
   * Override scrape method to handle multiple rental types
   */
  async scrape(job: ScrapeJob): Promise<ScrapedListing[]> {
    const allListings: ScrapedListing[] = [];
    const seenUrls = new Set<string>();

    try {
      await this.init();

      // Get all search URLs to scrape
      const searchUrls = this.buildAllSearchUrls(job.targetParams);

      for (const searchUrl of searchUrls) {
        console.log(`[keur_immo] Scraping: ${searchUrl}`);

        try {
          const page = await this.newPage();
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          await this.dismissPopups(page);

          let currentPage = 1;
          const maxPages = Math.min(job.targetParams.maxPages || 3, 10);

          while (currentPage <= maxPages) {
            console.log(`[keur_immo] Scraping page ${currentPage} of ${searchUrl}...`);

            await this.waitForListings(page);
            const pageListings = await this.parseSearchResults(page);
            console.log(`[keur_immo] Found ${pageListings.length} listings on page ${currentPage}`);

            // Get full details for each listing
            for (const partialListing of pageListings) {
              if (partialListing.url && !seenUrls.has(partialListing.url)) {
                seenUrls.add(partialListing.url);

                try {
                  const fullListing = await this.queue.add(async () => {
                    return await this.parseListingDetails(page, partialListing.url!);
                  });

                  if (fullListing) {
                    allListings.push(fullListing);
                  }
                } catch (error) {
                  console.error(`[keur_immo] Error scraping listing ${partialListing.url}:`, error);
                }

                // Rate limiting delay
                await this.randomDelay(1500, 3000);
              }
            }

            // Try to go to next page
            const hasNextPage = await this.goToNextPage(page);
            if (!hasNextPage) {
              break;
            }

            currentPage++;
            await this.randomDelay(2000, 4000);
          }

          await page.close();
        } catch (error) {
          console.error(`[keur_immo] Error scraping ${searchUrl}:`, error);
        }

        // Delay between different rental type searches
        await this.randomDelay(3000, 5000);
      }
    } catch (error) {
      console.error('[keur_immo] Scraping error:', error);
      throw error;
    }

    console.log(`[keur_immo] Total unique listings scraped: ${allListings.length}`);
    return allListings;
  }

  /**
   * Override dismissPopups for Keur-Immo specific modals
   */
  protected async dismissPopups(page: Page): Promise<void> {
    try {
      // Common cookie/popup selectors for Keur-Immo
      const popupSelectors = [
        'button[data-dismiss="modal"]',
        '.modal .close',
        '.cookie-consent button',
        '#cookie-banner button',
        '[class*="cookie"] button[class*="accept"]',
        '.popup-close',
        'button:has-text("Accepter")',
        'button:has-text("OK")',
        'button:has-text("Fermer")',
      ];

      for (const selector of popupSelectors) {
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
}
