-- Notifications table for alerts and system messages
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  recipient_type VARCHAR(50) NOT NULL, -- 'landlord', 'police', 'ministry', 'tax_authority', 'admin'
  recipient_id UUID, -- Optional: specific user/landlord ID
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  channel VARCHAR(20), -- 'sms', 'whatsapp', 'email', 'push', 'in_app'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER set_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Audit log table for compliance tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL, -- 'guest.checkin', 'guest.checkout', 'payment.completed', 'alert.created', etc.
  actor_type VARCHAR(50) NOT NULL, -- 'landlord', 'system', 'admin', 'police'
  actor_id UUID,
  entity_type VARCHAR(50) NOT NULL, -- 'guest', 'stay', 'payment', 'property', 'alert'
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action VARCHAR,
  p_actor_type VARCHAR,
  p_actor_id UUID,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (action, actor_type, actor_id, entity_type, entity_id, old_data, new_data)
  VALUES (p_action, p_actor_type, p_actor_id, p_entity_type, p_entity_id, p_old_data, p_new_data)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-log stay status changes
CREATE OR REPLACE FUNCTION log_stay_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'stay.created',
      'landlord',
      NULL,
      'stay',
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    PERFORM log_audit_event(
      'stay.status_changed',
      'landlord',
      NULL,
      'stay',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_stay_changes
  AFTER INSERT OR UPDATE ON stays
  FOR EACH ROW
  EXECUTE FUNCTION log_stay_changes();

-- Trigger to auto-log payment completions
CREATE OR REPLACE FUNCTION log_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    PERFORM log_audit_event(
      'payment.completed',
      'system',
      NULL,
      'payment',
      NEW.id,
      jsonb_build_object('status', OLD.status, 'amount', OLD.amount),
      jsonb_build_object('status', NEW.status, 'amount', NEW.amount, 'paid_at', NEW.paid_at)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_payment_changes
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_changes();

-- Trigger to auto-log alert status changes
CREATE OR REPLACE FUNCTION log_alert_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'alert.created',
      'system',
      NULL,
      'alert',
      NEW.id,
      NULL,
      jsonb_build_object('type', NEW.type, 'severity', NEW.severity, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    PERFORM log_audit_event(
      'alert.status_changed',
      COALESCE(NEW.resolved_by::VARCHAR, 'system'),
      NEW.resolved_by,
      'alert',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_alert_changes
  AFTER INSERT OR UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION log_alert_changes();

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notifications"
  ON notifications FOR ALL
  USING (is_admin());

CREATE POLICY "Police can view their notifications"
  ON notifications FOR SELECT
  USING (is_police() AND recipient_type = 'police');

CREATE POLICY "Ministry can view their notifications"
  ON notifications FOR SELECT
  USING (is_ministry() AND recipient_type = 'ministry');

-- RLS for audit logs (read-only for authorized users)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Ministry can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_ministry());

COMMENT ON TABLE notifications IS 'System notifications for alerts and messages';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance';
