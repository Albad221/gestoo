-- =============================================
-- GESTOO Check-in - Police Forms Schema
-- Migration: 00013_gestoo_checkin_police_forms.sql
--
-- This migration adds tables for the hotel check-in app:
-- - property_staff: Staff accounts for properties (receptionists, managers)
-- - police_forms: Full fiche de police data
-- - sync_queue: Offline sync tracking
-- =============================================

-- =============================================
-- ENUM TYPES
-- =============================================

-- Property staff roles
CREATE TYPE property_staff_role AS ENUM ('manager', 'receptionist', 'viewer');

-- Police form status
CREATE TYPE police_form_status AS ENUM ('draft', 'completed', 'submitted', 'cancelled');

-- Police document types (for fiche de police)
CREATE TYPE police_document_type AS ENUM (
  'passport',
  'cni',              -- Carte Nationale d'Identite
  'titre_sejour',     -- Titre de sejour
  'cedeao_id',        -- CEDEAO biometric ID
  'permis_conduire',  -- Driver's license
  'other'
);

-- Travel motive (motif du voyage)
CREATE TYPE travel_motive AS ENUM (
  'tourisme',
  'affaires',
  'famille',
  'etudes',
  'travail',
  'sante',
  'conference',
  'transit',
  'autre'
);

-- Sync operation types
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete');

-- Sync status
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'completed', 'failed', 'conflict');

-- =============================================
-- PROPERTY_STAFF TABLE
-- =============================================

CREATE TABLE property_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Links
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,

  -- Staff info
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- Role and permissions
  role property_staff_role NOT NULL DEFAULT 'receptionist',
  permissions JSONB DEFAULT '[]',

  -- Employment info
  badge_number TEXT,
  shift TEXT CHECK (shift IN ('day', 'night', 'all')),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(phone, property_id),
  UNIQUE(user_id, property_id)
);

-- Indexes
CREATE INDEX idx_property_staff_property_id ON property_staff(property_id);
CREATE INDEX idx_property_staff_user_id ON property_staff(user_id);
CREATE INDEX idx_property_staff_phone ON property_staff(phone);
CREATE INDEX idx_property_staff_active ON property_staff(property_id, is_active) WHERE is_active = TRUE;

-- =============================================
-- POLICE_FORMS TABLE (Fiche de Police)
-- =============================================

