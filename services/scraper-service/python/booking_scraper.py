#!/usr/bin/env python3
"""
Booking.com Senegal Scraper
Uses requests with anti-bot headers, falls back to Playwright if blocked
"""

import json
import sys
import os
import re
import time
import requests
from datetime import datetime, timedelta
from urllib.parse import urlencode
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'venv', 'lib', 'python3.11', 'site-packages'))

# City to Booking.com destination ID mapping
DESTINATION_IDS = {
    'dakar': '-2271854',
    'saint-louis': '-2280036',
    'saly': '-2279538',
    'mbour': '-2275689',
    'cap skirring': '-2269855',
    'ziguinchor': '-2282912',
    'thies': '-2281143',
    'senegal': '-2271854',
}

# Anti-bot headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
}


def build_search_url(city: str, page: int = 0, check_in: str = None, check_out: str = None) -> str:
    """Build Booking.com search URL"""
    if not check_in:
        today = datetime.now()
        check_in = (today + timedelta(days=7)).strftime('%Y-%m-%d')
        check_out = (today + timedelta(days=12)).strftime('%Y-%m-%d')

    dest_id = DESTINATION_IDS.get(city.lower(), DESTINATION_IDS['dakar'])

    params = {
        'ss': f'{city}, Senegal',
        'dest_id': dest_id,
        'dest_type': 'city',
        'checkin': check_in,
        'checkout': check_out,
        'group_adults': '2',
        'no_rooms': '1',
        'group_children': '0',
        'nflt': 'ht_id=201;ht_id=220',  # Apartments + Vacation Homes
        'order': 'popularity',
        'selected_currency': 'XOF',
    }

    if page > 0:
        params['offset'] = str(page * 25)

    return f"https://www.booking.com/searchresults.fr.html?{urlencode(params)}"


def fetch_with_requests(url: str, session: requests.Session = None) -> tuple:
    """Fetch URL with requests, return (html, success)"""
    if session is None:
        session = requests.Session()

    try:
        response = session.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()

        # Check if blocked
        if 'captcha' in response.text.lower() or response.status_code == 403:
            return None, False

        return response.text, True
    except Exception as e:
        print(f"[Booking] Request error: {e}", file=sys.stderr)
        return None, False


def fetch_with_playwright(url: str) -> tuple:
    """Fetch URL with Playwright stealth browser"""
    try:
        from scrapling.fetchers import StealthyFetcher

        page = StealthyFetcher.fetch(
            url,
            headless=True,
            wait=8,
        )
        return str(page.html_content), True
    except Exception as e:
        print(f"[Booking] Playwright error: {e}", file=sys.stderr)
        return None, False


def scrape_booking_search(city: str = "Dakar", max_pages: int = 3, use_browser: bool = False) -> list:
    """Scrape Booking.com search results"""
    all_listings = []
    session = requests.Session()

    for page_num in range(max_pages):
        url = build_search_url(city, page_num)

        print(f"\n[Booking] Page {page_num + 1}/{max_pages} - {city}...", file=sys.stderr)
        print(f"[Booking] URL: {url}", file=sys.stderr)

        # Try requests first, fall back to Playwright
        if use_browser:
            html, success = fetch_with_playwright(url)
        else:
            html, success = fetch_with_requests(url, session)
            if not success:
                print("[Booking] Requests blocked, trying Playwright...", file=sys.stderr)
                html, success = fetch_with_playwright(url)
                use_browser = True  # Switch to browser for remaining pages

        if not success or not html:
            print(f"[Booking] Failed to fetch page {page_num + 1}", file=sys.stderr)
            continue

        print(f"[Booking] Page fetched successfully", file=sys.stderr)

        # Save debug HTML
        if page_num == 0:
            with open('/tmp/booking_debug.html', 'w') as f:
                f.write(html)
            print("[Booking] Debug HTML saved to /tmp/booking_debug.html", file=sys.stderr)

        # Parse listings
        page_listings = parse_search_results(html)

        print(f"[Booking] Extracted {len(page_listings)} listings", file=sys.stderr)

        if not page_listings:
            break

        all_listings.extend(page_listings)

        # Rate limiting
        if page_num < max_pages - 1:
            delay = 3 + page_num
            print(f"[Booking] Waiting {delay}s...", file=sys.stderr)
            time.sleep(delay)

    return all_listings


