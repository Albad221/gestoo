#!/usr/bin/env python3
"""Test database save with correct column mapping"""
import json
import os
import sys

# Redirect output to file
output_file = '/tmp/test_save_output.txt'
sys.stdout = open(output_file, 'w')
sys.stderr = sys.stdout

print("Starting test...", flush=True)

# Set environment variables directly
os.environ['SUPABASE_URL'] = 'https://qqwdxyeqenaaltzfxqla.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd2R4eWVxZW5hYWx0emZ4cWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjAxMzUsImV4cCI6MjA4MzM5NjEzNX0.vtwSemwmh7seAIBwPKFL1MGWFyTZ9-1E3vVAl0lJf_Q'

print("Importing supabase...", flush=True)
from supabase import create_client
from datetime import datetime
print("Imports done", flush=True)

# Load existing listings
script_dir = os.path.dirname(os.path.abspath(__file__))
listings_path = os.path.join(script_dir, 'listings.json')

with open(listings_path, 'r') as f:
    listings = json.load(f)

print(f"Loaded {len(listings)} listings")

# Test a single listing save directly
listing = listings[0]
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

# First, let's see what columns exist in the table
print("\n=== Checking table schema ===", flush=True)
try:
    schema_check = supabase.table('scraped_listings').select('*').limit(1).execute()
    if schema_check.data:
        print(f"Existing columns: {list(schema_check.data[0].keys())}", flush=True)
except Exception as e:
    print(f"Schema check error: {e}", flush=True)

# Based on migration 00005, these columns should exist:
# id, platform, platform_id, url, title, description, location_text, city, neighborhood,
# latitude, longitude, host_name, host_id, host_profile_url, price_per_night, currency,
# property_type, bedrooms, bathrooms, max_guests, amenities, photos, rating, review_count,
# first_seen_at, last_seen_at, is_active, raw_data, created_at
#
# Migration 00006 adds: matched_property_id, is_compliant, compliance_checked_at, region, price

# ACTUAL database columns (verified from query above):
# id, platform, platform_id, url, title, description, price, currency,
# location_text, city, region, latitude, longitude, host_name, host_id,
# num_rooms, num_guests, photos, amenities, rating, num_reviews,
# status, matched_property_id, is_compliant, compliance_checked_at,
# first_seen_at, last_seen_at, raw_data, created_at, updated_at

data = {
    'platform': listing['platform'],
    'platform_id': str(listing['platform_id']),
    'url': listing.get('url'),
    'title': listing.get('title'),
    'description': listing.get('description'),
    'price': listing.get('price'),  # Actual column name
    'currency': listing.get('currency', 'USD'),
    'location_text': listing.get('neighborhood') or listing.get('location_text'),
    'city': listing.get('city', 'Dakar'),
    'region': 'Dakar',  # Default region
    'latitude': listing.get('latitude'),
    'longitude': listing.get('longitude'),
    'host_name': listing.get('host_name'),
    'host_id': listing.get('host_id'),
    'num_rooms': listing.get('bedrooms'),  # Map bedrooms -> num_rooms
    'num_guests': listing.get('max_guests'),  # Map max_guests -> num_guests
    'photos': listing.get('photos', []),
    'amenities': listing.get('amenities', []),
    'rating': listing.get('rating'),
    'num_reviews': listing.get('num_reviews'),  # Actual column name
    'raw_data': {
        'property_type': listing.get('property_type'),
        'bathrooms': listing.get('bathrooms'),
        'beds': listing.get('beds'),
        'is_superhost': listing.get('is_superhost'),
        'neighborhood': listing.get('neighborhood'),
    },
    'last_seen_at': datetime.now().isoformat(),
}

# Remove None values
data = {k: v for k, v in data.items() if v is not None}

print(f"\n=== Data to save ===")
for k, v in data.items():
    if k not in ['photos', 'amenities', 'description']:
        print(f"{k}: {v}")

print(f"\n=== Saving to database ===")
try:
    result = supabase.table('scraped_listings').upsert(
        data,
        on_conflict='platform,platform_id'
    ).execute()
    print(f"Success! Saved listing {listing['platform_id']}")
    if result.data:
        print(f"Returned data keys: {result.data[0].keys() if result.data else 'none'}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

# Verify by reading back
print(f"\n=== Verifying data in database ===", flush=True)
try:
    verify = supabase.table('scraped_listings').select('*').eq('platform_id', listing['platform_id']).execute()
    if verify.data:
        row = verify.data[0]
        print(f"platform_id: {row.get('platform_id')}", flush=True)
        print(f"price: {row.get('price')}", flush=True)
        print(f"latitude: {row.get('latitude')}", flush=True)
        print(f"longitude: {row.get('longitude')}", flush=True)
        print(f"host_name: {row.get('host_name')}", flush=True)
        print(f"host_id: {row.get('host_id')}", flush=True)
        print(f"num_rooms: {row.get('num_rooms')}", flush=True)
        print(f"num_guests: {row.get('num_guests')}", flush=True)
        print(f"raw_data: {row.get('raw_data')}", flush=True)
        print("\n=== SUCCESS! Data saved correctly ===", flush=True)
    else:
        print("No data found", flush=True)
except Exception as e:
    print(f"Verify error: {e}", flush=True)
