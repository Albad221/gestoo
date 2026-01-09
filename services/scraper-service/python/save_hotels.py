#!/usr/bin/env python3
"""
Load hotels from JSON and save to Supabase.
Run after adding google_places enum value.
"""

import os
import sys
import json
from datetime import datetime

def save_hotels():
    try:
        from supabase import create_client
    except ImportError:
        print("[ERROR] Run: pip install supabase")
        return False

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return False

    # Load hotels
    json_path = os.path.join(os.path.dirname(__file__), 'hotels_senegal.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        hotels = json.load(f)

    print(f"Loaded {len(hotels)} hotels")

    supabase = create_client(supabase_url, supabase_key)

    saved = 0
    errors = 0

    for hotel in hotels:
        try:
            data = {
                'platform': 'google_places',
                'platform_id': hotel['platform_id'],
                'url': hotel['url'],
                'title': hotel['title'],
                'description': hotel.get('description'),
                'price': hotel.get('price'),
                'currency': hotel.get('currency'),
                'location_text': hotel.get('location_text'),
                'city': hotel.get('city'),
                'latitude': hotel.get('latitude'),
                'longitude': hotel.get('longitude'),
                'host_name': None,
                'num_rooms': None,
                'num_guests': None,
                'photos': hotel.get('photos', []),
                'amenities': [],
                'rating': hotel.get('rating'),
                'num_reviews': hotel.get('num_reviews'),
                'raw_data': {
                    'phone': hotel.get('phone'),
                    'website': hotel.get('website'),
                    'property_type': hotel.get('property_type'),
                    'price_level': hotel.get('price_level'),
                    'business_status': hotel.get('business_status'),
                    'types': hotel.get('types'),
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

            if saved % 50 == 0:
                print(f"  Saved {saved}...")

        except Exception as e:
            print(f"Error: {e}")
            errors += 1
            if errors > 5:
                print("Too many errors, stopping")
                break

    print(f"\n=== RESULTS ===")
    print(f"Hotels saved: {saved}")
    print(f"Errors: {errors}")

    # Get total count
    try:
        result = supabase.table('scraped_listings').select('platform', count='exact').execute()
        print(f"Total listings in DB: {result.count}")
    except:
        pass

    return saved > 0


if __name__ == '__main__':
    save_hotels()
