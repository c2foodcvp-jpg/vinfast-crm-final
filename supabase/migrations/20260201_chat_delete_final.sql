-- =============================================
-- 1. ENABLE RLS & CLEANUP
-- =============================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "Managers can delete messages" ON chat_messages;
DROP POLICY IF EXISTS "anyone_can_delete" ON chat_messages;

-- =============================================
-- 2. CREATE DELETE POLICIES (For direct delete support)
-- =============================================
-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON chat_messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );

-- Policy: Admins and Channel Managers can delete any message in their channel
CREATE POLICY "Managers can delete messages" ON chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_channels c 
      WHERE c.id = chat_messages.channel_id 
      AND (
        -- Global Channel: Only Admin
        (c.type = 'global' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
        OR
        -- Team Channel: Admin or Manager
        (c.type = 'team' AND (c.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')))
      )
    )
  );

-- =============================================
-- 3. SECURE DELETE FUNCTION (RPC)
-- =============================================
CREATE OR REPLACE FUNCTION delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
  v_channel_id UUID;
  v_channel_type chat_channel_type;
  v_channel_manager UUID;
  v_operator_role TEXT;
BEGIN
  -- Get Message Info
  SELECT sender_id, channel_id INTO v_sender_id, v_channel_id
  FROM chat_messages WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tin nhắn không tồn tại';
  END IF;

  -- Get Operator Info
  SELECT role INTO v_operator_role FROM profiles WHERE id = auth.uid();

  -- Access Control Logic
  -- 1. Owner can delete
  IF v_sender_id = auth.uid() THEN
    DELETE FROM chat_messages WHERE id = p_message_id;
    RETURN;
  END IF;

  -- 2. Admin/Manager Check
  SELECT type, manager_id INTO v_channel_type, v_channel_manager 
  FROM chat_channels WHERE id = v_channel_id;

  -- Global: Admin only
  IF v_channel_type = 'global' AND v_operator_role = 'admin' THEN
     DELETE FROM chat_messages WHERE id = p_message_id;
     RETURN;
  END IF;

  -- Team: Admin or Manager
  IF v_channel_type = 'team' THEN
    IF v_operator_role = 'admin' OR v_channel_manager = auth.uid() THEN
       DELETE FROM chat_messages WHERE id = p_message_id;
       RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Bạn không có quyền xóa tin nhắn này';
END;
$$;
