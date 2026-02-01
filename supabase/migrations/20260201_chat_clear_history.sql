-- Add cleared_history_at to chat_members
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS cleared_history_at TIMESTAMPTZ DEFAULT NULL;

-- Function to clear history securely
CREATE OR REPLACE FUNCTION clear_chat_history(p_channel_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_members 
  SET cleared_history_at = now()
  WHERE channel_id = p_channel_id AND user_id = auth.uid();
END;
$$;
