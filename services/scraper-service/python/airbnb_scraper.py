#!/usr/bin/env python3
"""
Airbnb Senegal Scraper using Scrapling
Bypasses Cloudflare and anti-bot measures
"""

import json
import sys
import os
import re
import time
import requests
from datetime import datetime

# Add parent venv to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'venv', 'lib', 'python3.11', 'site-packages'))

# Try to import scrapling, but it's optional
try:
    from scrapling.fetchers import Fetcher
    SCRAPLING_AVAILABLE = True
except ImportError:
    SCRAPLING_AVAILABLE = False
    print("[Warning] Scrapling not available, using requests only", file=sys.stderr)

# Anti-bot headers for requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
}

# Try to import playwright
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("[Warning] Playwright not available", file=sys.stderr)


def fetch_with_playwright(url: str, wait_time: int = 5) -> tuple:
    """Fetch URL using Playwright headless browser"""
    if not PLAYWRIGHT_AVAILABLE:
        return None, False

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                locale='en-US',
            )
            page = context.new_page()

            # Navigate and wait for content
            page.goto(url, wait_until='networkidle', timeout=30000)
            page.wait_for_timeout(wait_time * 1000)  # Additional wait for JS

            html = page.content()
            browser.close()

            if 'captcha' in html.lower() or len(html) < 5000:
                return None, False

            return html, True
    except Exception as e:
        print(f"[Airbnb] Playwright error: {e}", file=sys.stderr)
        return None, False

def fetch_with_requests(url: str, session: requests.Session = None) -> tuple:
    """Fetch URL using requests with anti-bot headers"""
    if session is None:
        session = requests.Session()

    try:
        response = session.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200 and 'captcha' not in response.text.lower():
            return response.text, True
        return None, False
    except Exception as e:
        print(f"[Airbnb] Request error: {e}", file=sys.stderr)
        return None, False


