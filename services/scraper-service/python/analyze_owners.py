#!/usr/bin/env python
"""Analyze owner/host data to detect multi-property operators"""

from supabase import create_client
import os
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()
load_dotenv('../.env')

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

# Fetch all listings
result = supabase.table('scraped_listings').select('platform, host_name, host_id, raw_data, title, url').execute()

# Group by phone number
phones = defaultdict(list)
host_ids = defaultdict(list)

for r in result.data:
    raw = r.get('raw_data', {}) or {}
    phone = raw.get('phone') or raw.get('phoneNumber')
    host_id = r.get('host_id')

    listing_info = {
        'title': (r.get('title') or '')[:50],
        'platform': r.get('platform'),
        'host_name': r.get('host_name'),
        'url': r.get('url')
    }

    # Group by phone
    if phone:
        digits = ''.join(c for c in str(phone) if c.isdigit())
        if len(digits) >= 9:
            digits = digits[-9:]
            phones[digits].append(listing_info)

    # Group by host_id (Airbnb)
    if host_id:
        host_ids[host_id].append(listing_info)

print('=' * 60)
print('OWNER INTELLIGENCE REPORT')
print('=' * 60)

# Multi-property by phone
multi_by_phone = {p: lst for p, lst in phones.items() if len(lst) > 1}
print(f'\n📞 MULTI-PROPERTY OWNERS BY PHONE: {len(multi_by_phone)}')
for phone, listings in sorted(multi_by_phone.items(), key=lambda x: -len(x[1]))[:10]:
    print(f'\n  +221{phone} ({len(listings)} properties):')
    for l in listings[:3]:
        print(f'    • [{l["platform"]}] {l["title"]}')
    if len(listings) > 3:
        print(f'    ... and {len(listings)-3} more')

# Multi-property by host_id
multi_by_id = {h: lst for h, lst in host_ids.items() if len(lst) > 1}
print(f'\n🏠 MULTI-PROPERTY HOSTS (Airbnb/Booking): {len(multi_by_id)}')
for host_id, listings in sorted(multi_by_id.items(), key=lambda x: -len(x[1]))[:5]:
    host_name = listings[0].get('host_name', 'Unknown')
    print(f'\n  Host: {host_name} (ID: {host_id}) - {len(listings)} properties')
    for l in listings[:3]:
        print(f'    • {l["title"]}')

# Summary
print('\n' + '=' * 60)
print('SUMMARY')
print('=' * 60)
print(f'Total listings: {len(result.data)}')
print(f'Listings with phone: {sum(len(lst) for lst in phones.values())}')
print(f'Unique phone numbers: {len(phones)}')
print(f'Multi-property owners (phone): {len(multi_by_phone)}')
print(f'Listings from multi-owners: {sum(len(l) for l in multi_by_phone.values())}')
print(f'Airbnb hosts with multiple properties: {len(multi_by_id)}')
