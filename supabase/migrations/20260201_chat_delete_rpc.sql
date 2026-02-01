-- RPC: delete_chat_message
-- Allows a user to delete a message if they are the sender, admin, or channel manager.
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

  -- Case 1: Delete Own Message
  IF v_sender_id = auth.uid() THEN
    DELETE FROM chat_messages WHERE id = p_message_id;
    RETURN;
  END IF;

  -- Case 2: Admin or Manager
  -- Get Channel Info
  SELECT type, manager_id INTO v_channel_type, v_channel_manager 
  FROM chat_channels WHERE id = v_channel_id;

  -- Global Channel: Admin Only
  IF v_channel_type = 'global' AND v_operator_role = 'admin' THEN
    DELETE FROM chat_messages WHERE id = p_message_id;
    RETURN;
  END IF;

  -- Team Channel: Admin or Manager
  IF v_channel_type = 'team' THEN
    IF v_operator_role = 'admin' OR v_channel_manager = auth.uid() THEN
       DELETE FROM chat_messages WHERE id = p_message_id;
       RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Bạn không có quyền xóa tin nhắn này';
END;
$$;
