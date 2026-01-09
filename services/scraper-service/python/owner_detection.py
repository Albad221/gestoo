#!/usr/bin/env python3
"""
Owner Detection System
Groups scraped listings to identify multi-property operators
"""

import json
import sys
import os
import re
from datetime import datetime
from collections import defaultdict
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'venv', 'lib', 'python3.11', 'site-packages'))


def normalize_phone(phone: str) -> Optional[str]:
    """Normalize phone to +221XXXXXXXXX format"""
    if not phone:
        return None

    digits = ''.join(c for c in str(phone) if c.isdigit())

    # Remove leading zeros or country codes
    if digits.startswith('00221'):
        digits = digits[5:]
    elif digits.startswith('221'):
        digits = digits[3:]
    elif digits.startswith('0'):
        digits = digits[1:]

    # Valid Senegalese numbers: 9 digits starting with 7 or 3
    if len(digits) == 9 and (digits.startswith('7') or digits.startswith('3')):
        return f"+221{digits}"

    return None


def extract_phone_from_listing(listing: dict) -> Optional[str]:
    """Extract and normalize phone from listing data"""
    raw_data = listing.get('raw_data') or {}

    # Try multiple phone fields
    phone_fields = ['phone', 'phoneNumber', 'whatsapp', 'contact_phone']
    for field in phone_fields:
        phone = raw_data.get(field)
        if phone:
            normalized = normalize_phone(phone)
            if normalized:
                return normalized

    return None


def detect_owners(supabase) -> dict:
    """
    Main owner detection algorithm

    Groups listings by:
    1. Phone number (Expat-Dakar, local sites)
    2. Host ID (Airbnb, Booking)
    3. Email (if available)

    Returns stats about detected owners
    """
    print("\n[Owner Detection] Starting analysis...", file=sys.stderr)

    # Fetch all active listings
    result = supabase.table('scraped_listings').select('*').eq('is_active', True).execute()
    listings = result.data

    print(f"[Owner Detection] Analyzing {len(listings)} listings", file=sys.stderr)

    # Group by phone number
    by_phone = defaultdict(list)
    # Group by host_id (platform:id format)
    by_host_id = defaultdict(list)

    for listing in listings:
        # Extract phone
        phone = extract_phone_from_listing(listing)
        if phone:
            by_phone[phone].append(listing)

        # Extract host_id (for Airbnb/Booking)
        host_id = listing.get('host_id')
        platform = listing.get('platform')
        if host_id and platform in ['airbnb', 'booking']:
            key = f"{platform}:{host_id}"
            by_host_id[key].append(listing)

    # Merge groups (some owners may have both phone and host_id)
    owner_groups = []

    # Process phone-based groups
    processed_listing_ids = set()
    for phone, phone_listings in by_phone.items():
        if len(phone_listings) >= 1:  # Include single listings too for tracking
            listing_ids = [l['id'] for l in phone_listings]
            owner_groups.append({
                'match_type': 'phone',
                'identifier': phone,
                'listings': phone_listings,
                'listing_ids': listing_ids,
            })
            processed_listing_ids.update(listing_ids)

    # Process host_id-based groups (only if not already grouped by phone)
    for host_key, host_listings in by_host_id.items():
        # Check if these listings are already in a phone group
        listing_ids = [l['id'] for l in host_listings]
        new_ids = [lid for lid in listing_ids if lid not in processed_listing_ids]

        if new_ids:
            # Filter to only new listings
            new_listings = [l for l in host_listings if l['id'] in new_ids]
            if new_listings:
                owner_groups.append({
                    'match_type': 'host_id',
                    'identifier': host_key,
                    'listings': new_listings,
                    'listing_ids': new_ids,
                })
                processed_listing_ids.update(new_ids)

    print(f"[Owner Detection] Found {len(owner_groups)} owner groups", file=sys.stderr)

    # Save to database
    stats = save_owners_to_db(supabase, owner_groups)

    return stats


def save_owners_to_db(supabase, owner_groups: list) -> dict:
    """Save detected owners to database"""
    stats = {
        'total_owners': 0,
        'multi_property': 0,
        'new_owners': 0,
        'updated_owners': 0,
    }

    for group in owner_groups:
        try:
            listings = group['listings']
            match_type = group['match_type']
            identifier = group['identifier']

            # Collect owner data from listings
            names = set()
            platforms = set()
            host_ids = set()
            total_price = 0
            price_count = 0

            for listing in listings:
                # Names
                host_name = listing.get('host_name')
                if host_name and host_name.strip():
                    names.add(host_name.strip())

                # Platforms
                platforms.add(listing.get('platform'))

                # Host IDs
                if listing.get('host_id'):
                    host_ids.add(f"{listing['platform']}:{listing['host_id']}")

                # Price for revenue estimation
                price = listing.get('price')
                if price and price > 0:
                    total_price += price
                    price_count += 1

            avg_price = int(total_price / price_count) if price_count > 0 else 0
            # Estimate monthly revenue (assume 50% occupancy, 30 days)
            estimated_monthly = avg_price * len(listings) * 15 if avg_price else 0

            # Build owner record
            owner_data = {
                'names': list(names) if names else [],
                'host_ids': list(host_ids) if host_ids else [],
                'platforms': list(platforms),
                'listing_count': len(listings),
                'active_listing_count': len(listings),
                'unregistered_count': len(listings),  # Assume all unregistered initially
                'registered_count': 0,
                'avg_price_per_night': avg_price,
                'estimated_monthly_revenue': estimated_monthly,
                'last_seen_at': datetime.now().isoformat(),
            }

            # Set primary identifier
            if match_type == 'phone':
                owner_data['primary_phone'] = identifier
            elif match_type == 'host_id' and ':' in identifier:
                platform, hid = identifier.split(':', 1)
                # Store the first host_id as reference

            # Check if owner exists (by phone or host_id)
            existing = None
            if match_type == 'phone' and identifier:
                existing_result = supabase.table('detected_owners').select('id').eq('primary_phone', identifier).execute()
                if existing_result.data:
                    existing = existing_result.data[0]

            if existing:
                # Update existing owner
                supabase.table('detected_owners').update(owner_data).eq('id', existing['id']).execute()
                owner_id = existing['id']
                stats['updated_owners'] += 1
            else:
                # Create new owner
                owner_data['first_seen_at'] = datetime.now().isoformat()
                result = supabase.table('detected_owners').insert(owner_data).execute()
                owner_id = result.data[0]['id']
                stats['new_owners'] += 1

            # Link listings to owner
            for listing in listings:
                link_data = {
                    'owner_id': owner_id,
                    'scraped_listing_id': listing['id'],
                    'match_type': match_type,
                    'confidence': 1.0 if match_type == 'phone' else 0.9,
                }
                supabase.table('owner_listings').upsert(
                    link_data,
                    on_conflict='owner_id,scraped_listing_id'
                ).execute()

            # Calculate risk score
            supabase.rpc('calculate_owner_risk_score', {'owner_id_param': owner_id}).execute()

            stats['total_owners'] += 1
            if len(listings) > 1:
                stats['multi_property'] += 1

        except Exception as e:
            print(f"[Owner Detection] Error saving owner: {e}", file=sys.stderr)

    return stats


