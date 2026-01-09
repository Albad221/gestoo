-- Teranga Safe Row Level Security Policies
-- Version: 00002
-- Description: RLS policies for all tables

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get current user's landlord ID
CREATE OR REPLACE FUNCTION get_landlord_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM landlords WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (raw_user_meta_data->>'role')::user_role = required_role
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is police
CREATE OR REPLACE FUNCTION is_police()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('police') OR has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is ministry
CREATE OR REPLACE FUNCTION is_ministry()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('ministry') OR has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is tax authority
CREATE OR REPLACE FUNCTION is_tax_authority()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('tax_authority') OR has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is landlord
CREATE OR REPLACE FUNCTION is_landlord()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM landlords WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- LANDLORDS TABLE POLICIES
-- ============================================

-- Landlords can view their own profile
CREATE POLICY "landlords_select_own" ON landlords
  FOR SELECT USING (user_id = auth.uid());

-- Landlords can update their own profile
CREATE POLICY "landlords_update_own" ON landlords
  FOR UPDATE USING (user_id = auth.uid());

-- Landlords can insert their own profile (during registration)
CREATE POLICY "landlords_insert_own" ON landlords
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Police/Ministry/Admin can view all landlords
CREATE POLICY "landlords_select_officials" ON landlords
  FOR SELECT USING (is_police() OR is_ministry() OR is_tax_authority());

-- Admin can update any landlord (for verification)
CREATE POLICY "landlords_update_admin" ON landlords
  FOR UPDATE USING (is_admin());

-- ============================================
-- PROPERTIES TABLE POLICIES
-- ============================================

-- Landlords can view their own properties
CREATE POLICY "properties_select_own" ON properties
  FOR SELECT USING (landlord_id = get_landlord_id());

-- Landlords can insert their own properties
CREATE POLICY "properties_insert_own" ON properties
  FOR INSERT WITH CHECK (landlord_id = get_landlord_id());

-- Landlords can update their own properties
CREATE POLICY "properties_update_own" ON properties
  FOR UPDATE USING (landlord_id = get_landlord_id());

-- Police/Ministry can view all properties
CREATE POLICY "properties_select_officials" ON properties
  FOR SELECT USING (is_police() OR is_ministry() OR is_tax_authority());

-- Ministry/Admin can update properties (status changes, verification)
CREATE POLICY "properties_update_officials" ON properties
  FOR UPDATE USING (is_ministry() OR is_admin());

-- ============================================
-- PROPERTY PHOTOS TABLE POLICIES
-- ============================================

-- Landlords can manage their property photos
CREATE POLICY "property_photos_select_own" ON property_photos
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

CREATE POLICY "property_photos_insert_own" ON property_photos
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

CREATE POLICY "property_photos_delete_own" ON property_photos
  FOR DELETE USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- Officials can view all property photos
CREATE POLICY "property_photos_select_officials" ON property_photos
  FOR SELECT USING (is_police() OR is_ministry());

-- ============================================
-- PROPERTY DOCUMENTS TABLE POLICIES
-- ============================================

-- Landlords can manage their property documents
CREATE POLICY "property_documents_select_own" ON property_documents
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

CREATE POLICY "property_documents_insert_own" ON property_documents
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- Officials can view and update documents
CREATE POLICY "property_documents_select_officials" ON property_documents
  FOR SELECT USING (is_police() OR is_ministry());

CREATE POLICY "property_documents_update_officials" ON property_documents
  FOR UPDATE USING (is_ministry() OR is_admin());

-- ============================================
-- GUESTS TABLE POLICIES
-- ============================================

-- Landlords can view guests who stayed at their properties
CREATE POLICY "guests_select_own" ON guests
  FOR SELECT USING (
    id IN (
      SELECT guest_id FROM stays
      WHERE property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
    )
  );

-- Landlords can insert guests
CREATE POLICY "guests_insert_landlord" ON guests
  FOR INSERT WITH CHECK (is_landlord());

-- Landlords can update guests they registered
CREATE POLICY "guests_update_own" ON guests
  FOR UPDATE USING (
    id IN (
      SELECT guest_id FROM stays
      WHERE property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
    )
  );

-- Police can view all guests
CREATE POLICY "guests_select_police" ON guests
  FOR SELECT USING (is_police());

-- ============================================
-- STAYS TABLE POLICIES
-- ============================================

