-- Admin users table for police, ministry, and tax authority staff
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'police', 'ministry', 'tax_authority')),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(255), -- e.g., "Commissariat Central Dakar", "DGPN", "Direction du Tourisme"
  badge_number VARCHAR(50), -- For police officers
  region VARCHAR(100), -- Assigned region for regional agents
  permissions JSONB DEFAULT '[]', -- Fine-grained permissions
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_region ON admin_users(region);

-- Trigger to update updated_at
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update helper functions to check admin roles
CREATE OR REPLACE FUNCTION get_admin_role() RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT role FROM admin_users
    WHERE user_id = auth.uid()
    AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is an active admin
CREATE OR REPLACE FUNCTION is_active_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin users"
  ON admin_users FOR ALL
  USING (get_admin_role() = 'admin');

CREATE POLICY "Admin users can view their own profile"
  ON admin_users FOR SELECT
  USING (user_id = auth.uid());

-- Real-time subscriptions setup
-- Enable realtime for alerts table
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Create function to broadcast new alerts
CREATE OR REPLACE FUNCTION broadcast_new_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Broadcast to realtime channel
  PERFORM pg_notify(
    'new_alert',
    json_build_object(
      'id', NEW.id,
      'type', NEW.type,
      'severity', NEW.severity,
      'description', NEW.description,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_alert
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_new_alert();

-- Insert some sample admin users for testing (these would be created properly in production)
-- Note: In production, create these users through proper admin onboarding

COMMENT ON TABLE admin_users IS 'Administrative users for police, ministry, and tax authority';
COMMENT ON COLUMN admin_users.role IS 'User role: admin, police, ministry, or tax_authority';
COMMENT ON COLUMN admin_users.badge_number IS 'Police badge number for identification';
COMMENT ON COLUMN admin_users.permissions IS 'JSON array of specific permissions granted';
