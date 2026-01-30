-- 1. Create System Notifications Table
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_id UUID REFERENCES auth.users(id), -- Use auth.users or profiles(id) if referencing public profile
    sender_name TEXT, -- Cache name for display
    target_scope TEXT CHECK (target_scope IN ('all', 'team')),
    target_team_id UUID NULL, -- If scope is 'team', this is the manager_id of the team
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Acknowledgments Table
CREATE TABLE IF NOT EXISTS notification_acknowledgments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID REFERENCES system_notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_acknowledgments ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- System Notifications: Everyone can read active notifications
-- (Logic will be handled in frontend to filter 'team' scope, or here)
DROP POLICY IF EXISTS "Read System Notifications" ON system_notifications;
CREATE POLICY "Read System Notifications" ON system_notifications
FOR SELECT
USING (true);

-- System Notifications: Only Admin/Mod can manage
DROP POLICY IF EXISTS "Manage System Notifications" ON system_notifications;
CREATE POLICY "Manage System Notifications" ON system_notifications
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'mod')
  )
);

-- Acknowledgments: Users manage their own
DROP POLICY IF EXISTS "Manage Own Acks" ON notification_acknowledgments;
CREATE POLICY "Manage Own Acks" ON notification_acknowledgments
FOR ALL
USING (auth.uid() = user_id);

-- 5. Registration Services Team Isolation
ALTER TABLE registration_services ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

ALTER TABLE registration_services ENABLE ROW LEVEL SECURITY;

-- Read: Public (Global) + Own Team + Admin
DROP POLICY IF EXISTS "Read Reg Services" ON registration_services;
CREATE POLICY "Read Reg Services" ON registration_services FOR SELECT
USING (
    manager_id IS NULL 
    OR manager_id = auth.uid() 
    OR manager_id = (SELECT manager_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Write: Admin (All) + Mod (Own)
DROP POLICY IF EXISTS "Manage Reg Services" ON registration_services;
CREATE POLICY "Manage Reg Services" ON registration_services FOR ALL
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    manager_id = auth.uid()
);
