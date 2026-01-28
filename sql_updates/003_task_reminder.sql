-- ============================================
-- TASK REMINDER EMAIL FEATURE
-- Migration: Upgrade user_tasks for time-based reminders
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Change deadline from DATE to TIMESTAMPTZ
-- This allows storing both date and time
ALTER TABLE user_tasks 
ALTER COLUMN deadline TYPE TIMESTAMPTZ 
USING deadline::timestamptz;

-- 2. Add reminder_enabled column (user toggle)
ALTER TABLE user_tasks 
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false;

-- 3. Add reminder_sent column (prevent duplicate emails)
ALTER TABLE user_tasks 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 4. Create index for faster reminder queries
CREATE INDEX IF NOT EXISTS idx_user_tasks_reminder 
ON user_tasks(deadline, reminder_enabled, reminder_sent, is_completed);

-- 5. Create RPC function to get pending reminders
-- This will be called by Google Apps Script every 10 minutes
CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
    task_id UUID,
    task_title TEXT,
    task_content TEXT,
    task_deadline TIMESTAMPTZ,
    task_priority TEXT,
    user_email TEXT,
    user_name TEXT,
    customer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id AS task_id,
        t.title AS task_title,
        t.content AS task_content,
        t.deadline AS task_deadline,
        t.priority AS task_priority,
        p.email AS user_email,
        p.full_name AS user_name,
        c.name AS customer_name
    FROM user_tasks t
    JOIN profiles p ON t.user_id = p.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE 
        t.reminder_enabled = true
        AND t.reminder_sent = false
        AND t.is_completed = false
        AND t.deadline IS NOT NULL
        -- Get tasks due in next 55-65 minutes (to account for 10-min trigger interval)
        AND t.deadline BETWEEN (NOW() + INTERVAL '55 minutes') AND (NOW() + INTERVAL '65 minutes');
END;
$$;

-- 6. Create RPC function to mark task as reminded
CREATE OR REPLACE FUNCTION mark_task_reminded(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_tasks 
    SET reminder_sent = true 
    WHERE id = p_task_id;
    
    RETURN FOUND;
END;
$$;

-- 7. Grant execute permissions (for anon/authenticated users via API)
GRANT EXECUTE ON FUNCTION get_pending_reminders() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_task_reminded(UUID) TO anon, authenticated, service_role;

-- ============================================
-- VERIFICATION QUERY (Run after migration)
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_tasks';

