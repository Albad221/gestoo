#!/usr/bin/env python3
"""
Google Places API Scraper for Hotels, Auberges, etc.
Gets comprehensive data with phone numbers, addresses, ratings.

Usage:
    # Set your API key
    export GOOGLE_PLACES_API_KEY=your_key_here

    # Run
    python google_places_scraper.py --city Dakar --type hotel
    python google_places_scraper.py --city Dakar --type lodging --save-db
"""

import os
import sys
import json
import time
import requests
from datetime import datetime

# Google Places API
GOOGLE_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY') or os.environ.get('GOOGLE_API_KEY')

# Place types for accommodations
ACCOMMODATION_TYPES = [
    'lodging',           # All lodging
    'hotel',             # Hotels
    'guest_house',       # Guest houses / Auberges
    'motel',             # Motels
    'resort',            # Resorts
    'campground',        # Campgrounds
]

# Senegal cities to search
SENEGAL_CITIES = [
    {'name': 'Dakar', 'lat': 14.6937, 'lng': -17.4441},
    {'name': 'Saint-Louis', 'lat': 16.0326, 'lng': -16.4818},
    {'name': 'Thiès', 'lat': 14.7886, 'lng': -16.9260},
    {'name': 'Mbour', 'lat': 14.4167, 'lng': -16.9667},
    {'name': 'Saly', 'lat': 14.4500, 'lng': -17.0167},
    {'name': 'Ziguinchor', 'lat': 12.5833, 'lng': -16.2667},
    {'name': 'Cap Skirring', 'lat': 12.3833, 'lng': -16.7500},
    {'name': 'Touba', 'lat': 14.8500, 'lng': -15.8833},
    {'name': 'Kaolack', 'lat': 14.1500, 'lng': -16.0667},
    {'name': 'Tambacounda', 'lat': 13.7667, 'lng': -13.6667},
]


def search_places(lat: float, lng: float, place_type: str, radius: int = 10000) -> list:
    """Search for places using Google Places API Nearby Search"""

    if not GOOGLE_API_KEY:
        print("[ERROR] GOOGLE_PLACES_API_KEY not set", file=sys.stderr)
        return []

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

    all_results = []
    next_page_token = None

    for page in range(3):  # Max 3 pages (60 results)
        params = {
            'location': f'{lat},{lng}',
            'radius': radius,
            'type': place_type,
            'key': GOOGLE_API_KEY,
        }

        if next_page_token:
            params['pagetoken'] = next_page_token
            time.sleep(2)  # Required delay for pagetoken

        response = requests.get(url, params=params, timeout=30)
        data = response.json()

        if data.get('status') != 'OK' and data.get('status') != 'ZERO_RESULTS':
            print(f"[ERROR] API error: {data.get('status')} - {data.get('error_message', '')}", file=sys.stderr)
            break

        results = data.get('results', [])
        all_results.extend(results)

        print(f"  Page {page + 1}: {len(results)} results", file=sys.stderr)

        next_page_token = data.get('next_page_token')
        if not next_page_token:
            break

    return all_results


def get_place_details(place_id: str) -> dict:
    """Get detailed info including phone number"""

    if not GOOGLE_API_KEY:
        return {}

    url = "https://maps.googleapis.com/maps/api/place/details/json"

    params = {
        'place_id': place_id,
        'fields': 'name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,price_level,types,geometry,photos,opening_hours,business_status',
        'key': GOOGLE_API_KEY,
    }

    try:
        response = requests.get(url, params=params, timeout=60)
        data = response.json()

        if data.get('status') == 'OK':
            return data.get('result', {})
    except requests.exceptions.Timeout:
        print("timeout", end=' ', file=sys.stderr)
    except Exception as e:
        print(f"err:{e}", end=' ', file=sys.stderr)

    return {}


def normalize_place(place: dict, details: dict, city: str) -> dict:
    """Convert Google Places data to our standard format"""

    location = place.get('geometry', {}).get('location', {})

    # Get photo URL if available
    photos = []
    if details.get('photos'):
        for photo in details['photos'][:5]:
            photo_ref = photo.get('photo_reference')
            if photo_ref:
                photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_API_KEY}"
                photos.append(photo_url)

    # Determine property type
    types = place.get('types', [])
    if 'hotel' in types:
        prop_type = 'Hotel'
    elif 'guest_house' in types:
        prop_type = 'Auberge'
    elif 'resort' in types:
        prop_type = 'Resort'
    elif 'motel' in types:
        prop_type = 'Motel'
    elif 'campground' in types:
        prop_type = 'Camping'
    else:
        prop_type = 'Lodging'

    return {
        'platform': 'google_places',
        'platform_id': place.get('place_id'),
        'url': details.get('url') or f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id')}",
        'title': place.get('name'),
        'description': None,
        'price': None,  # Google doesn't give exact price
        'price_level': details.get('price_level'),  # 0-4 scale
        'currency': 'XOF',
        'location_text': details.get('formatted_address') or place.get('vicinity'),
        'city': city,
        'latitude': location.get('lat'),
        'longitude': location.get('lng'),
        'phone': details.get('international_phone_number') or details.get('formatted_phone_number'),
        'website': details.get('website'),
        'property_type': prop_type,
        'rating': place.get('rating'),
        'num_reviews': place.get('user_ratings_total'),
        'photos': photos,
        'business_status': details.get('business_status'),
        'is_open': details.get('opening_hours', {}).get('open_now'),
        'types': types,
        'scraped_at': datetime.now().isoformat(),
    }


