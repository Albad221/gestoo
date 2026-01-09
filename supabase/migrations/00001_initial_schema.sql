-- Teranga Safe Initial Schema Migration
-- Version: 00001
-- Description: Core tables for landlords, properties, guests, stays, payments, and alerts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable vector extension for image embeddings (if available)
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE property_type AS ENUM (
  'hotel',
  'meuble',
  'guesthouse',
  'short_term'
);

CREATE TYPE property_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'rejected'
);

CREATE TYPE document_type AS ENUM (
  'cni',
  'passport',
  'cedeao_id',
  'residence_permit'
);

CREATE TYPE stay_status AS ENUM (
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'wave',
  'orange_money',
  'card',
  'cash'
);

CREATE TYPE alert_severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

CREATE TYPE alert_status AS ENUM (
  'new',
  'acknowledged',
  'investigating',
  'resolved',
  'dismissed'
);

CREATE TYPE user_role AS ENUM (
  'landlord',
  'police',
  'ministry',
  'tax_authority',
  'admin'
);

-- ============================================
-- CORE TABLES
-- ============================================

-- Landlords (extends auth.users)
CREATE TABLE landlords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  cni_number TEXT,
  cni_photo_url TEXT,
  business_name TEXT,
  ninea_number TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  preferred_language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type property_type NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  license_number TEXT UNIQUE,
  status property_status DEFAULT 'pending',
  capacity_rooms INTEGER,
  capacity_beds INTEGER,
  capacity_guests INTEGER,
  amenities JSONB DEFAULT '[]',
  compliance_score INTEGER DEFAULT 0,
  last_inspection_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Photos
CREATE TABLE property_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Documents
CREATE TABLE property_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GUEST MANAGEMENT
-- ============================================

-- Guests
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  document_type document_type,
  document_number TEXT,
  document_photo_url TEXT,
  document_expiry DATE,
  document_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stays (guest visits)
CREATE TABLE stays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id),
  guardian_id UUID REFERENCES guests(id),
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  expected_check_out TIMESTAMPTZ,
  nights INTEGER,
  num_guests INTEGER DEFAULT 1,
  room_number TEXT,
  status stay_status DEFAULT 'active',
  purpose TEXT,
  notes TEXT,
  police_notified BOOLEAN DEFAULT FALSE,
  police_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAX & PAYMENTS
-- ============================================

-- Tax Liabilities
CREATE TABLE tax_liabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  landlord_id UUID NOT NULL REFERENCES landlords(id),
  stay_id UUID REFERENCES stays(id),
  period_start DATE,
  period_end DATE,
  guest_nights INTEGER NOT NULL,
  rate_per_night INTEGER DEFAULT 1000,
  amount INTEGER NOT NULL,
  paid_amount INTEGER DEFAULT 0,
  status payment_status DEFAULT 'pending',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL REFERENCES landlords(id),
  tax_liability_id UUID REFERENCES tax_liabilities(id),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'XOF',
  method payment_method NOT NULL,
  provider_reference TEXT,
  provider_transaction_id TEXT,
  status payment_status DEFAULT 'pending',
  receipt_number TEXT UNIQUE,
  receipt_url TEXT,
  treasury_settled BOOLEAN DEFAULT FALSE,
  treasury_settled_at TIMESTAMPTZ,
  treasury_reference TEXT,
  metadata JSONB,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Webhooks (for debugging/audit)
CREATE TABLE payment_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  payment_id UUID REFERENCES payments(id),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALERTS & SECURITY
-- ============================================

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity alert_severity NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  property_id UUID REFERENCES properties(id),
  landlord_id UUID REFERENCES landlords(id),
  guest_id UUID REFERENCES guests(id),
  stay_id UUID REFERENCES stays(id),
  status alert_status DEFAULT 'new',
  assigned_to UUID,
  jurisdiction TEXT,
  metadata JSONB,
  auto_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- ============================================
-- INTELLIGENCE & SCRAPING
-- ============================================

-- Scraped Listings
CREATE TABLE scraped_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  property_type TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  price_per_night INTEGER,
  currency TEXT DEFAULT 'XOF',
  capacity_guests INTEGER,
  capacity_bedrooms INTEGER,
  capacity_bathrooms INTEGER,
  host_name TEXT,
  host_id TEXT,
  host_url TEXT,
  rating DECIMAL(3, 2),
  review_count INTEGER,
  photos JSONB,
  amenities JSONB,
  calendar_data JSONB,
  estimated_occupancy DECIMAL(5, 2),
  estimated_revenue INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  scrape_count INTEGER DEFAULT 1,
  UNIQUE(platform, external_id)
);

-- Listing Matches
CREATE TABLE listing_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scraped_listing_id UUID NOT NULL REFERENCES scraped_listings(id),
  property_id UUID REFERENCES properties(id),
  confidence DECIMAL(5, 4),
  match_type TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejected BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape Jobs
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  config JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT & ADMIN
-- ============================================

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_role user_role,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- License Sequence (for generating license numbers)
CREATE SEQUENCE license_number_seq START 1;

-- ============================================
-- INDEXES
-- ============================================