CREATE TABLE police_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Links
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
  created_by UUID REFERENCES property_staff(id) ON DELETE SET NULL,

  -- Form number (auto-generated)
  form_number TEXT,

  -- === SECTION 1: IDENTITY ===
  nom TEXT NOT NULL,                       -- Surname
  nom_jeune_fille TEXT,                    -- Maiden name
  prenoms TEXT NOT NULL,                   -- First names
  date_naissance DATE NOT NULL,            -- Date of birth
  lieu_naissance TEXT NOT NULL,            -- Place of birth
  pays_departement TEXT NOT NULL,          -- Country/Department
  nationalite TEXT NOT NULL,               -- Nationality
  sexe TEXT CHECK (sexe IN ('M', 'F')),    -- Gender

  -- === SECTION 2: DOCUMENT ===
  type_piece police_document_type NOT NULL,
  numero_piece TEXT NOT NULL,              -- Document number
  date_delivrance DATE,                    -- Issue date
  lieu_delivrance TEXT,                    -- Place of issue
  autorite_delivrance TEXT,                -- Issuing authority
  date_expiration DATE,                    -- Expiry date
  document_photo_url TEXT,                 -- Photo of document
  document_verified BOOLEAN DEFAULT FALSE,

  -- === SECTION 3: STAY INFORMATION ===
  date_entree_senegal DATE,                -- Entry date to Senegal
  profession TEXT,                         -- Occupation
  domicile_habituel TEXT,                  -- Usual residence address
  email TEXT,
  telephone TEXT,
  provenance TEXT,                         -- Coming from (city/country)
  destination TEXT,                        -- Going to (city/country)
  motif_voyage travel_motive,              -- Purpose of trip
  motif_voyage_autre TEXT,                 -- If 'autre', specify
  nb_enfants_moins_15 INTEGER DEFAULT 0,   -- Children under 15
  immatriculation_vehicule TEXT,           -- Vehicle registration

  -- === SECTION 4: ESTABLISHMENT ===
  date_entree DATE NOT NULL DEFAULT CURRENT_DATE,   -- Check-in date
  heure_entree TIME DEFAULT CURRENT_TIME,           -- Check-in time
  date_sortie_prevue DATE,                          -- Expected checkout
  date_sortie_effective DATE,                       -- Actual checkout
  heure_sortie TIME,                                -- Checkout time
  numero_chambre TEXT,                              -- Room number
  nombre_personnes INTEGER NOT NULL DEFAULT 1,      -- Number of persons
  numero_registre TEXT,                             -- Register number (livre de police)

  -- === SECTION 5: SIGNATURE ===
  date_signature DATE DEFAULT CURRENT_DATE,
  signature_url TEXT,                      -- Digital signature image URL
  signature_ip TEXT,                       -- IP address when signed

  -- === MINOR PROTECTION ===
  is_minor BOOLEAN DEFAULT FALSE,
  age_calculated INTEGER,
  guardian_id UUID REFERENCES police_forms(id),     -- Link to guardian's form
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_document_number TEXT,

  -- === VERIFICATION & RISK ===
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  verification_notes TEXT,

  -- === STATUS ===
  status police_form_status DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  police_notified BOOLEAN DEFAULT FALSE,
  police_notified_at TIMESTAMPTZ,

  -- === OFFLINE SYNC ===
  local_id TEXT,                           -- Client-generated ID for offline sync
  device_id TEXT,                          -- Device that created the record
  synced_at TIMESTAMPTZ,

  -- === METADATA ===
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comprehensive indexes
CREATE INDEX idx_police_forms_property ON police_forms(property_id);
CREATE INDEX idx_police_forms_status ON police_forms(status);
CREATE INDEX idx_police_forms_nom ON police_forms(nom);
CREATE INDEX idx_police_forms_nom_prenoms ON police_forms(nom, prenoms);
CREATE INDEX idx_police_forms_nationalite ON police_forms(nationalite);
CREATE INDEX idx_police_forms_date_naissance ON police_forms(date_naissance);
CREATE INDEX idx_police_forms_numero_piece ON police_forms(numero_piece);
CREATE INDEX idx_police_forms_date_entree ON police_forms(date_entree);
CREATE INDEX idx_police_forms_date_sortie ON police_forms(date_sortie_prevue);
CREATE INDEX idx_police_forms_guest ON police_forms(guest_id);
CREATE INDEX idx_police_forms_stay ON police_forms(stay_id);
CREATE INDEX idx_police_forms_minor ON police_forms(property_id) WHERE is_minor = TRUE;
CREATE INDEX idx_police_forms_local_id ON police_forms(local_id) WHERE local_id IS NOT NULL;
CREATE INDEX idx_police_forms_unsynced ON police_forms(property_id, synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_police_forms_created_by ON police_forms(created_by);

-- Full-text search index for name and document number
CREATE INDEX idx_police_forms_fts ON police_forms USING gin(
  to_tsvector('french', coalesce(nom, '') || ' ' || coalesce(prenoms, '') || ' ' || coalesce(numero_piece, ''))
);

-- =============================================
-- SYNC_QUEUE TABLE
-- =============================================

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Context
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Operation details
  operation sync_operation NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  local_id TEXT,

  -- Data
  payload JSONB NOT NULL,

  -- Status tracking
  status sync_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Conflict resolution
  conflict_data JSONB,
  resolution TEXT CHECK (resolution IN ('client_wins', 'server_wins', 'merge', 'manual')),

  -- Error handling
  error_message TEXT,
  error_code TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_property ON sync_queue(property_id);
CREATE INDEX idx_sync_queue_pending ON sync_queue(status, priority DESC, created_at)
  WHERE status = 'pending';
CREATE INDEX idx_sync_queue_local_id ON sync_queue(local_id);
CREATE INDEX idx_sync_queue_record ON sync_queue(table_name, record_id);

-- =============================================
-- SYNC_METADATA TABLE (tracks device sync state)
-- =============================================

CREATE TABLE sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Sync state
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  sync_token TEXT,

  -- Device info
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  app_version TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(device_id, property_id)
);

