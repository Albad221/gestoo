-- =============================================
-- GESTOO - Complete Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE user_role AS ENUM ('admin', 'police', 'ministry', 'tax_authority');
CREATE TYPE property_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE property_type AS ENUM ('hotel', 'guesthouse', 'apartment', 'villa', 'hostel', 'other');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE alert_type AS ENUM ('minor_guest', 'watchlist_match', 'unregistered_property', 'suspicious_activity', 'tax_evasion', 'document_fraud', 'other');
CREATE TYPE stay_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('wave', 'orange_money', 'card', 'cash', 'bank_transfer');
CREATE TYPE listing_platform AS ENUM ('airbnb', 'booking', 'expat_dakar', 'mamaison', 'keur_immo', 'coinafrique', 'jumia_house', 'other');
CREATE TYPE listing_status AS ENUM ('active', 'inactive', 'matched', 'flagged');
CREATE TYPE id_document_type AS ENUM ('passport', 'national_id', 'driver_license', 'residence_permit', 'other');

-- =============================================
-- TABLES
-- =============================================

-- Admin Users (Police, Ministry, Tax Authority)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'admin',
    organization TEXT,
    badge_number TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landlords (Property Owners)
CREATE TABLE landlords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT NOT NULL,
    whatsapp_phone TEXT,
    national_id TEXT,
    tax_id TEXT,
    address TEXT,
    city TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties (Registered Accommodations)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
    registration_number TEXT UNIQUE,
    name TEXT NOT NULL,
    type property_type NOT NULL DEFAULT 'apartment',
    status property_status NOT NULL DEFAULT 'pending',
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    num_rooms INTEGER DEFAULT 1,
    max_guests INTEGER DEFAULT 2,
    nightly_rate DECIMAL(10, 2),
    description TEXT,
    amenities JSONB DEFAULT '[]',
    photos JSONB DEFAULT '[]',
    platform_listings JSONB DEFAULT '[]',
    tax_rate DECIMAL(10, 2) DEFAULT 1000.00,
    is_active BOOLEAN DEFAULT true,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests (Travelers)
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    nationality TEXT,
    id_document_type id_document_type,
    passport_number TEXT,
    national_id_number TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    photo_url TEXT,
    id_document_url TEXT,
    is_minor BOOLEAN DEFAULT false,
    is_on_watchlist BOOLEAN DEFAULT false,
    watchlist_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stays (Check-ins/Check-outs)
CREATE TABLE stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    room_number TEXT,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    expected_check_out TIMESTAMPTZ,
    num_guests INTEGER DEFAULT 1,
    num_nights INTEGER,
    total_amount DECIMAL(10, 2),
    tax_amount DECIMAL(10, 2),
    status stay_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    registered_via TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (TPT Tax Collection)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    payment_method payment_method,
    status payment_status NOT NULL DEFAULT 'pending',
    transaction_id TEXT,
    wave_checkout_id TEXT,
    paid_at TIMESTAMPTZ,
    receipt_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts (Security Alerts)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'medium',
    status alert_status NOT NULL DEFAULT 'open',
    title TEXT NOT NULL,
    description TEXT,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
    scraped_listing_id UUID,
    location_city TEXT,
    location_region TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    metadata JSONB DEFAULT '{}',
    assigned_to UUID REFERENCES admin_users(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admin_users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraped Listings (Market Intelligence)
CREATE TABLE scraped_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform listing_platform NOT NULL,
    platform_id TEXT,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    price DECIMAL(10, 2),
    currency TEXT DEFAULT 'XOF',
    location_text TEXT,
    city TEXT,
    region TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    host_name TEXT,
    host_id TEXT,
    num_rooms INTEGER,
    num_guests INTEGER,
    photos JSONB DEFAULT '[]',
    amenities JSONB DEFAULT '[]',
    rating DECIMAL(3, 2),
    num_reviews INTEGER,
    status listing_status NOT NULL DEFAULT 'active',
    matched_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    is_compliant BOOLEAN,
    compliance_checked_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, platform_id)
);

-- WhatsApp Conversations
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL,
    landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    current_flow TEXT,
    flow_state JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Messages
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    wati_message_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    template_name TEXT,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Admin Users
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Properties
CREATE INDEX idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_registration_number ON properties(registration_number);
CREATE INDEX idx_properties_location ON properties(latitude, longitude);

