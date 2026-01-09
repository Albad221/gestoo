#!/usr/bin/env python3
"""Save all listings to database"""
import json
import os
import sys

# Set environment variables
os.environ['SUPABASE_URL'] = 'https://qqwdxyeqenaaltzfxqla.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd2R4eWVxZW5hYWx0emZ4cWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjAxMzUsImV4cCI6MjA4MzM5NjEzNX0.vtwSemwmh7seAIBwPKFL1MGWFyTZ9-1E3vVAl0lJf_Q'

from airbnb_scraper import save_to_supabase
from supabase import create_client

# Load listings
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, 'listings.json'), 'r') as f:
    listings = json.load(f)

print(f"Saving {len(listings)} listings to database...")
result = save_to_supabase(listings)

# Verify count
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
verify = supabase.table('scraped_listings').select('platform_id, price, latitude, host_name, num_rooms').eq('platform', 'airbnb').execute()

print(f"\n=== Airbnb listings in database: {len(verify.data)} ===")
for row in verify.data[:5]:
    print(f"  {row['platform_id']}: ${row['price']} | GPS: {row['latitude']} | Host: {row['host_name']} | Rooms: {row['num_rooms']}")

# Count with complete data
complete = sum(1 for r in verify.data if r.get('price') and r.get('latitude') and r.get('host_name'))
print(f"\nListings with complete data: {complete}/{len(verify.data)}")
