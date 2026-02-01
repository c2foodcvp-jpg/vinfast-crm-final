-- Enable Delete on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policies to avoid conflicts
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "Managers can delete messages" ON chat_messages;

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