-- Indexes
CREATE INDEX idx_sync_metadata_device ON sync_metadata(device_id);
CREATE INDEX idx_sync_metadata_property ON sync_metadata(property_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Calculate age from date of birth
CREATE OR REPLACE FUNCTION calculate_age_at_date(dob DATE, reference_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(reference_date, dob))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate police form number
CREATE OR REPLACE FUNCTION generate_police_form_number()
RETURNS TRIGGER AS $$
DECLARE
  prop_reg TEXT;
  seq_num INTEGER;
BEGIN
  -- Get property registration number
  SELECT COALESCE(registration_number, 'UNK') INTO prop_reg
  FROM properties WHERE id = NEW.property_id;

  -- Get sequence number for this property this year
  SELECT COUNT(*) + 1 INTO seq_num
  FROM police_forms
  WHERE property_id = NEW.property_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  -- Format: REG-2026-000001
  NEW.form_number := prop_reg || '-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq_num::TEXT, 6, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-calculate minor status and age
CREATE OR REPLACE FUNCTION auto_calculate_minor_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate age at check-in date
  NEW.age_calculated := calculate_age_at_date(NEW.date_naissance, NEW.date_entree);
  NEW.is_minor := NEW.age_calculated < 18;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create guest and stay records when police form is completed
CREATE OR REPLACE FUNCTION link_police_form_to_guest_stay()
RETURNS TRIGGER AS $$
DECLARE
  v_guest_id UUID;
  v_stay_id UUID;
  v_landlord_id UUID;
BEGIN
  -- Only process when status changes to completed
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN

    -- Get landlord_id from property
    SELECT landlord_id INTO v_landlord_id
    FROM properties
    WHERE id = NEW.property_id;

    -- Create or find guest record if not already linked
    IF NEW.guest_id IS NULL THEN
      -- Check if guest with same document exists
      SELECT id INTO v_guest_id
      FROM guests
      WHERE (passport_number = NEW.numero_piece OR national_id_number = NEW.numero_piece)
      LIMIT 1;

      IF v_guest_id IS NULL THEN
        -- Create new guest
        INSERT INTO guests (
          first_name, last_name, date_of_birth, nationality,
          id_document_type, passport_number, national_id_number,
          phone, email, photo_url, id_document_url, is_minor
        ) VALUES (
          NEW.prenoms, NEW.nom, NEW.date_naissance, NEW.nationalite,
          CASE
            WHEN NEW.type_piece = 'passport' THEN 'passport'::id_document_type
            WHEN NEW.type_piece IN ('cni', 'cedeao_id') THEN 'national_id'::id_document_type
            WHEN NEW.type_piece = 'titre_sejour' THEN 'residence_permit'::id_document_type
            ELSE 'other'::id_document_type
          END,
          CASE WHEN NEW.type_piece = 'passport' THEN NEW.numero_piece ELSE NULL END,
          CASE WHEN NEW.type_piece != 'passport' THEN NEW.numero_piece ELSE NULL END,
          NEW.telephone, NEW.email, NULL, NEW.document_photo_url, NEW.is_minor
        )
        RETURNING id INTO v_guest_id;
      END IF;

      NEW.guest_id := v_guest_id;
    ELSE
      v_guest_id := NEW.guest_id;
    END IF;

    -- Create stay record if not already linked
    IF NEW.stay_id IS NULL THEN
      INSERT INTO stays (
        property_id, guest_id, room_number,
        check_in, expected_check_out, num_guests,
        status, registered_via
      ) VALUES (
        NEW.property_id, v_guest_id, NEW.numero_chambre,
        (NEW.date_entree + COALESCE(NEW.heure_entree, '14:00'::TIME))::TIMESTAMPTZ,
        (NEW.date_sortie_prevue + '11:00'::TIME)::TIMESTAMPTZ,
        NEW.nombre_personnes,
        'active',
        'mobile_app'
      )
      RETURNING id INTO v_stay_id;

      NEW.stay_id := v_stay_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check for minor without guardian alert
CREATE OR REPLACE FUNCTION check_minor_guardian_alert_police()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_minor = TRUE AND NEW.guardian_id IS NULL AND NEW.guardian_name IS NULL
     AND NEW.status = 'completed' THEN
    INSERT INTO alerts (type, severity, status, title, description, property_id, guest_id, metadata)
    SELECT
      'minor_guest',
      'critical',
      'open',
      'ALERTE: Mineur non accompagne - ' || NEW.prenoms || ' ' || NEW.nom,
      format('Mineur de %s ans enregistre sans tuteur declare. Chambre: %s, Hotel: %s',
        NEW.age_calculated, NEW.numero_chambre, p.name),
      NEW.property_id,
      NEW.guest_id,
      jsonb_build_object(
        'police_form_id', NEW.id,
        'room_number', NEW.numero_chambre,
        'age', NEW.age_calculated,
        'nationality', NEW.nationalite
      )
    FROM properties p WHERE p.id = NEW.property_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamps
CREATE TRIGGER update_property_staff_updated_at
  BEFORE UPDATE ON property_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_police_forms_updated_at
  BEFORE UPDATE ON police_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate form number on insert
CREATE TRIGGER generate_police_form_number_trigger
  BEFORE INSERT ON police_forms
  FOR EACH ROW
  WHEN (NEW.form_number IS NULL)
  EXECUTE FUNCTION generate_police_form_number();

-- Auto-calculate minor status
CREATE TRIGGER police_forms_auto_minor_trigger
  BEFORE INSERT OR UPDATE ON police_forms
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_minor_status();

-- Link to guest and stay on completion
CREATE TRIGGER police_forms_link_guest_stay_trigger
  BEFORE UPDATE ON police_forms
  FOR EACH ROW
  EXECUTE FUNCTION link_police_form_to_guest_stay();

-- Also on insert if status is already 'completed'
CREATE TRIGGER police_forms_link_guest_stay_insert_trigger
  BEFORE INSERT ON police_forms
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION link_police_form_to_guest_stay();

-- Minor alert
CREATE TRIGGER police_forms_minor_alert_trigger
  AFTER INSERT OR UPDATE ON police_forms
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION check_minor_guardian_alert_police();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE property_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Property staff policies
CREATE POLICY "Staff can view own record" ON property_staff
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Staff can view colleagues" ON property_staff
  FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Landlord can manage property staff" ON property_staff
  FOR ALL USING (
    landlord_id IN (
      SELECT id FROM landlords WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all property staff" ON property_staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = TRUE
    )
  );

-- Police forms policies
CREATE POLICY "Staff can view property forms" ON police_forms
  FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Staff can create forms" ON police_forms
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
        AND role IN ('manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can update own forms" ON police_forms
  FOR UPDATE USING (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
    AND status NOT IN ('submitted')
  );

CREATE POLICY "Police can view all forms" ON police_forms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role = 'police'
    )
  );

