-- Gestoo Platform Additional Tables Migration
-- Version: 00011
-- Description: New tables for guest verifications, landlord notifications, property compliance, and audit log

-- ============================================
-- GUEST VERIFICATIONS
-- ============================================

-- Store verification results for guests (sanctions, watchlist, enrichment)
CREATE TABLE IF NOT EXISTS guest_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL, -- 'sanctions', 'watchlist', 'enrichment'
  result JSONB,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for guest_verifications
CREATE INDEX IF NOT EXISTS idx_guest_verifications_guest ON guest_verifications(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_verifications_type ON guest_verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_guest_verifications_risk_score ON guest_verifications(risk_score);
CREATE INDEX IF NOT EXISTS idx_guest_verifications_verified_at ON guest_verifications(verified_at DESC);

-- ============================================
-- LANDLORD NOTIFICATIONS
-- ============================================

-- Landlord-specific notifications table (separate from system notifications)
CREATE TABLE IF NOT EXISTS landlord_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'alert', 'payment', 'compliance'
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for landlord_notifications
CREATE INDEX IF NOT EXISTS idx_landlord_notifications_landlord ON landlord_notifications(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_notifications_type ON landlord_notifications(type);
CREATE INDEX IF NOT EXISTS idx_landlord_notifications_read ON landlord_notifications(landlord_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_landlord_notifications_created_at ON landlord_notifications(created_at DESC);

-- ============================================
-- PROPERTY COMPLIANCE
-- ============================================

-- Track compliance status for properties
CREATE TABLE IF NOT EXISTS property_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'compliant', -- 'compliant', 'warning', 'non_compliant'
  issues JSONB DEFAULT '[]',
  last_checked TIMESTAMPTZ,
  next_check TIMESTAMPTZ,
  CONSTRAINT valid_compliance_status CHECK (status IN ('compliant', 'warning', 'non_compliant'))
);

-- Indexes for property_compliance
CREATE INDEX IF NOT EXISTS idx_property_compliance_property ON property_compliance(property_id);
CREATE INDEX IF NOT EXISTS idx_property_compliance_status ON property_compliance(status);
CREATE INDEX IF NOT EXISTS idx_property_compliance_next_check ON property_compliance(next_check) WHERE next_check IS NOT NULL;

-- ============================================
-- AUDIT LOG (Extended)
-- ============================================

-- Extended audit log table for tracking sensitive operations
-- Note: audit_logs already exists, this creates a more generic audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================
-- ADDITIONAL INDEXES ON EXISTING TABLES
-- ============================================

-- Note: Some of these indexes may already exist from 00001_initial_schema.sql
-- Using IF NOT EXISTS to avoid errors on duplicate creation

-- Guests indexes (document and name search optimization)
CREATE INDEX IF NOT EXISTS idx_guests_document_number ON guests(document_number);

-- Alerts indexes (status and property lookup optimization)
-- idx_alerts_status and idx_alerts_property already exist in 00001

-- Stays index for active stays lookup
-- Note: idx_stays_active exists but with different definition, creating alternative
CREATE INDEX IF NOT EXISTS idx_stays_status_active ON stays(status) WHERE status = 'active';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE guest_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Guest verifications policies
CREATE POLICY "Landlords can view verifications for their guests"
  ON guest_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stays s
      JOIN properties p ON s.property_id = p.id
      JOIN landlords l ON p.landlord_id = l.id
      WHERE s.guest_id = guest_verifications.guest_id
      AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all guest verifications"
  ON guest_verifications FOR ALL
  USING (is_admin());

CREATE POLICY "Police can view guest verifications"
  ON guest_verifications FOR SELECT
  USING (is_police());

-- Landlord notifications policies
CREATE POLICY "Landlords can view their own notifications"
  ON landlord_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM landlords l
      WHERE l.id = landlord_notifications.landlord_id
      AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can update their own notifications"
  ON landlord_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM landlords l
      WHERE l.id = landlord_notifications.landlord_id
      AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all landlord notifications"
  ON landlord_notifications FOR ALL
  USING (is_admin());

-- Property compliance policies
CREATE POLICY "Landlords can view compliance for their properties"
  ON property_compliance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN landlords l ON p.landlord_id = l.id
      WHERE p.id = property_compliance.property_id
      AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all property compliance"
  ON property_compliance FOR ALL
  USING (is_admin());

CREATE POLICY "Ministry can view property compliance"
  ON property_compliance FOR SELECT
  USING (is_ministry());

-- Audit log policies (read-only for authorized users)
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Ministry can view audit logs"
  ON audit_log FOR SELECT
  USING (is_ministry());

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE guest_verifications IS 'Stores verification results for guests including sanctions checks, watchlist matches, and data enrichment';
COMMENT ON TABLE landlord_notifications IS 'Notifications specific to landlords for alerts, payments, and compliance updates';
COMMENT ON TABLE property_compliance IS 'Tracks compliance status and issues for properties';
COMMENT ON TABLE audit_log IS 'Generic audit log for tracking sensitive operations across the platform';

COMMENT ON COLUMN guest_verifications.verification_type IS 'Type of verification: sanctions, watchlist, or enrichment';
COMMENT ON COLUMN guest_verifications.risk_score IS 'Risk score from 0 to 100, where higher means more risk';
COMMENT ON COLUMN landlord_notifications.type IS 'Notification type: alert, payment, or compliance';
COMMENT ON COLUMN property_compliance.status IS 'Compliance status: compliant, warning, or non_compliant';
COMMENT ON COLUMN property_compliance.issues IS 'JSON array of compliance issues found';