def scrape_city(city_name: str, lat: float, lng: float, place_types: list = None, get_details: bool = True) -> list:
    """Scrape all accommodations in a city"""

    if place_types is None:
        place_types = ACCOMMODATION_TYPES

    all_places = {}

    for ptype in place_types:
        print(f"\n[{city_name}] Searching {ptype}...", file=sys.stderr)
        results = search_places(lat, lng, ptype, radius=15000)

        for place in results:
            pid = place.get('place_id')
            if pid and pid not in all_places:
                all_places[pid] = place

    print(f"\n[{city_name}] Found {len(all_places)} unique places", file=sys.stderr)

    # Get details with phone numbers
    listings = []

    for i, (pid, place) in enumerate(all_places.items()):
        if get_details:
            print(f"  [{i+1}/{len(all_places)}] Getting details...", end=' ', file=sys.stderr)
            details = get_place_details(pid)
            phone = details.get('international_phone_number') or details.get('formatted_phone_number')
            print(f"📞 {phone}" if phone else "No phone", file=sys.stderr)
            time.sleep(0.1)  # Rate limiting
        else:
            details = {}

        listing = normalize_place(place, details, city_name)
        listings.append(listing)

    return listings


def save_to_supabase(listings: list):
    """Save listings to Supabase database"""
    try:
        from supabase import create_client
    except ImportError:
        print("[ERROR] supabase-py not installed", file=sys.stderr)
        return False

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        return False

    supabase = create_client(supabase_url, supabase_key)

    saved = 0
    for listing in listings:
        try:
            data = {
                'platform': listing['platform'],
                'platform_id': listing['platform_id'],
                'url': listing['url'],
                'title': listing['title'],
                'description': listing.get('description'),
                'price': listing.get('price'),
                'currency': listing.get('currency'),
                'location_text': listing.get('location_text'),
                'city': listing.get('city'),
                'latitude': listing.get('latitude'),
                'longitude': listing.get('longitude'),
                'host_name': None,  # Hotels don't have individual hosts
                'num_rooms': None,
                'num_guests': None,
                'photos': listing.get('photos', []),
                'amenities': [],
                'rating': listing.get('rating'),
                'num_reviews': listing.get('num_reviews'),
                'raw_data': {
                    'phone': listing.get('phone'),
                    'website': listing.get('website'),
                    'property_type': listing.get('property_type'),
                    'price_level': listing.get('price_level'),
                    'business_status': listing.get('business_status'),
                    'types': listing.get('types'),
                },
                'last_seen_at': datetime.now().isoformat(),
            }

            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}

            supabase.table('scraped_listings').upsert(
                data,
                on_conflict='platform,platform_id'
            ).execute()
            saved += 1

        except Exception as e:
            print(f"[ERROR] Failed to save {listing.get('title')}: {e}", file=sys.stderr)

    print(f"[Supabase] Saved {saved}/{len(listings)} listings", file=sys.stderr)
    return True


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Scrape hotels/lodging from Google Places')
    parser.add_argument('--city', default='Dakar', help='City to search')
    parser.add_argument('--type', default='lodging', choices=['lodging', 'hotel', 'guest_house', 'all'],
                        help='Place type to search')
    parser.add_argument('--all-cities', action='store_true', help='Scrape all Senegal cities')
    parser.add_argument('--no-details', action='store_true', help='Skip getting details (faster but no phone)')
    parser.add_argument('--output', default='hotels.json', help='Output file')
    parser.add_argument('--save-db', action='store_true', help='Save to Supabase database')

    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        print("ERROR: Set GOOGLE_PLACES_API_KEY environment variable")
        print("Get a key at: https://console.cloud.google.com/apis/credentials")
        print("Enable 'Places API' and 'Places API (New)'")
        sys.exit(1)

    # Determine place types
    if args.type == 'all':
        place_types = ACCOMMODATION_TYPES
    else:
        place_types = [args.type]

    all_listings = []

    if args.all_cities:
        for city in SENEGAL_CITIES:
            listings = scrape_city(city['name'], city['lat'], city['lng'],
                                   place_types, get_details=not args.no_details)
            all_listings.extend(listings)
    else:
        # Find city coordinates
        city_data = next((c for c in SENEGAL_CITIES if c['name'].lower() == args.city.lower()), None)
        if city_data:
            lat, lng = city_data['lat'], city_data['lng']
        else:
            # Default to Dakar
            lat, lng = 14.6937, -17.4441

        all_listings = scrape_city(args.city, lat, lng, place_types, get_details=not args.no_details)

    # Summary
    with_phone = [l for l in all_listings if l.get('phone')]
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total places found: {len(all_listings)}", file=sys.stderr)
    print(f"With phone number: {len(with_phone)} ({len(with_phone)*100//max(len(all_listings),1)}%)", file=sys.stderr)

    # By type
    by_type = {}
    for l in all_listings:
        t = l.get('property_type', 'Unknown')
        by_type[t] = by_type.get(t, 0) + 1
    print("\nBy type:", file=sys.stderr)
    for t, c in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}", file=sys.stderr)

    # Sample with phone
    if with_phone:
        print("\nSample with phone:", file=sys.stderr)
        for l in with_phone[:5]:
            print(f"  📞 {l['phone']} - {l['title']}", file=sys.stderr)

    # Save to file
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(all_listings, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {args.output}", file=sys.stderr)

    # Save to database
    if args.save_db:
        save_to_supabase(all_listings)