def scrape_airbnb_search(city: str = "Dakar", country: str = "Senegal", max_pages: int = 5):
    """Scrape Airbnb search results for a city"""

    all_listings = []
    session = requests.Session()

    for page_num in range(1, max_pages + 1):
        # Airbnb search URL with pagination
        offset = (page_num - 1) * 18  # Airbnb uses 18 items per page
        if offset == 0:
            base_url = f"https://www.airbnb.com/s/{city}--{country}/homes"
        else:
            base_url = f"https://www.airbnb.com/s/{city}--{country}/homes?items_offset={offset}"

        print(f"\n[Airbnb] Page {page_num}/{max_pages} - {city}, {country}...", file=sys.stderr)
        print(f"[Airbnb] URL: {base_url}", file=sys.stderr)

        try:
            # Try requests first (faster), then fall back to Playwright
            html_content, success = fetch_with_requests(base_url, session)

            if not html_content or not success:
                print(f"[Airbnb] Requests failed, trying Playwright...", file=sys.stderr)
                html_content, success = fetch_with_playwright(base_url, wait_time=5)

            if not html_content or not success:
                print(f"[Airbnb] All methods failed on page {page_num}, skipping...", file=sys.stderr)
                continue

            print(f"[Airbnb] Page fetched successfully", file=sys.stderr)

            # Debug: save full HTML
            if page_num == 1:
                with open('/tmp/airbnb_debug.html', 'w') as f:
                    f.write(html_content)
                print("[Airbnb] Debug HTML saved to /tmp/airbnb_debug.html", file=sys.stderr)

            # Extract listings from HTML content
            page_listings = extract_listings_from_html(html_content)

            print(f"[Airbnb] Extracted {len(page_listings)} listings from page {page_num}", file=sys.stderr)

            if len(page_listings) == 0:
                print("[Airbnb] No more listings found, stopping pagination", file=sys.stderr)
                break

            all_listings.extend(page_listings)

            # Rate limiting between pages
            if page_num < max_pages:
                delay = 3 + (page_num * 0.5)  # Increasing delay
                print(f"[Airbnb] Waiting {delay}s before next page...", file=sys.stderr)
                time.sleep(delay)

        except Exception as e:
            print(f"[Airbnb] Scrape error on page {page_num}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            # Continue to next page on error
            continue

    return all_listings


def extract_listings_from_html(html: str) -> list:
    """Extract listing data from embedded JSON and preload links in HTML"""
    listings = []
    seen_ids = set()

    # First, try to extract prices from the HTML
    # Prices appear as $XXX in the search results
    all_prices = re.findall(r'\$(\d+)', html)

    # Method 1: Extract listing IDs from preload image links (in order)
    # Pattern: Hosting-{listing_id}/original/
    preload_pattern = r'Hosting-(\d{10,20})/original/([a-f0-9-]+\.jpe?g)'
    preload_matches = re.findall(preload_pattern, html)

    price_index = 0
    for listing_id, image_uuid in preload_matches:
        if listing_id not in seen_ids:
            seen_ids.add(listing_id)
            image_url = f"https://a0.muscache.com/im/pictures/hosting/Hosting-{listing_id}/original/{image_uuid}?im_w=720"
            listing = {
                'platform': 'airbnb',
                'platform_id': listing_id,
                'url': f"https://www.airbnb.com/rooms/{listing_id}",
                'photos': [image_url],
                'scraped_at': datetime.now().isoformat(),
                'city': 'Dakar',
            }

            # Try to associate price (prices appear in order with listings)
            # Skip small numbers (likely ratings like 4.5)
            while price_index < len(all_prices):
                try:
                    price_val = int(all_prices[price_index])
                    price_index += 1
                    if price_val >= 10:  # Reasonable minimum price
                        listing['price'] = price_val
                        listing['currency'] = 'USD'
                        break
                except:
                    price_index += 1

            listings.append(listing)

    # Method 2: Also extract from miso hosting pattern
    miso_pattern = r'miso/Hosting-(\d{10,20})/original/([a-f0-9-]+\.jpe?g)'
    miso_matches = re.findall(miso_pattern, html)

    for listing_id, image_uuid in miso_matches:
        if listing_id not in seen_ids:
            seen_ids.add(listing_id)
            image_url = f"https://a0.muscache.com/im/pictures/miso/Hosting-{listing_id}/original/{image_uuid}?im_w=720"
            listing = {
                'platform': 'airbnb',
                'platform_id': listing_id,
                'url': f"https://www.airbnb.com/rooms/{listing_id}",
                'photos': [image_url],
                'scraped_at': datetime.now().isoformat(),
                'city': 'Dakar',
            }

            while price_index < len(all_prices):
                try:
                    price_val = int(all_prices[price_index])
                    price_index += 1
                    if price_val >= 10:
                        listing['price'] = price_val
                        listing['currency'] = 'USD'
                        break
                except:
                    price_index += 1

            listings.append(listing)

    # Method 3: Extract any remaining long numeric IDs (room IDs)
    room_id_pattern = r'"(\d{15,20})"'
    room_matches = re.findall(room_id_pattern, html)

    for listing_id in room_matches:
        if listing_id not in seen_ids:
            seen_ids.add(listing_id)
            listing = {
                'platform': 'airbnb',
                'platform_id': listing_id,
                'url': f"https://www.airbnb.com/rooms/{listing_id}",
                'photos': [],
                'scraped_at': datetime.now().isoformat(),
                'city': 'Dakar',
            }
            listings.append(listing)

    # Log price extraction stats
    with_price = sum(1 for l in listings if l.get('price'))
    print(f"[Airbnb] Extracted {len(listings)} listings ({with_price} with prices)", file=sys.stderr)
    return listings


def scrape_listing_details(listing_id: str, check_in: str = None, check_out: str = None, session: requests.Session = None) -> dict:
    """Scrape full details from an individual Airbnb listing page

    Args:
        listing_id: The Airbnb listing ID
        check_in: Check-in date (YYYY-MM-DD) for price extraction
        check_out: Check-out date (YYYY-MM-DD) for price extraction
        session: Optional requests session for connection reuse
    """

    # Build URL with dates if provided (needed for price)
    if check_in and check_out:
        url = f"https://www.airbnb.com/rooms/{listing_id}?check_in={check_in}&check_out={check_out}&adults=1"
    else:
        # Default: use dates 7 days from now for price
        from datetime import timedelta
        today = datetime.now()
        check_in = (today + timedelta(days=7)).strftime('%Y-%m-%d')
        check_out = (today + timedelta(days=12)).strftime('%Y-%m-%d')
        url = f"https://www.airbnb.com/rooms/{listing_id}?check_in={check_in}&check_out={check_out}&adults=1"

    # Add source_impression_id for more natural request
    import random
    import string
    impression_id = 'p3_' + ''.join(random.choices(string.digits, k=10)) + '_' + ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    url += f"&source_impression_id={impression_id}"

    print(f"[Airbnb] Fetching details for {listing_id}...", file=sys.stderr)

    try:
        # Try requests first, then Playwright
        html, success = fetch_with_requests(url, session)

        if not html or not success:
            print(f"[Airbnb] Requests failed for details, trying Playwright...", file=sys.stderr)
            html, success = fetch_with_playwright(url, wait_time=3)

        if not html or not success:
            print(f"[Airbnb] Failed to fetch details for {listing_id}", file=sys.stderr)
            return None

        details = {
            'platform': 'airbnb',
            'platform_id': listing_id,
            'url': f"https://www.airbnb.com/rooms/{listing_id}",
            'scraped_at': datetime.now().isoformat(),
        }

        # Extract from JSON-LD structured data
        jsonld_match = re.search(r'application/ld\+json">(\{[^<]+\})', html)
        if jsonld_match:
            try:
                data = json.loads(jsonld_match.group(1))

                # Name/Title
                if 'name' in data:
                    details['title'] = data['name']

                # Description
                if 'description' in data:
                    details['description'] = data['description']

                # Photos
                if 'image' in data and isinstance(data['image'], list):
                    details['photos'] = data['image']

                # Rating
                if 'aggregateRating' in data:
                    rating = data['aggregateRating']
                    if 'ratingValue' in rating:
                        details['rating'] = float(rating['ratingValue'])
                    if 'ratingCount' in rating:
                        try:
                            details['num_reviews'] = int(rating['ratingCount'])
                        except:
                            pass

                # Occupancy/Guests
                if 'containsPlace' in data:
                    place = data['containsPlace']
                    if 'occupancy' in place and 'value' in place['occupancy']:
                        details['max_guests'] = int(place['occupancy']['value'])

            except json.JSONDecodeError:
                pass

        # Extract room type
        room_match = re.search(r'"roomType":"([^"]+)"', html)
        if room_match:
            details['property_type'] = room_match.group(1)

        # Extract bedrooms - try multiple patterns
        bedroom_match = re.search(r'"bedrooms":(\d+)', html)
        if bedroom_match:
            details['bedrooms'] = int(bedroom_match.group(1))
        else:
            # Fallback: look for "X bedroom" text
            bedroom_text = re.search(r'(\d+)\s*bedroom', html, re.IGNORECASE)
            if bedroom_text:
                details['bedrooms'] = int(bedroom_text.group(1))

        # Extract beds
        beds_match = re.search(r'"beds":(\d+)', html)
        if beds_match:
            details['beds'] = int(beds_match.group(1))
        else:
            beds_text = re.search(r'(\d+)\s*bed[^r]', html, re.IGNORECASE)
            if beds_text:
                details['beds'] = int(beds_text.group(1))

        # Extract bathrooms
        bath_match = re.search(r'"bathrooms":(\d+)', html)
        if bath_match:
            details['bathrooms'] = int(bath_match.group(1))
        else:
            bath_text = re.search(r'(\d+)\s*bath', html, re.IGNORECASE)
            if bath_text:
                details['bathrooms'] = int(bath_text.group(1))

        # Extract person capacity
        if 'max_guests' not in details:
            capacity_match = re.search(r'"personCapacity":(\d+)', html)
            if capacity_match:
                details['max_guests'] = int(capacity_match.group(1))
            else:
                guest_text = re.search(r'(\d+)\s*guest', html, re.IGNORECASE)
                if guest_text:
                    details['max_guests'] = int(guest_text.group(1))

        # Extract GPS coordinates
        lat_match = re.search(r'"lat(?:itude)?":(-?\d+\.\d+)', html)
        lng_match = re.search(r'"(?:lng|longitude)":(-?\d+\.\d+)', html)
        if lat_match:
            details['latitude'] = float(lat_match.group(1))
        if lng_match:
            details['longitude'] = float(lng_match.group(1))

        # Extract city/location
        city_match = re.search(r'"city":"([^"]+)"', html)
        if city_match:
            details['city'] = city_match.group(1)

        address_match = re.search(r'"addressLocality":"([^"]+)"', html)
        if address_match:
            details['neighborhood'] = address_match.group(1)

        # Extract host ID
        host_id_match = re.search(r'"hostId":"?(\d+)"?', html)
        if host_id_match:
            details['host_id'] = host_id_match.group(1)

        # Extract host name - try multiple patterns
        host_match = re.search(r'"hostDisplayName":"([^"]+)"', html)
        if host_match:
            details['host_name'] = host_match.group(1)
        else:
            # Fallback: "Hosted by X" pattern
            hosted_by = re.search(r'Hosted by ([^<"]+)', html)
            if hosted_by:
                details['host_name'] = hosted_by.group(1).strip()

        # Extract price - try multiple patterns
        price_patterns = [
            r'\$(\d+)\s*/?\s*night',
            r'(\d+)\s*\$\s*/?\s*night',
            r'"priceString":"[^"]*\$(\d+)',
            r'"price":(\d+)',
            r'"amount":(\d+).*?"currency":"USD"',
        ]
        for pattern in price_patterns:
            price_match = re.search(pattern, html, re.IGNORECASE)
            if price_match:
                try:
                    details['price'] = int(price_match.group(1))
                    details['currency'] = 'USD'
                    break
                except:
                    pass

        # Also try to find price in visible text like "$45 night"
        if 'price' not in details:
            visible_price = re.search(r'\$(\d{2,4})\s*(?:per\s*)?night', html, re.IGNORECASE)
            if visible_price:
                details['price'] = int(visible_price.group(1))
                details['currency'] = 'USD'

        # Extract amenities - filter out noise
        amenities = []
        amenity_pattern = r'"title":"([^"]+)","icon":"[A-Z_]+"'
        amenity_matches = re.findall(amenity_pattern, html)
        if amenity_matches:
            # Get unique amenities, filter out UI elements
            seen = set()
            skip_words = ['report', 'show', 'more', 'less', 'view', 'close', 'back', 'next']
            for a in amenity_matches:
                a_lower = a.lower()
                if (a not in seen and
                    len(a) < 50 and
                    not any(skip in a_lower for skip in skip_words)):
                    amenities.append(a)
                    seen.add(a)
            details['amenities'] = amenities[:25]  # Limit to 25

        # Extract superhost status
        if 'Superhost' in html:
            details['is_superhost'] = True

        return details

    except Exception as e:
        print(f"[Airbnb] Error fetching details for {listing_id}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None


def scrape_airbnb_with_details(city: str = "Dakar", country: str = "Senegal",
                                max_pages: int = 1, max_details: int = 10) -> list:
    """Scrape Airbnb search results AND get full details for each listing"""

    # First get listing IDs from search
    basic_listings = scrape_airbnb_search(city, country, max_pages)

    print(f"\n[Airbnb] Getting details for {min(len(basic_listings), max_details)} listings...", file=sys.stderr)

    detailed_listings = []
    session = requests.Session()  # Reuse session for connection pooling

    for i, listing in enumerate(basic_listings[:max_details]):
        # Get full details
        details = scrape_listing_details(listing['platform_id'], session=session)

        if details:
            # Merge basic and detailed data
            full_listing = {**listing, **details}
            detailed_listings.append(full_listing)
        else:
            # Keep basic listing if details failed
            detailed_listings.append(listing)

        # Rate limit
        if i < max_details - 1:
            delay = 2 + (i * 0.3)
            print(f"[Airbnb] Rate limiting: {delay:.1f}s...", file=sys.stderr)
            time.sleep(delay)

    # Add remaining listings without details
    for listing in basic_listings[max_details:]:
        detailed_listings.append(listing)

    return detailed_listings


def parse_airbnb_card(card) -> dict:
    """Parse a single Airbnb listing card"""

    listing = {
        'platform': 'airbnb',
        'scraped_at': datetime.now().isoformat()
    }

    # Get link/URL
    link = card.css_first('a[href*="/rooms/"]')
    if link:
        href = link.attrib.get('href', '')
        if href:
            listing['url'] = f"https://www.airbnb.com{href}" if href.startswith('/') else href
            # Extract room ID
            match = re.search(r'/rooms/(\d+)', href)
            if match:
                listing['platform_id'] = match.group(1)

    # Get title - extract location from title like "Apartment in Ouakam"
    title_el = card.css_first('[data-testid="listing-card-title"]')
    if not title_el:
        title_el = card.css_first('[id^="title_"]')
    if title_el:
        title_text = title_el.text.strip()
        listing['title'] = title_text
        # Extract neighborhood from "Apartment in Neighborhood"
        location_match = re.search(r'in\s+(.+)$', title_text)
        if location_match:
            listing['neighborhood'] = location_match.group(1)
            listing['city'] = 'Dakar'

    # Get price - try multiple selectors
    price_el = None
    price_selectors = [
        '[data-testid="price-availability-row"]',
        'span._1y74zjx',
        'span[aria-hidden="true"]._1ks8cgb',  # Price span
        '._1jo4hgw',  # Price container
        'div._tt122m',  # Another price pattern
    ]
    for selector in price_selectors:
        price_el = card.css_first(selector)
        if price_el:
            break

    if price_el:
        price_text = price_el.text
        # Try multiple price patterns: "$123", "123 $", "123€", "XOF 12,345"
        patterns = [
            r'\$\s*([\d,]+)',  # $123 or $ 123
            r'([\d,]+)\s*\$',  # 123$ or 123 $
            r'([\d,]+)\s*€',   # 123€
            r'([\d\s,]+)\s*(?:XOF|CFA|FCFA)',  # XOF prices
            r'([\d,]+)\s*/\s*night',  # 123/night
            r'([\d,]+)\s*per night',  # 123 per night
        ]
        for pattern in patterns:
            match = re.search(pattern, price_text.replace('\xa0', ' '), re.IGNORECASE)
            if match:
                price_str = match.group(1).replace(' ', '').replace(',', '')
                try:
                    listing['price'] = int(price_str)
                    break
                except:
                    pass

    # Also try to get price from text content of entire card
    if 'price' not in listing:
        card_text = card.text if hasattr(card, 'text') else ''
        price_match = re.search(r'\$(\d+)', card_text)
        if price_match:
            try:
                listing['price'] = int(price_match.group(1))
            except:
                pass

    # Get rating
    rating_el = card.css_first('[aria-label*="rating"]')
    if not rating_el:
        rating_el = card.css_first('[aria-label*="Rating"]')
    if rating_el:
        match = re.search(r'(\d+[.,]\d+)', rating_el.attrib.get('aria-label', ''))
        if match:
            listing['rating'] = float(match.group(1).replace(',', '.'))

    # Alternative: look for rating in span text like "4.92"
    if 'rating' not in listing:
        spans = card.css('span')
        for span in spans:
            text = span.text.strip() if span.text else ''
            if re.match(r'^\d+\.\d{1,2}$', text):
                try:
                    rating = float(text)
                    if 1.0 <= rating <= 5.0:
                        listing['rating'] = rating
                        break
                except:
                    pass

    # Get all images, not just first one
    imgs = card.css('img[src*="muscache"]')
    if imgs:
        listing['photos'] = [img.attrib.get('src', '') for img in imgs if img.attrib.get('src')]

    # Also check for picture elements with srcset
    if not listing.get('photos'):
        pictures = card.css('picture source')
        if pictures:
            listing['photos'] = []
            for pic in pictures:
                srcset = pic.attrib.get('srcset', '')
                if srcset and 'muscache' in srcset:
                    # Get first URL from srcset
                    first_url = srcset.split(',')[0].split(' ')[0]
                    if first_url and first_url not in listing['photos']:
                        listing['photos'].append(first_url)

    # Get property type/subtitle
    subtitle = card.css_first('[data-testid="listing-card-subtitle"]')
    if not subtitle:
        subtitle = card.css_first('[data-testid="listing-card-name"]')
    if subtitle:
        listing['property_type'] = subtitle.text.strip()

    # Try to extract property type from title
    if not listing.get('property_type') and listing.get('title'):
        prop_match = re.match(r'^(Apartment|Room|House|Villa|Condo|Place|Entire|Private|Shared)',
                              listing['title'], re.IGNORECASE)
        if prop_match:
            listing['property_type'] = prop_match.group(1)

    return listing if listing.get('platform_id') else None


def scrape_expat_dakar_stealth(city: str = "Dakar", max_pages: int = 5):
    """Test Scrapling on Expat-Dakar for comparison"""

    listings = []
    url = f"https://www.expat-dakar.com/immobilier?q={city}"

    print(f"[ExpatDakar] Testing Scrapling on: {url}")

    try:
        # Use regular Fetcher (Expat-Dakar doesn't need stealth)
        page = Fetcher.get(url)

        print(f"[ExpatDakar] Page fetched successfully")

        cards = page.css('.listing-card')
        print(f"[ExpatDakar] Found {len(cards)} listings")

        for card in cards[:10]:
            try:
                link = card.css_first('a[href*="/annonce/"]')
                title_img = card.css_first('img')
                price_el = card.css_first('.listing-card__price__value')

                listing = {
                    'platform': 'expat_dakar',
                    'url': link.attrib.get('href') if link else None,
                    'title': title_img.attrib.get('alt') if title_img else None,
                    'price': price_el.text.strip() if price_el else None,
                    'scraped_at': datetime.now().isoformat()
                }

                if listing['url']:
                    match = re.search(r'-(\d+)$', listing['url'])
                    if match:
                        listing['platform_id'] = match.group(1)
                    listings.append(listing)

            except Exception as e:
                print(f"[ExpatDakar] Error: {e}")

    except Exception as e:
        print(f"[ExpatDakar] Scrape error: {e}")
        import traceback
        traceback.print_exc()

    return listings


def normalize_city(city: str) -> str:
    """Normalize city name to standard format"""
    if not city:
        return 'Dakar'

    city_map = {
        'dakar': 'Dakar',
        'thies': 'Thiès',
        'thiès': 'Thiès',
        'saint-louis': 'Saint-Louis',
        'mbour': 'Mbour',
        'saly': 'Saly',
        'rufisque': 'Rufisque',
    }
    return city_map.get(city.lower().strip(), city)


def determine_region(city: str) -> str:
    """Determine region from city"""
    region_map = {
        'Dakar': 'Dakar',
        'Thiès': 'Thiès',
        'Mbour': 'Thiès',
        'Saly': 'Thiès',
        'Saint-Louis': 'Saint-Louis',
    }
    return region_map.get(city, 'Dakar')


def normalize_amenities(amenities: list) -> list:
    """Normalize amenity names (French/English standardization)"""
    amenity_map = {
        'wifi': 'WiFi',
        'climatisation': 'Air conditioning',
        'air conditioning': 'Air conditioning',
        'parking': 'Parking',
        'piscine': 'Pool',
        'pool': 'Pool',
        'cuisine': 'Kitchen',
        'kitchen': 'Kitchen',
        'tv': 'TV',
        'washer': 'Washer',
    }

    normalized = []
    seen = set()
    skip_words = ['show', 'more', 'less', 'view', 'close', 'automatically translated']

    for amenity in amenities:
        if not amenity or len(amenity) < 2 or len(amenity) > 50:
            continue
        lower = amenity.lower().strip()
        if any(skip in lower for skip in skip_words):
            continue

        normalized_name = amenity_map.get(lower, amenity)
        key = normalized_name.lower()
        if key not in seen:
            seen.add(key)
            normalized.append(normalized_name)

    return normalized[:30]


def calculate_data_quality(listing: dict) -> int:
    """Calculate data quality score (0-100)"""
    score = 0
    if listing.get('title'): score += 10
    if listing.get('description') and len(listing.get('description', '')) > 50: score += 10
    if listing.get('price') and listing['price'] > 0: score += 15
    if listing.get('photos'): score += 10
    if listing.get('location_text'): score += 5
    if listing.get('latitude'): score += 15
    if listing.get('longitude'): score += 15
    if listing.get('host_name'): score += 5
    if listing.get('bedrooms'): score += 5
    if listing.get('amenities'): score += 5
    if listing.get('rating'): score += 5
    return score


def save_to_supabase(listings: list):
    """Save listings to Supabase database with standardized/normalized data

    This function matches the TypeScript normalizer.ts to ensure consistency
    across all scraper sources (Python and TypeScript).
    """
    import os

    # Try to load supabase
    try:
        from supabase import create_client
    except ImportError:
        print("[ERROR] supabase-py not installed. Run: pip install supabase", file=sys.stderr)
        return False

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        return False

    supabase = create_client(supabase_url, supabase_key)

    saved_count = 0
    quality_scores = []

    for listing in listings:
        try:
            # Normalize data (matching TypeScript normalizer.ts)
            city = normalize_city(listing.get('city', 'Dakar'))
            region = determine_region(city)
            amenities = normalize_amenities(listing.get('amenities', []))

            # STANDARDIZED data object matching database schema
            # Columns: id, platform, platform_id, url, title, description, price,
            # currency, location_text, city, region, latitude, longitude, host_name,
            # host_id, num_rooms, num_guests, photos, amenities, rating, num_reviews,
            # status, matched_property_id, is_compliant, compliance_checked_at,
            # first_seen_at, last_seen_at, raw_data, created_at, updated_at
            data = {
                'platform': listing['platform'],
                'platform_id': str(listing['platform_id']),
                'url': listing.get('url'),
                'title': listing.get('title'),
                'description': listing.get('description'),
                'price': listing.get('price'),
                'currency': listing.get('currency', 'USD'),
                'location_text': listing.get('neighborhood') or listing.get('location_text'),
                'city': city,
                'region': region,
                'latitude': listing.get('latitude'),
                'longitude': listing.get('longitude'),
                'host_name': listing.get('host_name'),
                'host_id': listing.get('host_id'),
                'num_rooms': listing.get('bedrooms'),
                'num_guests': listing.get('max_guests'),
                'photos': listing.get('photos', [])[:20],
                'amenities': amenities,
                'rating': listing.get('rating'),
                'num_reviews': listing.get('num_reviews'),
                'raw_data': {
                    'property_type': listing.get('property_type'),
                    'bathrooms': listing.get('bathrooms'),
                    'beds': listing.get('beds'),
                    'is_superhost': listing.get('is_superhost'),
                    'neighborhood': listing.get('neighborhood'),
                    'scraped_at': listing.get('scraped_at'),
                },
                'last_seen_at': datetime.now().isoformat(),
            }

            # Remove None values to avoid database errors
            data = {k: v for k, v in data.items() if v is not None}

            result = supabase.table('scraped_listings').upsert(
                data,
                on_conflict='platform,platform_id'
            ).execute()

            saved_count += 1
            quality_scores.append(calculate_data_quality(listing))

        except Exception as e:
            print(f"[ERROR] Failed to save {listing.get('platform_id')}: {e}", file=sys.stderr)

    avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
    print(f"[Supabase] Saved {saved_count}/{len(listings)} listings (avg quality: {avg_quality:.0f}%)", file=sys.stderr)
    return True


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Scrape Airbnb/Booking with Scrapling')
    parser.add_argument('platform', choices=['airbnb', 'airbnb_full', 'expat_dakar', 'test'],
                        help='Platform to scrape (airbnb_full = with details)')
    parser.add_argument('--city', default='Dakar', help='City to search')
    parser.add_argument('--pages', type=int, default=5, help='Max pages')
    parser.add_argument('--details', type=int, default=0, help='Max listings to get full details for (0=none)')
    parser.add_argument('--output', default='listings.json', help='Output file')
    parser.add_argument('--save-db', action='store_true', help='Save to Supabase database')
    parser.add_argument('--json-stdout', action='store_true', help='Output JSON to stdout (for Node.js)')

    args = parser.parse_args()

    if args.platform == 'airbnb':
        if args.details > 0:
            listings = scrape_airbnb_with_details(args.city, max_pages=args.pages, max_details=args.details)
        else:
            listings = scrape_airbnb_search(args.city, max_pages=args.pages)
    elif args.platform == 'airbnb_full':
        # Full mode: get details for ALL listings found
        listings = scrape_airbnb_with_details(args.city, max_pages=args.pages, max_details=999)
    elif args.platform == 'expat_dakar':
        listings = scrape_expat_dakar_stealth(args.city, max_pages=args.pages)
    elif args.platform == 'test':
        print("Testing both platforms...", file=sys.stderr)
        listings = scrape_expat_dakar_stealth(args.city, max_pages=1)
        print(f"Expat-Dakar: {len(listings)} listings", file=sys.stderr)

        listings_airbnb = scrape_airbnb_search(args.city, max_pages=1)
        print(f"Airbnb: {len(listings_airbnb)} listings", file=sys.stderr)

        listings.extend(listings_airbnb)

    # Output results
    if args.json_stdout:
        # Clean output for Node.js consumption
        print(json.dumps(listings, ensure_ascii=False))
    else:
        print(f"\n{'='*50}", file=sys.stderr)
        print(f"Total listings scraped: {len(listings)}", file=sys.stderr)

        if listings:
            print("\nSample listing:", file=sys.stderr)
            print(json.dumps(listings[0], indent=2, ensure_ascii=False), file=sys.stderr)

            # Save to file
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(listings, f, indent=2, ensure_ascii=False)
            print(f"\nSaved to {args.output}", file=sys.stderr)

    # Optionally save to database
    if args.save_db and listings:
        save_to_supabase(listings)