-- Landlords can view stays at their properties
CREATE POLICY "stays_select_own" ON stays
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- Landlords can insert stays at their properties
CREATE POLICY "stays_insert_own" ON stays
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- Landlords can update stays at their properties
CREATE POLICY "stays_update_own" ON stays
  FOR UPDATE USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- Police can view all stays
CREATE POLICY "stays_select_police" ON stays
  FOR SELECT USING (is_police());

-- ============================================
-- TAX LIABILITIES TABLE POLICIES
-- ============================================

-- Landlords can view their tax liabilities
CREATE POLICY "tax_liabilities_select_own" ON tax_liabilities
  FOR SELECT USING (landlord_id = get_landlord_id());

-- Tax authority and ministry can view all
CREATE POLICY "tax_liabilities_select_officials" ON tax_liabilities
  FOR SELECT USING (is_tax_authority() OR is_ministry());

-- System can insert (via edge functions)
CREATE POLICY "tax_liabilities_insert_system" ON tax_liabilities
  FOR INSERT WITH CHECK (TRUE);

-- Tax authority can update
CREATE POLICY "tax_liabilities_update_officials" ON tax_liabilities
  FOR UPDATE USING (is_tax_authority() OR is_admin());

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================

-- Landlords can view their payments
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (landlord_id = get_landlord_id());

-- Landlords can initiate payments
CREATE POLICY "payments_insert_own" ON payments
  FOR INSERT WITH CHECK (landlord_id = get_landlord_id());

-- Tax authority can view all payments
CREATE POLICY "payments_select_officials" ON payments
  FOR SELECT USING (is_tax_authority() OR is_ministry());

-- System can update payment status (via webhooks)
CREATE POLICY "payments_update_system" ON payments
  FOR UPDATE USING (TRUE);

-- ============================================
-- PAYMENT WEBHOOKS TABLE POLICIES
-- ============================================

-- Only admin can view webhooks
CREATE POLICY "payment_webhooks_select_admin" ON payment_webhooks
  FOR SELECT USING (is_admin());

-- System can insert webhooks
CREATE POLICY "payment_webhooks_insert_system" ON payment_webhooks
  FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- ALERTS TABLE POLICIES
-- ============================================

-- Police can view all alerts
CREATE POLICY "alerts_select_police" ON alerts
  FOR SELECT USING (is_police());

-- Police can update alerts (acknowledge, resolve)
CREATE POLICY "alerts_update_police" ON alerts
  FOR UPDATE USING (is_police());

-- Landlords can view alerts about their properties
CREATE POLICY "alerts_select_own" ON alerts
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = get_landlord_id())
  );

-- System can insert alerts
CREATE POLICY "alerts_insert_system" ON alerts
  FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- SCRAPED LISTINGS TABLE POLICIES
-- ============================================

-- Ministry can view scraped listings
CREATE POLICY "scraped_listings_select_ministry" ON scraped_listings
  FOR SELECT USING (is_ministry() OR is_police());

-- System can manage scraped listings
CREATE POLICY "scraped_listings_insert_system" ON scraped_listings
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "scraped_listings_update_system" ON scraped_listings
  FOR UPDATE USING (TRUE);

-- ============================================
-- LISTING MATCHES TABLE POLICIES
-- ============================================

-- Ministry can view and manage listing matches
CREATE POLICY "listing_matches_select_ministry" ON listing_matches
  FOR SELECT USING (is_ministry());

CREATE POLICY "listing_matches_insert_system" ON listing_matches
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "listing_matches_update_ministry" ON listing_matches
  FOR UPDATE USING (is_ministry());

-- ============================================
-- SCRAPE JOBS TABLE POLICIES
-- ============================================

-- Admin can view scrape jobs
CREATE POLICY "scrape_jobs_select_admin" ON scrape_jobs
  FOR SELECT USING (is_admin() OR is_ministry());

-- System can manage scrape jobs
CREATE POLICY "scrape_jobs_insert_system" ON scrape_jobs
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "scrape_jobs_update_system" ON scrape_jobs
  FOR UPDATE USING (TRUE);

-- ============================================
-- AUDIT LOGS TABLE POLICIES
-- ============================================

-- Only admin can view audit logs
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT USING (is_admin());

-- System can insert audit logs
CREATE POLICY "audit_logs_insert_system" ON audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- SERVICE ROLE BYPASS
-- ============================================
-- Note: Service role (used by edge functions and backend services)
-- automatically bypasses RLS. This is by design in Supabase.