def parse_search_results(html: str) -> list:
    """Parse Booking.com search results HTML"""
    listings = []
    seen_ids = set()

    soup = BeautifulSoup(html, 'html.parser')

    # Find property cards
    cards = soup.select('[data-testid="property-card"]')
    if not cards:
        cards = soup.select('.sr_property_block')
    if not cards:
        cards = soup.select('[data-hotelid]')

    print(f"[Booking] Found {len(cards)} property cards", file=sys.stderr)

    for card in cards:
        try:
            listing = parse_card(card)
            if listing and listing.get('platform_id') and listing['platform_id'] not in seen_ids:
                seen_ids.add(listing['platform_id'])
                listings.append(listing)
        except Exception as e:
            print(f"[Booking] Card parse error: {e}", file=sys.stderr)

    # Fallback: extract from JSON
    if len(listings) < 3:
        json_listings = extract_from_json(html)
        for listing in json_listings:
            if listing.get('platform_id') and listing['platform_id'] not in seen_ids:
                seen_ids.add(listing['platform_id'])
                listings.append(listing)

    return listings


def parse_card(card) -> dict:
    """Parse a single property card"""
    listing = {
        'platform': 'booking',
        'scraped_at': datetime.now().isoformat(),
        'currency': 'XOF',
    }

    # Get hotel ID
    hotel_id = card.get('data-hotelid')
    if not hotel_id:
        link = card.select_one('a[href*="/hotel/"]')
        if link:
            href = link.get('href', '')
            match = re.search(r'/hotel/sn/([^/.?]+)', href)
            if match:
                hotel_id = match.group(1)
            else:
                match = re.search(r'hotel_id=(\d+)', href)
                if match:
                    hotel_id = match.group(1)

    if hotel_id:
        listing['platform_id'] = hotel_id
        listing['url'] = f"https://www.booking.com/hotel/sn/{hotel_id}.fr.html"

    # Title
    title_el = card.select_one('[data-testid="title"]') or card.select_one('.sr-hotel__name') or card.select_one('h3')
    if title_el:
        listing['title'] = title_el.get_text(strip=True)

    # Price
    price_el = (card.select_one('[data-testid="price-and-discounted-price"]') or
                card.select_one('.bui-price-display__value') or
                card.select_one('.prco-valign-middle-helper'))

    if price_el:
        price_text = price_el.get_text()
        price_match = re.search(r'([\d\s]+)', price_text.replace('\xa0', ' '))
        if price_match:
            try:
                listing['price'] = int(price_match.group(1).replace(' ', '').replace(',', ''))
            except:
                pass

        if 'XOF' in price_text or 'CFA' in price_text:
            listing['currency'] = 'XOF'
        elif '€' in price_text:
            listing['currency'] = 'EUR'
        elif '$' in price_text:
            listing['currency'] = 'USD'

    # Location
    loc_el = card.select_one('[data-testid="address"]') or card.select_one('.sr_card_address_line')
    if loc_el:
        listing['location_text'] = loc_el.get_text(strip=True)
        parts = listing['location_text'].split(',')
        if len(parts) >= 2:
            listing['neighborhood'] = parts[0].strip()
            listing['city'] = parts[1].strip()

    # Rating (10-point scale)
    rating_el = card.select_one('[data-testid="review-score"]') or card.select_one('.bui-review-score__badge')
    if rating_el:
        rating_text = rating_el.get_text(strip=True)
        rating_match = re.search(r'(\d+[.,]?\d*)', rating_text)
        if rating_match:
            rating = float(rating_match.group(1).replace(',', '.'))
            listing['rating'] = round(rating / 2, 1) if rating > 5 else rating

    # Review count
    review_el = card.select_one('.bui-review-score__text')
    if review_el:
        review_text = review_el.get_text()
        review_match = re.search(r'(\d[\d\s]*)', review_text)
        if review_match:
            listing['num_reviews'] = int(review_match.group(1).replace(' ', ''))

    # Image
    img_el = card.select_one('img[data-testid="image"]') or card.select_one('.hotel_image') or card.select_one('img')
    if img_el:
        src = img_el.get('src') or img_el.get('data-src')
        if src and not src.startswith('data:'):
            listing['photos'] = [src]

    # Property type
    if listing.get('title'):
        listing['property_type'] = detect_property_type(listing['title'])

    return listing if listing.get('platform_id') else None


