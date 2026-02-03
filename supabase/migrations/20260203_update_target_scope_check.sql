ALTER TABLE system_notifications DROP CONSTRAINT IF EXISTS system_notifications_target_scope_check;
ALTER TABLE system_notifications ADD CONSTRAINT system_notifications_target_scope_check CHECK (target_scope IN ('all', 'team', 'specific'));
