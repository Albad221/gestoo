/**
 * MaMaison.sn Scraper
 * Scrapes daily rental listings (location journaliere) from mamaison.sn
 *
 * MaMaison.sn is Senegal's leading real estate portal, launched by Expat-Dakar.com
 * This scraper focuses on "location journaliere" (daily rentals) listings
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class MaMaisonScraper extends BaseScraper {
  platform: Platform = 'mamaison';
  baseUrl = 'https://www.mamaison.sn';

  // Mapping of common neighborhoods/areas in Senegal
  private readonly neighborhoodMap: Record<string, string> = {
    'almadies': 'Almadies',
    'ngor': 'Ngor',
    'ouakam': 'Ouakam',
    'mermoz': 'Mermoz',
    'sacre-coeur': 'Sacre-Coeur',
    'point-e': 'Point E',
    'plateau': 'Plateau',
    'medina': 'Medina',
    'grand-yoff': 'Grand Yoff',
    'parcelles-assainies': 'Parcelles Assainies',
    'sicap-liberte': 'Sicap Liberte',
    'fann': 'Fann',
    'yoff': 'Yoff',
    'ouest-foire': 'Ouest Foire',
    'hann': 'Hann',
    'pikine': 'Pikine',
    'rufisque': 'Rufisque',
    'thies': 'Thies',
    'saly': 'Saly',
    'mbour': 'Mbour',
    'saint-louis': 'Saint-Louis',
    'toubab-dialaw': 'Toubab Dialaw',
    'somone': 'Somone',
    'cap-skirring': 'Cap Skirring',
  };

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    // Base path for daily rentals (location journaliere)
    let basePath = '/location-journee';

    // Build the URL based on parameters
    const searchParams = new URLSearchParams();

    // Handle city/neighborhood filter
    if (params.city) {
      const citySlug = this.slugify(params.city);
      basePath = `/location-journee/${citySlug}`;
    }

    if (params.neighborhood) {
      const neighborhoodSlug = this.slugify(params.neighborhood);
      if (params.city) {
        basePath = `/location-journee/${this.slugify(params.city)}/${neighborhoodSlug}`;
      } else {
        basePath = `/location-journee/dakar/${neighborhoodSlug}`;
      }
    }

    // Add price range filters
    if (params.minPrice) {
      searchParams.set('prix_min', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('prix_max', params.maxPrice.toString());
    }

    // Add sorting (newest first by default)
    searchParams.set('sortby', 'datedesc');

    const queryString = searchParams.toString();
    return `${this.baseUrl}${basePath}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Build search URL for specific property types
   */
  buildPropertyTypeUrl(propertyType: 'appartements' | 'maisons' | 'villas' | 'studios'): string {
    return `${this.baseUrl}/${propertyType}-location-journee`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  protected async waitForListings(page: Page): Promise<void> {
    try {
      // Wait for listing items to appear - try multiple possible selectors
      await page.waitForSelector(
        '.listing-card, .annonce-card, .property-card, article.listing, .classified-listing, [class*="listing-item"], [class*="annonce"]',
        { timeout: 15000 }
      );
    } catch (error) {
      // If no listings found, check if page loaded correctly
      console.log('[mamaison] No listings found or page structure changed');
    }
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      // Look for pagination elements
      const nextSelectors = [
        'a[rel="next"]',
        '.pagination a.next',
        '.pagination li.next a',
        'a[aria-label="Suivant"]',
        'a[aria-label="Next"]',
        '.pagination a:contains("Suivant")',
        '.pagination a:contains(">")',
        'nav.pagination a:last-child',
        '[class*="pagination"] a:last-of-type',
      ];

      for (const selector of nextSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            // Check if button is disabled or is the current page
            const isDisabled = await nextButton.evaluate(el =>
              el.classList.contains('disabled') ||
              el.getAttribute('aria-disabled') === 'true' ||
              el.classList.contains('active')
            );

            if (!isDisabled) {
              const href = await nextButton.evaluate(el => el.getAttribute('href'));
              if (href && !href.includes('javascript') && href !== '#') {
                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                  nextButton.click(),
                ]);
                await this.randomDelay(1000, 2000);
                return true;
              }
            }
          }
        } catch {
          // Try next selector
        }
      }
    } catch (error) {
      console.log('[mamaison] No more pages or navigation error:', error);
    }
    return false;
  }

  protected async dismissPopups(page: Page): Promise<void> {
    try {
      // Common popup/cookie consent selectors for Senegalese sites
      const popupSelectors = [
        'button[data-dismiss="modal"]',
        '.modal-close',
        '.cookie-accept',
        '#cookie-accept',
        'button[class*="accept"]',
        '.popup-close',
        '[aria-label="Fermer"]',
        '[aria-label="Close"]',
        '.close-modal',
        'button.close',
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

  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      const html = await page.content();
      const $ = cheerio.load(html);

      // Select listing items using multiple possible selectors
      const listingSelectors = [
        '.listing-card',
        '.annonce-card',
        '.property-card',
        'article.listing',
        '.classified-listing',
        '[class*="listing-item"]',
        '[class*="annonce-item"]',
        '.search-result-item',
        '.property-item',
        'div[data-listing-id]',
      ];

      const combinedSelector = listingSelectors.join(', ');

      $(combinedSelector).each((_, element) => {
        try {
          const listing: Partial<ScrapedListing> = {
            platform: 'mamaison',
          };

          // Get URL and extract ID
          const linkElement = $(element).find('a[href*="/annonce/"], a[href*="/immobilier/"], a[href*="/location"]').first();
          let href = linkElement.attr('href');

          // If no href found in nested link, check if the element itself is a link
          if (!href) {
            href = $(element).find('a').first().attr('href');
          }

          if (href) {
            listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

            // Extract platform ID from URL
            // Pattern: /annonce/12345 or /immobilier/location/12345.html or similar
            const idMatch = href.match(/(\d+)(?:\.html)?(?:\?|$)/);
            if (idMatch) {
              listing.platformId = idMatch[1];
            } else {
              // Use URL hash as ID if no numeric ID found
              listing.platformId = this.generateIdFromUrl(href);
            }
          }

          // Get title
          const titleSelectors = ['h2', 'h3', 'h4', '.title', '.annonce-title', '.listing-title', '[class*="title"]'];
          for (const sel of titleSelectors) {
            const title = $(element).find(sel).first().text().trim();
            if (title && title.length > 5) {
              listing.title = title;
              break;
            }
          }

          // Get price
          const priceSelectors = ['.price', '.prix', '[class*="price"]', '[class*="prix"]', '.amount'];
          for (const sel of priceSelectors) {
            const priceText = $(element).find(sel).first().text().trim();
            if (priceText) {
              listing.pricePerNight = this.parsePrice(priceText);
              // MaMaison.sn uses FCFA (XOF)
              listing.currency = 'XOF';
              break;
            }
          }

          // Get location
          const locationSelectors = ['.location', '.lieu', '[class*="location"]', '.address', '.adresse', '[class*="quartier"]'];
          for (const sel of locationSelectors) {
            const locationText = $(element).find(sel).first().text().trim();
            if (locationText) {
              listing.locationText = locationText;
              this.parseLocation(locationText, listing);
              break;
            }
          }

          // Get photo
          const imgElement = $(element).find('img').first();
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src') || imgElement.attr('data-lazy');
          if (imgSrc && !imgSrc.includes('placeholder') && !imgSrc.includes('icon')) {
            listing.photos = [imgSrc.startsWith('http') ? imgSrc : `${this.baseUrl}${imgSrc}`];
          }

          // Get property type from title or category
          if (listing.title) {
            listing.propertyType = this.detectPropertyType(listing.title);
          }

          // Extract bedroom count from details or title
          const detailsText = $(element).find('.details, .caracteristiques, [class*="detail"], [class*="feature"]').text();
          const allText = (listing.title || '') + ' ' + detailsText;

          const bedroomMatch = allText.match(/(\d+)\s*(?:chambre|piece|ch\.|pcs|bedroom)/i);
          if (bedroomMatch) {
            listing.bedrooms = parseInt(bedroomMatch[1], 10);
          }

          // Extract surface area if available
          const surfaceMatch = allText.match(/(\d+)\s*(?:m2|m²|sqm)/i);
          if (surfaceMatch) {
            listing.rawData = {
              ...listing.rawData,
              surface: parseInt(surfaceMatch[1], 10),
            };
          }

          // Only add listing if we have essential data
          if (listing.url && listing.platformId) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[mamaison] Error parsing listing card:', error);
        }
      });
    } catch (error) {
      console.error('[mamaison] Error parsing search results:', error);
    }

    return listings;
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.dismissPopups(detailPage);

      // Wait for main content to load
      await detailPage.waitForSelector('h1, .annonce-title, .listing-title', { timeout: 10000 }).catch(() => {});

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract ID from URL
      const idMatch = listingUrl.match(/(\d+)(?:\.html)?(?:\?|$)/);
      const platformId = idMatch ? idMatch[1] : this.generateIdFromUrl(listingUrl);

      // Get title
      const title = $('h1, .annonce-title, .listing-title, .property-title').first().text().trim();

      // Get description
      const descriptionSelectors = [
        '.description',
        '.annonce-description',
        '.property-description',
        '[class*="description"]',
        '.content-text',
        '[itemprop="description"]',
      ];
      let description = '';
      for (const sel of descriptionSelectors) {
        const text = $(sel).first().text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 20) {
          description = text;
          break;
        }
      }

      // Get price
      const priceSelectors = ['.price', '.prix', '[class*="price"]', '[class*="prix"]', '.listing-price'];
      let pricePerNight: number | undefined;
      for (const sel of priceSelectors) {
        const priceText = $(sel).first().text().trim();
        if (priceText) {
          pricePerNight = this.parsePrice(priceText);
          if (pricePerNight) break;
        }
      }

      // Get location
      const locationSelectors = [
        '.location',
        '.lieu',
        '[class*="location"]',
        '.address',
        '.adresse',
        '[itemprop="address"]',
        '.property-location',
      ];
      let locationText = '';
      let city: string | undefined;
      let neighborhood: string | undefined;

      for (const sel of locationSelectors) {
        const text = $(sel).first().text().trim();
        if (text) {
          locationText = text;
          const parsed = this.parseLocationText(text);
          city = parsed.city;
          neighborhood = parsed.neighborhood;
          break;
        }
      }

      // Get host/contact information
      const hostSelectors = [
        '.contact-name',
        '.annonceur',
        '.owner-name',
        '[class*="owner"]',
        '[class*="contact"] .name',
        '.agent-name',
        '.seller-name',
      ];
      let hostName: string | undefined;
      for (const sel of hostSelectors) {
        const text = $(sel).first().text().trim();
        if (text && text.length > 1) {
          hostName = text;
          break;
        }
      }

      // Get phone number
      const phoneSelectors = [
        '[href^="tel:"]',
        '.phone',
        '.telephone',
        '[class*="phone"]',
        '[class*="tel"]',
      ];
      let phone: string | undefined;
      for (const sel of phoneSelectors) {
        const el = $(sel).first();
        const href = el.attr('href');
        if (href && href.startsWith('tel:')) {
          phone = href.replace('tel:', '').trim();
        } else {
          const text = el.text().trim();
          // Match Senegalese phone patterns: +221 XX XXX XX XX or 77 XXX XX XX
          const phoneMatch = text.match(/(?:\+?221)?[\s-]?([7][0-8][\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/);
          if (phoneMatch) {
            phone = phoneMatch[0].replace(/[\s-]/g, '');
          }
        }
        if (phone) break;
      }

      // Get WhatsApp number if available
      let whatsapp: string | undefined;
      const whatsappLink = $('[href*="wa.me"], [href*="whatsapp"]').first().attr('href');
      if (whatsappLink) {
        const waMatch = whatsappLink.match(/(\d+)/);
        if (waMatch) {
          whatsapp = waMatch[1];
        }
      }

      // Get all photos
      const photos: string[] = [];
      const photoSelectors = [
        '.gallery img',
        '.photos img',
        '.slider img',
        '.carousel img',
        '[class*="gallery"] img',
        '.property-images img',
        '.listing-images img',
        'img[src*="upload"]',
        'img[src*="photo"]',
        'img[src*="image"]',
      ];

      for (const sel of photoSelectors) {
        $(sel).each((_, img) => {
          const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy');
          if (src && !src.includes('placeholder') && !src.includes('icon') && !src.includes('avatar')) {
            const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
            if (!photos.includes(fullUrl)) {
              photos.push(fullUrl);
            }
          }
        });
      }

      // Get property details (bedrooms, bathrooms, surface)
      const detailsContainer = $(
        '.caracteristiques, .details, [class*="specs"], [class*="features"], .property-features, .amenities-list'
      );
      const detailsText = detailsContainer.text();

      const bedroomMatch = detailsText.match(/(\d+)\s*(?:chambre|piece|ch\.|bedroom)/i);
      const bathroomMatch = detailsText.match(/(\d+)\s*(?:salle de bain|sdb|bathroom|wc|toilette)/i);
      const surfaceMatch = detailsText.match(/(\d+)\s*(?:m2|m²|sqm)/i);
      const guestMatch = detailsText.match(/(\d+)\s*(?:personne|voyageur|guest|couchage)/i);

      // Get amenities
      const amenities: string[] = [];
      const amenitySelectors = [
        '.amenities li',
        '.equipements li',
        '[class*="amenity"]',
        '[class*="feature"] li',
        '.property-amenities li',
        '.facilities li',
      ];

      for (const sel of amenitySelectors) {
        $(sel).each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 1 && text.length < 50) {
            amenities.push(text);
          }
        });
      }

      // Check for common amenities in description
      const amenityKeywords = [
        { keyword: 'wifi', name: 'WiFi' },
        { keyword: 'internet', name: 'Internet' },
        { keyword: 'climatisation', name: 'Climatisation' },
        { keyword: 'clim', name: 'Climatisation' },
        { keyword: 'parking', name: 'Parking' },
        { keyword: 'piscine', name: 'Piscine' },
        { keyword: 'jardin', name: 'Jardin' },
        { keyword: 'gardien', name: 'Gardien' },
        { keyword: 'securite', name: 'Securite' },
        { keyword: 'cuisine', name: 'Cuisine equipee' },
        { keyword: 'lave-linge', name: 'Lave-linge' },
        { keyword: 'television', name: 'Television' },
        { keyword: 'tv', name: 'Television' },
        { keyword: 'meuble', name: 'Meuble' },
        { keyword: 'terrasse', name: 'Terrasse' },
        { keyword: 'balcon', name: 'Balcon' },
      ];

      const fullText = (title + ' ' + description + ' ' + detailsText).toLowerCase();
      for (const { keyword, name } of amenityKeywords) {
        if (fullText.includes(keyword) && !amenities.includes(name)) {
          amenities.push(name);
        }
      }

      // Determine property type
      const propertyType = this.detectPropertyType(title || description);

      return {
        platform: 'mamaison',
        platformId,
        url: listingUrl,
        title: title || undefined,
        description: description || undefined,
        locationText: locationText || undefined,
        city,
        neighborhood,
        hostName,
        pricePerNight,
        currency: 'XOF',
        propertyType,
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
        maxGuests: guestMatch ? parseInt(guestMatch[1], 10) : undefined,
        amenities: amenities.length > 0 ? amenities : undefined,
        photos: photos.slice(0, 15), // Limit to 15 photos
        rawData: {
          phone,
          whatsapp,
          surface: surfaceMatch ? parseInt(surfaceMatch[1], 10) : undefined,
          fullDetailsText: detailsText,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[mamaison] Error parsing listing details for ${listingUrl}:`, error);

      // Return minimal data on error
      const idMatch = listingUrl.match(/(\d+)(?:\.html)?(?:\?|$)/);
      return {
        platform: 'mamaison',
        platformId: idMatch ? idMatch[1] : this.generateIdFromUrl(listingUrl),
        url: listingUrl,
        currency: 'XOF',
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
   * Parse location text into city and neighborhood
   */
  private parseLocation(locationText: string, listing: Partial<ScrapedListing>): void {
    const parsed = this.parseLocationText(locationText);
    listing.city = parsed.city;
    listing.neighborhood = parsed.neighborhood;
  }

  private parseLocationText(locationText: string): { city?: string; neighborhood?: string } {
    const parts = locationText.split(/[,\-/]/).map(p => p.trim()).filter(p => p.length > 0);

    let city: string | undefined;
    let neighborhood: string | undefined;

    if (parts.length >= 2) {
      neighborhood = parts[0];
      city = parts[1];
    } else if (parts.length === 1) {
      // Check if it's a known neighborhood
      const normalized = this.slugify(parts[0]);
      if (this.neighborhoodMap[normalized]) {
        neighborhood = this.neighborhoodMap[normalized];
        city = 'Dakar'; // Default to Dakar if only neighborhood is provided
      } else {
        city = parts[0];
      }
    }

    // Normalize known locations
    if (city) {
      const normalizedCity = this.slugify(city);
      if (normalizedCity.includes('dakar')) {
        city = 'Dakar';
      }
    }

    return { city, neighborhood };
  }

  /**
   * Generate a stable ID from URL when no numeric ID is available
   */
  private generateIdFromUrl(url: string): string {
    // Simple hash function for URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `mm_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Scrape multiple property types for daily rentals
   */
  async scrapeAllDailyRentals(job: ScrapeJob): Promise<ScrapedListing[]> {
    const allListings: ScrapedListing[] = [];
    const propertyTypes: Array<'appartements' | 'maisons' | 'villas' | 'studios'> = [
      'appartements',
      'maisons',
      'villas',
      'studios',
    ];

    for (const propertyType of propertyTypes) {
      try {
        console.log(`[mamaison] Scraping ${propertyType} daily rentals...`);

        const modifiedJob: ScrapeJob = {
          ...job,
          targetParams: {
            ...job.targetParams,
            // Override to use property type URL
          },
        };

        // Use buildPropertyTypeUrl for this specific property type
        const originalBuildSearchUrl = this.buildSearchUrl.bind(this);
        this.buildSearchUrl = () => this.buildPropertyTypeUrl(propertyType);

        const listings = await this.scrape(modifiedJob);
        allListings.push(...listings);

        // Restore original buildSearchUrl
        this.buildSearchUrl = originalBuildSearchUrl;

        // Rate limiting between property types
        await this.randomDelay(3000, 6000);
      } catch (error) {
        console.error(`[mamaison] Error scraping ${propertyType}:`, error);
      }
    }

    return allListings;
  }
}
