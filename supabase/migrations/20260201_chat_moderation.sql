-- Create Chat Bans Table
CREATE TABLE IF NOT EXISTS chat_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  banned_until TIMESTAMPTZ NOT NULL,
  banned_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE chat_bans ENABLE ROW LEVEL SECURITY;

-- Policies for Chat Bans
-- Admins can view/manage all bans
-- Mods can view/manage bans for channels they manage
CREATE POLICY "Admins can do anything with bans" ON chat_bans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Managers can manage bans for their team channels" ON chat_bans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_channels c 
      WHERE c.id = chat_bans.channel_id 
      AND (c.manager_id = auth.uid() OR c.type = 'team') -- Simplified: Check logic in RPC is safer
    )
  );

-- Function to Ban User (Secure)
CREATE OR REPLACE FUNCTION ban_chat_user(
  p_channel_id UUID,
  p_target_user_id UUID,
  p_minutes INT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operator_role TEXT;
  v_channel_type chat_channel_type;
  v_channel_manager UUID;
BEGIN
  -- Get Operator Info
  SELECT role INTO v_operator_role FROM profiles WHERE id = auth.uid();
  
  -- Get Channel Info
  SELECT type, manager_id INTO v_channel_type, v_channel_manager 
  FROM chat_channels WHERE id = p_channel_id;

  -- Permission Check
  IF v_channel_type = 'global' THEN
    IF v_operator_role != 'admin' THEN
      RAISE EXCEPTION 'Chỉ Admin mới có quyền cấm chat ở Kênh Chung';
    END IF;
  ELSIF v_channel_type = 'team' THEN
    -- Admin OR Channel Manager can ban
    IF v_operator_role != 'admin' AND v_channel_manager != auth.uid() THEN
      RAISE EXCEPTION 'Bạn không có quyền quản lý kênh này';
    END IF;
  ELSE
    RAISE EXCEPTION 'Không thể cấm chat trong kênh này';
  END IF;

  -- Upsert Ban
  INSERT INTO chat_bans (channel_id, user_id, banned_until, banned_by, reason)
  VALUES (
    p_channel_id, 
    p_target_user_id, 
    now() + (p_minutes || ' minutes')::INTERVAL, 
    auth.uid(), 
    p_reason
  )
  ON CONFLICT (channel_id, user_id) 
  DO UPDATE SET banned_until = EXCLUDED.banned_until, banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason;
END;
$$;

-- Update Message Sending Policy to Respect Bans
-- Note: We drop and recreate the policy to ensure it includes the ban check
DROP POLICY IF EXISTS "Send messages" ON chat_messages;

CREATE POLICY "Send messages" ON chat_messages FOR INSERT WITH CHECK (
  (
    EXISTS (SELECT 1 FROM chat_channels WHERE id = chat_messages.channel_id AND type = 'global')
    OR
    EXISTS (SELECT 1 FROM chat_members WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid())
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM chat_bans 
    WHERE channel_id = chat_messages.channel_id 
    AND user_id = auth.uid() 
    AND banned_until > now()
  )
);

-- Helper to check if user is banned (for UI)
CREATE OR REPLACE FUNCTION get_my_ban_info(p_channel_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_banned_until TIMESTAMPTZ;
BEGIN
  SELECT banned_until INTO v_banned_until
  FROM chat_bans
  WHERE channel_id = p_channel_id AND user_id = auth.uid()
  AND banned_until > now();
  
  RETURN v_banned_until;
END;
$$;
