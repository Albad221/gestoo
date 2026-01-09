/**
 * Scraper Registry
 * Central export for all platform scrapers
 */

export { BaseScraper } from './base.js';
export { AirbnbScraper } from './airbnb.js';
export { BookingScraper } from './booking.js';
export { ExpatDakarScraper } from './expat-dakar.js';
export { JumiaHouseScraper } from './jumia-house.js';
export { CoinAfriqueScraper } from './coinafrique.js';
export { MaMaisonScraper } from './mamaison.js';
export { KeurImmoScraper } from './keur-immo.js';

import { Platform } from '../types.js';
import { BaseScraper } from './base.js';
import { AirbnbScraper } from './airbnb.js';
import { BookingScraper } from './booking.js';
import { ExpatDakarScraper } from './expat-dakar.js';
import { JumiaHouseScraper } from './jumia-house.js';
import { CoinAfriqueScraper } from './coinafrique.js';
import { MaMaisonScraper } from './mamaison.js';
import { KeurImmoScraper } from './keur-immo.js';

export function createScraper(platform: Platform): BaseScraper {
  switch (platform) {
    case 'airbnb':
      return new AirbnbScraper();
    case 'booking':
      return new BookingScraper();
    case 'expat_dakar':
      return new ExpatDakarScraper();
    case 'jumia_house':
      return new JumiaHouseScraper();
    case 'coinafrique':
      return new CoinAfriqueScraper();
    case 'mamaison':
      return new MaMaisonScraper();
    case 'keur_immo':
      return new KeurImmoScraper();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export const SUPPORTED_PLATFORMS: Platform[] = ['airbnb', 'booking', 'expat_dakar', 'jumia_house', 'coinafrique', 'mamaison', 'keur_immo'];
