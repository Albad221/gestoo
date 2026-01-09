#!/usr/bin/env python3
"""Apply the detected_owners migration to Supabase"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()
load_dotenv('../.env')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'venv', 'lib', 'python3.11', 'site-packages'))

from supabase import create_client

supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_key:
    print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

# Read migration file
migration_path = '/Users/aliounebadarambengue/Desktop/dallal/supabase/migrations/00008_detected_owners.sql'
with open(migration_path) as f:
    migration_sql = f.read()

# Split into statements and execute
statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]

print(f"Executing {len(statements)} statements...")

for i, stmt in enumerate(statements):
    if stmt.strip():
        try:
            # Use raw SQL execution via RPC or direct query
            # Note: Supabase doesn't allow DDL via the API, so we'll check if tables exist
            print(f"Statement {i+1}: {stmt[:50]}...")
        except Exception as e:
            print(f"Error on statement {i+1}: {e}")

# Instead, let's check if the tables exist
print("\nChecking if tables exist...")

try:
    result = supabase.table('detected_owners').select('id').limit(1).execute()
    print("detected_owners table exists!")
except Exception as e:
    print(f"detected_owners table NOT found: {e}")
    print("\nPlease run this migration manually in the Supabase SQL Editor:")
    print(f"  1. Go to your Supabase dashboard")
    print(f"  2. Open SQL Editor")
    print(f"  3. Copy/paste the contents of: {migration_path}")
    print(f"  4. Run the migration")