CREATE POLICY "Admin can view all forms" ON police_forms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role IN ('admin', 'ministry')
    )
  );

-- Sync queue policies
CREATE POLICY "User can manage own sync queue" ON sync_queue
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Staff can manage property sync" ON sync_queue
  FOR ALL USING (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Sync metadata policies
CREATE POLICY "User can manage own sync metadata" ON sync_metadata
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Staff can manage property sync metadata" ON sync_metadata
  FOR ALL USING (
    property_id IN (
      SELECT property_id FROM property_staff
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Service role bypass
CREATE POLICY "Service role full access property_staff" ON property_staff
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access police_forms" ON police_forms
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access sync_queue" ON sync_queue
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access sync_metadata" ON sync_metadata
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON property_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON police_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_metadata TO authenticated;

GRANT ALL ON property_staff TO service_role;
GRANT ALL ON police_forms TO service_role;
GRANT ALL ON sync_queue TO service_role;
GRANT ALL ON sync_metadata TO service_role;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE property_staff IS 'Staff accounts for properties (hotels) - receptionists, managers who can use the check-in app';
COMMENT ON TABLE police_forms IS 'Digital fiche de police - complete guest registration form for police compliance';
COMMENT ON TABLE sync_queue IS 'Queue for offline operations waiting to be synced';
COMMENT ON TABLE sync_metadata IS 'Tracks device sync state and last successful sync timestamp';

COMMENT ON COLUMN police_forms.local_id IS 'Client-generated UUID for offline-created records';
COMMENT ON COLUMN police_forms.form_number IS 'Auto-generated registration number: PROP-REG-YEAR-SEQUENCE';
COMMENT ON COLUMN police_forms.is_minor IS 'Auto-calculated: TRUE if guest under 18 at check-in';
COMMENT ON COLUMN police_forms.guardian_id IS 'Reference to guardian police_form if guest is minor';

-- =============================================
-- DONE
-- =============================================