def generate_owner_report(supabase) -> dict:
    """Generate owner intelligence report"""
    # Get all detected owners with risk scores
    result = supabase.table('detected_owners').select('*').order('risk_score', desc=True).limit(100).execute()
    owners = result.data

    # Get total listings count
    listings_result = supabase.table('scraped_listings').select('id', count='exact').eq('is_active', True).execute()
    total_listings = listings_result.count or 0

    # Calculate stats
    multi_property_owners = [o for o in owners if o.get('listing_count', 0) > 1]
    high_risk_owners = [o for o in owners if o.get('risk_score', 0) >= 50]

    report = {
        'total_owners': len(owners),
        'multi_property_owners': len(multi_property_owners),
        'high_risk_owners': len(high_risk_owners),
        'total_listings': total_listings,
        'coverage_rate': sum(o.get('listing_count', 0) for o in owners) / total_listings if total_listings else 0,
        'top_operators': [],
    }

    # Top operators
    for owner in owners[:10]:
        report['top_operators'].append({
            'phone': owner.get('primary_phone'),
            'names': owner.get('names', []),
            'platforms': owner.get('platforms', []),
            'listing_count': owner.get('listing_count', 0),
            'risk_score': owner.get('risk_score', 0),
            'estimated_monthly_revenue': owner.get('estimated_monthly_revenue', 0),
        })

    return report


def print_report(report: dict):
    """Print formatted owner intelligence report"""
    print("\n" + "=" * 60, file=sys.stderr)
    print("OWNER INTELLIGENCE REPORT", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    print(f"\nTotal Owners Detected: {report['total_owners']}", file=sys.stderr)
    print(f"Multi-Property Operators: {report['multi_property_owners']}", file=sys.stderr)
    print(f"High Risk Owners (50+): {report['high_risk_owners']}", file=sys.stderr)
    print(f"Total Active Listings: {report['total_listings']}", file=sys.stderr)
    print(f"Owner Coverage: {report['coverage_rate']*100:.1f}%", file=sys.stderr)

    print("\n" + "-" * 60, file=sys.stderr)
    print("TOP OPERATORS BY RISK", file=sys.stderr)
    print("-" * 60, file=sys.stderr)

    for i, op in enumerate(report['top_operators'], 1):
        names = ', '.join(op['names'][:2]) if op['names'] else 'Unknown'
        platforms = ', '.join(op['platforms'])
        phone = op['phone'] or 'No phone'
        revenue = f"{op['estimated_monthly_revenue']:,} XOF/mo" if op['estimated_monthly_revenue'] else 'N/A'

        print(f"\n{i}. {names}", file=sys.stderr)
        print(f"   Phone: {phone}", file=sys.stderr)
        print(f"   Platforms: {platforms}", file=sys.stderr)
        print(f"   Listings: {op['listing_count']} | Risk: {op['risk_score']}/100", file=sys.stderr)
        print(f"   Est. Revenue: {revenue}", file=sys.stderr)


if __name__ == '__main__':
    import argparse
    from dotenv import load_dotenv

    load_dotenv()
    load_dotenv('../.env')

    parser = argparse.ArgumentParser(description='Owner Detection System')
    parser.add_argument('command', choices=['detect', 'report'], help='Command to run')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Connect to Supabase
    try:
        from supabase import create_client
    except ImportError:
        print("[ERROR] supabase-py not installed", file=sys.stderr)
        sys.exit(1)

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)

    if args.command == 'detect':
        stats = detect_owners(supabase)
        print(f"\n[Owner Detection] Complete!", file=sys.stderr)
        print(f"  - Total owners: {stats['total_owners']}", file=sys.stderr)
        print(f"  - Multi-property: {stats['multi_property']}", file=sys.stderr)
        print(f"  - New: {stats['new_owners']}", file=sys.stderr)
        print(f"  - Updated: {stats['updated_owners']}", file=sys.stderr)

        if args.json:
            print(json.dumps(stats, indent=2))

    elif args.command == 'report':
        report = generate_owner_report(supabase)

        if args.json:
            print(json.dumps(report, indent=2, ensure_ascii=False))
        else:
            print_report(report)
