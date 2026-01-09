/**
 * Expat-Dakar Fetch-based Scraper
 * Uses simple HTTP fetch + cheerio instead of Puppeteer
 * This avoids Cloudflare blocking headless browsers
 */

import * as cheerio from 'cheerio';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class ExpatDakarFetchScraper {
  platform: Platform = 'expat_dakar';
  baseUrl = 'https://www.expat-dakar.com';

  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    const basePath = '/immobilier';
    const searchParams = new URLSearchParams();

    if (params.city) {
      searchParams.set('q', params.city);
    }
    if (params.minPrice) {
      searchParams.set('prix_min', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('prix_max', params.maxPrice.toString());
    }

    const queryString = searchParams.toString();
    return `${this.baseUrl}${basePath}${queryString ? '?' + queryString : ''}`;
  }

  async scrape(job: ScrapeJob): Promise<ScrapedListing[]> {
    const listings: ScrapedListing[] = [];
    const maxPages = job.targetParams.maxPages || 5;

    console.log(`[${this.platform}] Starting fetch-based scrape...`);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const searchUrl = this.buildSearchUrl(job.targetParams) +
          (pageNum > 1 ? `&page=${pageNum}` : '');

        console.log(`[${this.platform}] Fetching page ${pageNum}: ${searchUrl}`);

        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          console.log(`[${this.platform}] HTTP ${response.status} for page ${pageNum}`);
          break;
        }

        const html = await response.text();
        const pageListings = await this.parseSearchResults(html);

        console.log(`[${this.platform}] Found ${pageListings.length} listings on page ${pageNum}`);

        if (pageListings.length === 0) {
          console.log(`[${this.platform}] No more listings, stopping.`);
          break;
        }

        // Get details for each listing
        for (const partialListing of pageListings) {
          if (partialListing.url) {
            try {
              // Random delay between requests
              await this.randomDelay(1000, 2000);

              const fullListing = await this.parseListingDetails(partialListing.url);
              if (fullListing) {
                listings.push(fullListing);
              }
            } catch (error) {
              console.error(`[${this.platform}] Error fetching details for ${partialListing.url}`);
            }
          }
        }

        // Random delay between pages
        if (pageNum < maxPages) {
          await this.randomDelay(2000, 4000);
        }
      } catch (error) {
        console.error(`[${this.platform}] Error on page ${pageNum}:`, error);
        break;
      }
    }

    return listings;
  }

  async parseSearchResults(html: string): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];
    const $ = cheerio.load(html);

    $('.listing-card').each((_, element) => {
      try {
        const listing: Partial<ScrapedListing> = {
          platform: 'expat_dakar',
        };

        // Get URL and ID from the card link
        const linkElement = $(element).find('a.listing-card__inner, a[href*="/annonce/"]').first();
        const href = linkElement.attr('href');
        if (href) {
          listing.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          const idMatch = href.match(/-(\d+)(?:\/|$)/);
          if (idMatch) {
            listing.platformId = idMatch[1];
          }
        }

        // Get title from img alt
        const imgElement = $(element).find('img').first();
        listing.title = imgElement.attr('alt') || $(element).find('.listing-card__header__title').text().trim();

        // Get price
        const priceText = $(element).find('.listing-card__price__value, .listing-card__price').first().text();
        listing.pricePerNight = this.parsePrice(priceText);
        listing.currency = 'XOF';

        // Get location
        listing.locationText = $(element).find('.listing-card__header__location').first().text().trim();
        if (listing.locationText) {
          const parts = listing.locationText.split(',').map(p => p.trim());
          if (parts.length >= 1) {
            listing.neighborhood = parts[0];
            listing.city = parts[1] || 'Dakar';
          }
        }

        // Get photo
        const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
        if (imgSrc) {
          listing.photos = [imgSrc.startsWith('http') ? imgSrc : `${this.baseUrl}${imgSrc}`];
        }

        // Detect property type
        if (listing.title) {
          listing.propertyType = this.detectPropertyType(listing.title);
        }

        if (listing.url && listing.platformId) {
          listings.push(listing);
        }
      } catch (error) {
        console.error('[expat_dakar] Error parsing listing card');
      }
    });

    return listings;
  }

  async parseListingDetails(listingUrl: string): Promise<ScrapedListing | null> {
    try {
      const response = await fetch(listingUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract ID from URL
      const idMatch = listingUrl.match(/-(\d+)(?:\/|$)/);
      const platformId = idMatch ? idMatch[1] : listingUrl;

      // Get title
      const title = $('h1, .annonce-title').first().text().trim();

      // Get description
      const description = $('.description, .annonce-description, [class*="description"]')
        .text()
        .trim()
        .replace(/\s+/g, ' ');

      // Get price
      const priceText = $('.price, .prix, [class*="price"]').first().text();
      const pricePerNight = this.parsePrice(priceText);

      // Get location
      const locationText = $('.location, .lieu, [class*="location"], [class*="adresse"]')
        .first()
        .text()
        .trim();

      let city: string | undefined;
      let neighborhood: string | undefined;
      if (locationText) {
        const parts = locationText.split(',').map(p => p.trim());
        neighborhood = parts[0];
        city = parts[1] || 'Dakar';
      }

      // Get host info
      const hostName = $('.contact-name, .annonceur, [class*="owner"], [class*="contact"] .name')
        .first()
        .text()
        .trim();

      // Get phone
      const phoneText = $('[href^="tel:"], .phone, .telephone')
        .first()
        .text()
        .trim();

      // Get photos
      const photos: string[] = [];
      $('img[src*="upload"], img[src*="photo"], .gallery img, .photos img').each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src && !src.includes('placeholder') && !src.includes('icon')) {
          photos.push(src.startsWith('http') ? src : `${this.baseUrl}${src}`);
        }
      });

      // Get details
      const detailsContainer = $('.caracteristiques, .details, [class*="specs"], [class*="features"]');
      const detailsText = detailsContainer.text();

      const bedroomMatch = detailsText.match(/(\d+)\s*(?:chambre|piece|ch\.|bedroom)/i);
      const bathroomMatch = detailsText.match(/(\d+)\s*(?:salle de bain|sdb|bathroom)/i);

      // Get amenities
      const amenities: string[] = [];
      $('.amenities li, .equipements li, [class*="amenity"], [class*="feature"] li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          amenities.push(text);
        }
      });

      return {
        platform: 'expat_dakar',
        platformId,
        url: listingUrl,
        title,
        description,
        locationText,
        city,
        neighborhood,
        hostName,
        pricePerNight,
        currency: 'XOF',
        propertyType: this.detectPropertyType(title || description),
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
        amenities,
        photos: photos.slice(0, 10),
        rawData: {
          phone: phoneText,
          fullDetailsText: detailsText,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[expat_dakar] Error fetching details for ${listingUrl}`);
      return null;
    }
  }

  protected parsePrice(priceStr: string): number | undefined {
    if (!priceStr) return undefined;
    const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(',', '');
    const price = parseInt(cleaned, 10);
    return isNaN(price) ? undefined : price;
  }

  protected detectPropertyType(text: string): ScrapedListing['propertyType'] {
    const lower = text.toLowerCase();
    if (lower.includes('villa')) return 'villa';
    if (lower.includes('studio')) return 'studio';
    if (lower.includes('appartement') || lower.includes('apartment')) return 'apartment';
    if (lower.includes('maison') || lower.includes('house')) return 'house';
    if (lower.includes('chambre') || lower.includes('room')) return 'room';
    if (lower.includes('hotel')) return 'hotel';
    if (lower.includes('guesthouse')) return 'guesthouse';
    return 'other';
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