-- Landlords
CREATE INDEX idx_landlords_user_id ON landlords(user_id);
CREATE INDEX idx_landlords_phone ON landlords(phone);
CREATE INDEX idx_landlords_verified ON landlords(verified);

-- Properties
CREATE INDEX idx_properties_landlord ON properties(landlord_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_region ON properties(region);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_license ON properties(license_number);
CREATE INDEX idx_properties_location ON properties(gps_lat, gps_lng);

-- Guests
CREATE INDEX idx_guests_document ON guests(document_type, document_number);
CREATE INDEX idx_guests_nationality ON guests(nationality);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);

-- Stays
CREATE INDEX idx_stays_property ON stays(property_id);
CREATE INDEX idx_stays_guest ON stays(guest_id);
CREATE INDEX idx_stays_status ON stays(status);
CREATE INDEX idx_stays_check_in ON stays(check_in);
CREATE INDEX idx_stays_active ON stays(property_id, status) WHERE status = 'active';

-- Tax & Payments
CREATE INDEX idx_tax_liabilities_landlord ON tax_liabilities(landlord_id);
CREATE INDEX idx_tax_liabilities_property ON tax_liabilities(property_id);
CREATE INDEX idx_tax_liabilities_status ON tax_liabilities(status);
CREATE INDEX idx_payments_landlord ON payments(landlord_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Alerts
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_property ON alerts(property_id);
CREATE INDEX idx_alerts_jurisdiction ON alerts(jurisdiction);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- Scraped Listings
CREATE INDEX idx_scraped_listings_platform ON scraped_listings(platform);
CREATE INDEX idx_scraped_listings_city ON scraped_listings(city);
CREATE INDEX idx_scraped_listings_active ON scraped_listings(is_active);
CREATE INDEX idx_scraped_listings_location ON scraped_listings(gps_lat, gps_lng);

-- Audit Logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate license number
CREATE OR REPLACE FUNCTION generate_license_number()
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  SELECT nextval('license_number_seq') INTO seq_num;
  RETURN 'TRG-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Calculate age from date of birth
CREATE OR REPLACE FUNCTION calculate_age(dob DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(NOW(), dob))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if guest is minor
CREATE OR REPLACE FUNCTION is_minor(dob DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN calculate_age(dob) < 18;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate TPT amount
CREATE OR REPLACE FUNCTION calculate_tpt(num_guests INTEGER, num_nights INTEGER, rate INTEGER DEFAULT 1000)
RETURNS INTEGER AS $$
BEGIN
  RETURN num_guests * num_nights * rate;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE TRIGGER landlords_updated_at
  BEFORE UPDATE ON landlords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER stays_updated_at
  BEFORE UPDATE ON stays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tax_liabilities_updated_at
  BEFORE UPDATE ON tax_liabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate license number on property activation
CREATE OR REPLACE FUNCTION auto_generate_license()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.license_number IS NULL AND OLD.status != 'active' THEN
    NEW.license_number = generate_license_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_auto_license
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION auto_generate_license();

-- Create alert for minor without guardian
CREATE OR REPLACE FUNCTION check_minor_alert()
RETURNS TRIGGER AS $$
DECLARE
  guest_dob DATE;
  guardian_age INTEGER;
BEGIN
  SELECT date_of_birth INTO guest_dob FROM guests WHERE id = NEW.guest_id;

  IF guest_dob IS NOT NULL AND is_minor(guest_dob) THEN
    IF NEW.guardian_id IS NULL THEN
      -- CRITICAL: Unaccompanied minor
      INSERT INTO alerts (severity, type, title, description, property_id, guest_id, stay_id, auto_generated)
      VALUES (
        'critical',
        'unaccompanied_minor',
        'ALERTE: Mineur non accompagné',
        'Un mineur a été enregistré sans tuteur. Âge: ' || calculate_age(guest_dob) || ' ans.',
        NEW.property_id,
        NEW.guest_id,
        NEW.id,
        TRUE
      );
    ELSE
      SELECT calculate_age(date_of_birth) INTO guardian_age FROM guests WHERE id = NEW.guardian_id;
      IF guardian_age IS NOT NULL AND guardian_age < 21 THEN
        -- HIGH: Young guardian
        INSERT INTO alerts (severity, type, title, description, property_id, guest_id, stay_id, auto_generated)
        VALUES (
          'high',
          'suspicious_guardian',
          'Tuteur suspect',
          'Le tuteur déclaré a moins de 21 ans. Âge tuteur: ' || guardian_age || ' ans.',
          NEW.property_id,
          NEW.guest_id,
          NEW.id,
          TRUE
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stays_minor_check
  AFTER INSERT ON stays
  FOR EACH ROW EXECUTE FUNCTION check_minor_alert();

-- Calculate stay nights on check-out
CREATE OR REPLACE FUNCTION calculate_stay_nights()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out IS NOT NULL AND NEW.nights IS NULL THEN
    NEW.nights = GREATEST(1, EXTRACT(DAY FROM NEW.check_out - NEW.check_in)::INTEGER);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stays_calculate_nights
  BEFORE UPDATE ON stays
  FOR EACH ROW EXECUTE FUNCTION calculate_stay_nights();