-- Guests
CREATE INDEX idx_guests_passport ON guests(passport_number);
CREATE INDEX idx_guests_national_id ON guests(national_id_number);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);
CREATE INDEX idx_guests_watchlist ON guests(is_on_watchlist) WHERE is_on_watchlist = true;

-- Stays
CREATE INDEX idx_stays_property_id ON stays(property_id);
CREATE INDEX idx_stays_guest_id ON stays(guest_id);
CREATE INDEX idx_stays_check_in ON stays(check_in);
CREATE INDEX idx_stays_status ON stays(status);

-- Payments
CREATE INDEX idx_payments_stay_id ON payments(stay_id);
CREATE INDEX idx_payments_property_id ON payments(property_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);

-- Alerts
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_property_id ON alerts(property_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Scraped Listings
CREATE INDEX idx_scraped_listings_platform ON scraped_listings(platform);
CREATE INDEX idx_scraped_listings_city ON scraped_listings(city);
CREATE INDEX idx_scraped_listings_status ON scraped_listings(status);
CREATE INDEX idx_scraped_listings_matched ON scraped_listings(matched_property_id);
CREATE INDEX idx_scraped_listings_compliant ON scraped_listings(is_compliant);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can see their own profile
CREATE POLICY "Admin users can view own profile" ON admin_users
    FOR SELECT USING (auth.uid() = user_id);

-- Admin users can view all data based on role
CREATE POLICY "Admin users full access" ON admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- Properties policies
CREATE POLICY "Admins can view all properties" ON properties
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

CREATE POLICY "Admins can manage properties" ON properties
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND au.role IN ('admin', 'ministry')
        )
    );

-- Guests policies (Police and Admin only for sensitive data)
CREATE POLICY "Police and Admin can view guests" ON guests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND au.role IN ('admin', 'police')
        )
    );

-- Stays policies
CREATE POLICY "Admins can view all stays" ON stays
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- Alerts policies
CREATE POLICY "Admins can view all alerts" ON alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

CREATE POLICY "Police and Admin can manage alerts" ON alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND au.role IN ('admin', 'police')
        )
    );

-- Payments policies (Tax Authority and Admin)
CREATE POLICY "Tax and Admin can view payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND au.role IN ('admin', 'tax_authority', 'ministry')
        )
    );

-- Scraped listings policies (Ministry and Admin)
CREATE POLICY "Ministry and Admin can view scraped listings" ON scraped_listings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND au.role IN ('admin', 'ministry', 'tax_authority')
        )
    );

-- Service role bypass for backend services
CREATE POLICY "Service role full access admin_users" ON admin_users FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access landlords" ON landlords FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access properties" ON properties FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access guests" ON guests FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access stays" ON stays FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access alerts" ON alerts FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access scraped_listings" ON scraped_listings FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access whatsapp_conversations" ON whatsapp_conversations FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access whatsapp_messages" ON whatsapp_messages FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access audit_log" ON audit_log FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_landlords_updated_at BEFORE UPDATE ON landlords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stays_updated_at BEFORE UPDATE ON stays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraped_listings_updated_at BEFORE UPDATE ON scraped_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate registration number for properties
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
DECLARE
    city_code TEXT;
    seq_num INTEGER;