def extract_from_json(html: str) -> list:
    """Extract listings from embedded JSON"""
    listings = []

    patterns = [
        r'"hotels"\s*:\s*(\[.*?\])',
        r'"properties"\s*:\s*(\[.*?\])',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, html, re.DOTALL)
        for match in matches[:1]:  # Take first match only
            try:
                data = json.loads(match)
                for item in data[:30]:  # Limit
                    listing = {
                        'platform': 'booking',
                        'scraped_at': datetime.now().isoformat(),
                    }

                    if 'hotel_id' in item:
                        listing['platform_id'] = str(item['hotel_id'])
                    elif 'id' in item:
                        listing['platform_id'] = str(item['id'])

                    if 'hotel_name' in item:
                        listing['title'] = item['hotel_name']
                    elif 'name' in item:
                        listing['title'] = item['name']

                    if 'min_total_price' in item:
                        listing['price'] = int(item['min_total_price'])

                    if 'review_score' in item and item['review_score']:
                        rating = float(item['review_score'])
                        listing['rating'] = round(rating / 2, 1) if rating > 5 else rating

                    if 'review_nr' in item:
                        listing['num_reviews'] = int(item['review_nr'])

                    if 'latitude' in item:
                        listing['latitude'] = float(item['latitude'])
                    if 'longitude' in item:
                        listing['longitude'] = float(item['longitude'])

                    if listing.get('platform_id'):
                        listing['url'] = f"https://www.booking.com/hotel/sn/{listing['platform_id']}.fr.html"
                        listings.append(listing)
            except:
                pass

    return listings


