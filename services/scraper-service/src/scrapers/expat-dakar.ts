/**
 * Expat-Dakar Scraper
 * Scrapes local Senegalese rental listings from expat-dakar.com
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.js';
import { ScrapedListing, Platform, ScrapeJob } from '../types.js';

export class ExpatDakarScraper extends BaseScraper {
  platform: Platform = 'expat_dakar';
  baseUrl = 'https://www.expat-dakar.com';

  buildSearchUrl(params: ScrapeJob['targetParams']): string {
    // Expat-Dakar uses simple /immobilier path with query params
    const basePath = '/immobilier';
    const searchParams = new URLSearchParams();

    // Expat-Dakar may filter by keyword or location in search
    if (params.city) {
      searchParams.set('q', params.city);
    }

    // Add price range
    if (params.minPrice) {
      searchParams.set('prix_min', params.minPrice.toString());
    }
    if (params.maxPrice) {
      searchParams.set('prix_max', params.maxPrice.toString());
    }

    const queryString = searchParams.toString();
    return `${this.baseUrl}${basePath}${queryString ? '?' + queryString : ''}`;
  }

  private mapCityToRegion(city: string): string {
    const cityMap: Record<string, string> = {
      'dakar': 'dakar',
      'saint-louis': 'saint-louis',
      'saly': 'thies',
      'mbour': 'thies',
      'cap skirring': 'ziguinchor',
      'ziguinchor': 'ziguinchor',
      'thies': 'thies',
    };
    return cityMap[city.toLowerCase()] || 'dakar';
  }

  protected async waitForListings(page: Page): Promise<void> {
    await page.waitForSelector('.listing-card, .listings-cards__list-item', {
      timeout: 15000,
    });
  }

  protected async goToNextPage(page: Page): Promise<boolean> {
    try {
      const nextButton = await page.$('a.next, a[rel="next"], .pagination a:last-child');
      if (nextButton) {
        const href = await nextButton.evaluate(el => el.getAttribute('href'));
        if (href && !href.includes('javascript')) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          return true;
        }
      }
    } catch (error) {
      console.log('[expat_dakar] No more pages');
    }
    return false;
  }

  async parseSearchResults(page: Page): Promise<Partial<ScrapedListing>[]> {
    const listings: Partial<ScrapedListing>[] = [];

    try {
      const html = await page.content();
      const $ = cheerio.load(html);

      // Select listing cards
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
            // Extract ID from URL (e.g., /annonce/appartement-a-louer-6551371)
            const idMatch = href.match(/-(\d+)(?:\/|$)/);
            if (idMatch) {
              listing.platformId = idMatch[1];
            }
          }

          // Get title from img alt or other source
          const imgElement = $(element).find('img').first();
          listing.title = imgElement.attr('alt') || $(element).find('.listing-card__header__title').text().trim();

          // Get price
          const priceText = $(element).find('.listing-card__price__value, .listing-card__price').first().text();
          listing.pricePerNight = this.parsePrice(priceText);
          listing.currency = 'XOF'; // Expat-Dakar uses FCFA

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

          // Get property type from title or category
          if (listing.title) {
            listing.propertyType = this.detectPropertyType(listing.title);
          }

          if (listing.url && listing.platformId) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[expat_dakar] Error parsing listing:', error);
        }
      });
    } catch (error) {
      console.error('[expat_dakar] Error parsing search results:', error);
    }

    return listings;
  }

  async parseListingDetails(page: Page, listingUrl: string): Promise<ScrapedListing> {
    const detailPage = await this.newPage();

    try {
      await detailPage.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      const html = await detailPage.content();
      const $ = cheerio.load(html);

      // Extract ID from URL
      const idMatch = listingUrl.match(/(\d+)(?:\.html)?$/);
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

      // Get host/contact info
      const hostName = $('.contact-name, .annonceur, [class*="owner"], [class*="contact"] .name')
        .first()
        .text()
        .trim();

      // Get phone (will be useful for matching)
      const phoneText = $('[href^="tel:"], .phone, .telephone')
        .first()
        .text()
        .trim();

      // Get all photos
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
      const surfaceMatch = detailsText.match(/(\d+)\s*(?:m2|m²|sqm)/i);

      // Get amenities
      const amenities: string[] = [];
      $('.amenities li, .equipements li, [class*="amenity"], [class*="feature"] li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          amenities.push(text);
        }
      });

      // Determine property type
      const propertyType = this.detectPropertyType(title || description);

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
        propertyType,
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
        amenities,
        photos: photos.slice(0, 10),
        rawData: {
          phone: phoneText,
          surface: surfaceMatch ? parseInt(surfaceMatch[1], 10) : undefined,
          fullDetailsText: detailsText,
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await detailPage.close();
    }
  }
}