BEGIN
    -- Get city code (first 3 letters uppercase)
    city_code := UPPER(LEFT(COALESCE(NEW.city, 'UNK'), 3));

    -- Get sequence number for this city
    SELECT COUNT(*) + 1 INTO seq_num
    FROM properties
    WHERE city = NEW.city;

    -- Generate registration number: SN-DKR-00001
    NEW.registration_number := 'SN-' || city_code || '-' || LPAD(seq_num::TEXT, 5, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_property_registration_number
    BEFORE INSERT ON properties
    FOR EACH ROW
    WHEN (NEW.registration_number IS NULL)
    EXECUTE FUNCTION generate_registration_number();

-- Calculate stay tax amount
CREATE OR REPLACE FUNCTION calculate_stay_tax()
RETURNS TRIGGER AS $$
DECLARE
    property_tax_rate DECIMAL(10, 2);
    nights INTEGER;
BEGIN
    -- Get property tax rate
    SELECT tax_rate INTO property_tax_rate
    FROM properties
    WHERE id = NEW.property_id;

    -- Calculate nights
    IF NEW.expected_check_out IS NOT NULL THEN
        nights := GREATEST(1, EXTRACT(DAY FROM (NEW.expected_check_out - NEW.check_in))::INTEGER);
    ELSE
        nights := 1;
    END IF;

    NEW.num_nights := nights;
    NEW.tax_amount := COALESCE(property_tax_rate, 1000) * NEW.num_guests * nights;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_stay_tax_trigger
    BEFORE INSERT OR UPDATE ON stays
    FOR EACH ROW
    EXECUTE FUNCTION calculate_stay_tax();

-- Auto-create alert for minor guests
CREATE OR REPLACE FUNCTION check_minor_guest_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_minor = true THEN
        INSERT INTO alerts (type, severity, status, title, description, guest_id)
        VALUES (
            'minor_guest',
            'high',
            'open',
            'Mineur détecté: ' || NEW.first_name || ' ' || NEW.last_name,
            'Un voyageur mineur a été enregistré. Vérification requise.',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_minor_guest_trigger
    AFTER INSERT ON guests
    FOR EACH ROW
    EXECUTE FUNCTION check_minor_guest_alert();

-- Auto-create alert for watchlist matches
CREATE OR REPLACE FUNCTION check_watchlist_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_on_watchlist = true AND (OLD IS NULL OR OLD.is_on_watchlist = false) THEN
        INSERT INTO alerts (type, severity, status, title, description, guest_id)
        VALUES (
            'watchlist_match',
            'critical',
            'open',
            'Correspondance liste de surveillance: ' || NEW.first_name || ' ' || NEW.last_name,
            COALESCE(NEW.watchlist_reason, 'Personne sur liste de surveillance détectée.'),
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_watchlist_trigger
    AFTER INSERT OR UPDATE ON guests
    FOR EACH ROW
    EXECUTE FUNCTION check_watchlist_alert();

-- =============================================
-- SEED DATA
-- =============================================

-- Insert demo admin user (password will be set via Supabase Auth)
-- You need to create the auth user first in Supabase Dashboard, then run this:

-- Demo data for testing
INSERT INTO landlords (id, first_name, last_name, email, phone, whatsapp_phone, city, is_verified)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Moussa', 'Diop', 'moussa.diop@email.sn', '+221771234567', '+221771234567', 'Dakar', true),
    ('22222222-2222-2222-2222-222222222222', 'Fatou', 'Sall', 'fatou.sall@email.sn', '+221772345678', '+221772345678', 'Saint-Louis', true),
    ('33333333-3333-3333-3333-333333333333', 'Amadou', 'Ba', 'amadou.ba@email.sn', '+221773456789', '+221773456789', 'Saly', false);

INSERT INTO properties (id, landlord_id, name, type, status, address, city, region, latitude, longitude, num_rooms, max_guests, nightly_rate)
VALUES
    ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Hôtel Terrou-Bi', 'hotel', 'active', 'Blvd Martin Luther King', 'Dakar', 'Dakar', 14.6937, -17.4441, 50, 100, 75000),
    ('aaaa2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Villa Les Almadies', 'villa', 'active', 'Route des Almadies', 'Dakar', 'Dakar', 14.7456, -17.5089, 4, 8, 150000),
    ('aaaa3333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Résidence du Port', 'apartment', 'active', 'Quai Henry Jay', 'Saint-Louis', 'Saint-Louis', 16.0326, -16.4818, 10, 20, 45000),
    ('aaaa4444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Lodge de la Petite Côte', 'guesthouse', 'pending', 'Route de Saly', 'Saly', 'Thiès', 14.4461, -17.0167, 8, 16, 35000);

INSERT INTO guests (id, first_name, last_name, date_of_birth, nationality, passport_number, email, is_minor, is_on_watchlist)
VALUES
    ('bbbb1111-1111-1111-1111-111111111111', 'Jean', 'Dupont', '1985-03-15', 'France', 'FR-892019', 'jean.dupont@email.fr', false, false),
    ('bbbb2222-2222-2222-2222-222222222222', 'Aïssatou', 'Mbaye', '1990-07-22', 'Sénégal', 'SN-221098', 'aissatou.mbaye@email.sn', false, false),
    ('bbbb3333-3333-3333-3333-333333333333', 'Moussa', 'Konaté', '1978-11-30', 'Mali', 'ML-332145', 'moussa.konate@email.ml', false, false),
    ('bbbb4444-4444-4444-4444-444444444444', 'Sarah', 'Connor', '1992-05-08', 'USA', 'US-987654', 'sarah.connor@email.com', false, false),
    ('bbbb5555-5555-5555-5555-555555555555', 'Pierre', 'Martin', '2010-09-12', 'France', 'FR-MINOR01', 'parent@email.fr', true, false);

INSERT INTO stays (property_id, guest_id, room_number, check_in, expected_check_out, num_guests, status)
VALUES
    ('aaaa1111-1111-1111-1111-111111111111', 'bbbb1111-1111-1111-1111-111111111111', '204', NOW(), NOW() + INTERVAL '3 days', 2, 'active'),
    ('aaaa1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222', '112', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '5 days', 1, 'active'),
    ('aaaa3333-3333-3333-3333-333333333333', 'bbbb3333-3333-3333-3333-333333333333', '301', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '2 days', 2, 'active'),
    ('aaaa4444-4444-4444-4444-444444444444', 'bbbb4444-4444-4444-4444-444444444444', 'Suite A', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '7 days', 1, 'active');

INSERT INTO alerts (type, severity, status, title, description, property_id, location_city)
VALUES
    ('unregistered_property', 'high', 'open', 'Propriété non enregistrée détectée', 'Une annonce Airbnb à Plateau ne correspond à aucune propriété enregistrée.', NULL, 'Dakar'),
    ('suspicious_activity', 'medium', 'open', 'Activité suspecte - Check-ins multiples', 'Plusieurs check-ins suspects détectés à la même adresse.', 'aaaa1111-1111-1111-1111-111111111111', 'Dakar'),
    ('tax_evasion', 'critical', 'investigating', 'Suspicion de fraude fiscale TPT', 'Revenus déclarés incohérents avec le taux d''occupation.', 'aaaa2222-2222-2222-2222-222222222222', 'Dakar');

INSERT INTO scraped_listings (platform, platform_id, url, title, price, city, host_name, status, is_compliant)
VALUES
    ('airbnb', 'airbnb-123456', 'https://airbnb.com/rooms/123456', 'Appartement Vue Mer - Plateau', 45000, 'Dakar', 'M. Ndiaye', 'flagged', false),
    ('booking', 'booking-789012', 'https://booking.com/hotel/789012', 'Hotel Savana', 65000, 'Dakar', 'Hotel Savana SARL', 'matched', true),
    ('expat_dakar', 'expat-345678', 'https://expat-dakar.com/345678', 'Villa 4 chambres Almadies', 200000, 'Dakar', 'Agence Immo Plus', 'active', NULL);

INSERT INTO payments (stay_id, property_id, landlord_id, amount, tax_amount, payment_method, status, paid_at)
SELECT
    s.id,
    s.property_id,
    p.landlord_id,
    s.tax_amount,
    s.tax_amount,
    'wave',
    'completed',
    NOW() - INTERVAL '1 day'
FROM stays s
JOIN properties p ON p.id = s.property_id
LIMIT 2;

-- =============================================
-- VIEWS FOR DASHBOARD
-- =============================================

CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM properties WHERE status = 'active') as active_properties,
    (SELECT COUNT(*) FROM properties) as total_properties,
    (SELECT COUNT(*) FROM stays WHERE status = 'active') as active_stays,
    (SELECT COUNT(*) FROM guests) as total_guests,
    (SELECT COUNT(*) FROM alerts WHERE status = 'open') as open_alerts,
    (SELECT COUNT(*) FROM alerts WHERE status = 'open' AND severity = 'critical') as critical_alerts,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select on all tables to authenticated users (RLS will filter)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant all on specific tables for service role operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =============================================
-- DONE!
-- =============================================
-- After running this script:
-- 1. Go to Supabase Auth > Users
-- 2. Create a new user with email: admin@gouv.sn
-- 3. Then run this SQL to link them:
--
-- INSERT INTO admin_users (user_id, email, full_name, role, organization)
-- SELECT id, email, 'Administrateur Principal', 'admin', 'Ministère du Tourisme'
-- FROM auth.users WHERE email = 'admin@gouv.sn';
-- =============================================