def scrape_listing_details(listing_id: str, session: requests.Session = None) -> dict:
    """Scrape full details from listing page"""
    url = f"https://www.booking.com/hotel/sn/{listing_id}.fr.html"

    print(f"[Booking] Fetching details for {listing_id}...", file=sys.stderr)

    html, success = fetch_with_requests(url, session)
    if not success:
        html, success = fetch_with_playwright(url)

    if not success or not html:
        return None

    soup = BeautifulSoup(html, 'html.parser')

    details = {
        'platform': 'booking',
        'platform_id': listing_id,
        'url': url,
        'scraped_at': datetime.now().isoformat(),
    }

    # Title
    title_el = soup.select_one('h2.pp-header__title') or soup.select_one('#hp_hotel_name')
    if title_el:
        details['title'] = title_el.get_text(strip=True)

    # Description
    desc_el = soup.select_one('[data-testid="property-description"]') or soup.select_one('#property_description_content')
    if desc_el:
        details['description'] = desc_el.get_text(strip=True)[:2000]

    # Location
    loc_el = soup.select_one('[data-testid="address"]') or soup.select_one('.hp_address_subtitle')
    if loc_el:
        details['location_text'] = loc_el.get_text(strip=True)
        parts = details['location_text'].split(',')
        if len(parts) >= 2:
            details['neighborhood'] = parts[0].strip()
            details['city'] = parts[1].strip()

    # GPS from scripts
    lat_match = re.search(r'b_map_center_latitude["\s:=]+(-?\d+\.?\d*)', html)
    lng_match = re.search(r'b_map_center_longitude["\s:=]+(-?\d+\.?\d*)', html)
    if lat_match:
        details['latitude'] = float(lat_match.group(1))
    if lng_match:
        details['longitude'] = float(lng_match.group(1))

    # Alternative GPS
    if 'latitude' not in details:
        geo_match = re.search(r'"latitude"\s*:\s*(-?\d+\.?\d*)', html)
        if geo_match:
            details['latitude'] = float(geo_match.group(1))
    if 'longitude' not in details:
        geo_match = re.search(r'"longitude"\s*:\s*(-?\d+\.?\d*)', html)
        if geo_match:
            details['longitude'] = float(geo_match.group(1))

    # Amenities
    amenities = []
    for el in soup.select('[data-testid="property-most-popular-facilities-wrapper"] li, .hp_desc_important_facilities li'):
        text = el.get_text(strip=True)
        if text and len(text) < 100:
            amenities.append(text)
    details['amenities'] = amenities[:30]

    # Photos
    photos = []
    for img in soup.select('[data-testid="gallery-image"] img, .bh-photo-grid img'):
        src = img.get('src') or img.get('data-src')
        if src and not src.startswith('data:'):
            photos.append(src.replace('max200', 'max1024'))
    details['photos'] = photos[:15]

    # Room details from text
    page_text = html.lower()

    bedroom_match = re.search(r'(\d+)\s*(?:chambre|bedroom)', page_text)
    if bedroom_match:
        details['bedrooms'] = int(bedroom_match.group(1))

    bath_match = re.search(r'(\d+)\s*(?:salle de bain|bathroom)', page_text)
    if bath_match:
        details['bathrooms'] = int(bath_match.group(1))

    guest_match = re.search(r'(\d+)\s*(?:personne|guest|voyageur)', page_text)
    if guest_match:
        details['max_guests'] = int(guest_match.group(1))

    # Property type
    if details.get('title'):
        details['property_type'] = detect_property_type(details['title'])

    # Host
    host_el = soup.select_one('[data-testid="host-name"]') or soup.select_one('.hp_hotel_operator_name')
    if host_el:
        details['host_name'] = host_el.get_text(strip=True)

    return details


def scrape_booking_with_details(city: str = "Dakar", max_pages: int = 2, max_details: int = 10) -> list:
    """Scrape search + full details"""
    basic_listings = scrape_booking_search(city, max_pages)

    print(f"\n[Booking] Getting details for {min(len(basic_listings), max_details)} listings...", file=sys.stderr)

    session = requests.Session()
    detailed_listings = []

    for i, listing in enumerate(basic_listings[:max_details]):
        details = scrape_listing_details(listing['platform_id'], session)

        if details:
            full_listing = {**listing, **details}
            detailed_listings.append(full_listing)
        else:
            detailed_listings.append(listing)

        if i < max_details - 1:
            delay = 2 + (i * 0.3)
            print(f"[Booking] Rate limiting: {delay:.1f}s...", file=sys.stderr)
            time.sleep(delay)

    detailed_listings.extend(basic_listings[max_details:])
    return detailed_listings


def detect_property_type(text: str) -> str:
    """Detect property type from text"""
    lower = text.lower()
    if 'villa' in lower:
        return 'villa'
    if 'studio' in lower:
        return 'studio'
    if any(x in lower for x in ['appartement', 'apartment']):
        return 'apartment'
    if any(x in lower for x in ['maison', 'house']):
        return 'house'
    if 'chambre' in lower or 'room' in lower:
        return 'room'
    if 'hotel' in lower or 'hôtel' in lower:
        return 'hotel'
    return 'other'


def normalize_city(city: str) -> str:
    if not city:
        return 'Dakar'
    city_map = {
        'dakar': 'Dakar',
        'thies': 'Thiès',
        'saint-louis': 'Saint-Louis',
        'mbour': 'Mbour',
        'saly': 'Saly',
    }
    return city_map.get(city.lower().strip(), city)


def determine_region(city: str) -> str:
    region_map = {
        'Dakar': 'Dakar',
        'Thiès': 'Thiès',
        'Mbour': 'Thiès',
        'Saly': 'Thiès',
        'Saint-Louis': 'Saint-Louis',
    }
    return region_map.get(city, 'Dakar')


def save_to_supabase(listings: list) -> bool:
    """Save listings to Supabase"""
    try:
        from supabase import create_client
    except ImportError:
        print("[ERROR] supabase-py not installed", file=sys.stderr)
        return False

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        return False

    supabase = create_client(supabase_url, supabase_key)
    saved_count = 0

    for listing in listings:
        try:
            city = normalize_city(listing.get('city', 'Dakar'))
            region = determine_region(city)

            data = {
                'platform': 'booking',
                'platform_id': str(listing['platform_id']),
                'url': listing.get('url'),
                'title': listing.get('title'),
                'description': listing.get('description'),
                'price': listing.get('price'),
                'currency': listing.get('currency', 'XOF'),
                'location_text': listing.get('location_text'),
                'city': city,
                'region': region,
                'latitude': listing.get('latitude'),
                'longitude': listing.get('longitude'),
                'host_name': listing.get('host_name'),
                'num_rooms': listing.get('bedrooms'),
                'num_guests': listing.get('max_guests'),
                'photos': listing.get('photos', [])[:20],
                'amenities': listing.get('amenities', [])[:30],
                'rating': listing.get('rating'),
                'num_reviews': listing.get('num_reviews'),
                'raw_data': {
                    'property_type': listing.get('property_type'),
                    'bathrooms': listing.get('bathrooms'),
                    'neighborhood': listing.get('neighborhood'),
                    'scraped_at': listing.get('scraped_at'),
                },
                'last_seen_at': datetime.now().isoformat(),
            }

            data = {k: v for k, v in data.items() if v is not None}

            supabase.table('scraped_listings').upsert(
                data,
                on_conflict='platform,platform_id'
            ).execute()

            saved_count += 1

        except Exception as e:
            print(f"[ERROR] Failed to save {listing.get('platform_id')}: {e}", file=sys.stderr)

    print(f"[Supabase] Saved {saved_count}/{len(listings)} listings", file=sys.stderr)
    return True


if __name__ == '__main__':
    import argparse
    from dotenv import load_dotenv

    load_dotenv()
    load_dotenv('../.env')

    parser = argparse.ArgumentParser(description='Scrape Booking.com')
    parser.add_argument('--city', default='Dakar', help='City to search')
    parser.add_argument('--pages', type=int, default=2, help='Max pages')
    parser.add_argument('--details', type=int, default=5, help='Max listings for full details')
    parser.add_argument('--output', default='booking_listings.json', help='Output file')
    parser.add_argument('--save-db', action='store_true', help='Save to Supabase')
    parser.add_argument('--browser', action='store_true', help='Force browser mode')

    args = parser.parse_args()

    print(f"\n[Booking] Starting scrape for {args.city}...", file=sys.stderr)

    if args.details > 0:
        listings = scrape_booking_with_details(args.city, args.pages, args.details)
    else:
        listings = scrape_booking_search(args.city, args.pages, args.browser)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total listings scraped: {len(listings)}", file=sys.stderr)

    if listings:
        print("\nSample listing:", file=sys.stderr)
        print(json.dumps(listings[0], indent=2, ensure_ascii=False), file=sys.stderr)

        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(listings, f, indent=2, ensure_ascii=False)
        print(f"\nSaved to {args.output}", file=sys.stderr)

    if args.save_db and listings:
        save_to_supabase(listings)
