-- Create RPC to fetch channels with metadata (sorting, unread count, DM info)
-- Create RPC to fetch channels with metadata (sorting, unread count, DM info)
DROP FUNCTION IF EXISTS get_channels_with_meta();

CREATE OR REPLACE FUNCTION get_channels_with_meta()
RETURNS TABLE (
  channel_id UUID,
  channel_type TEXT,
  channel_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count BIGINT,
  receiver_id UUID,
  receiver_name TEXT,
  receiver_last_seen TIMESTAMPTZ,
  receiver_avatar TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  RETURN QUERY
  WITH user_channels AS (
      -- Get all channels the user is a member of
      SELECT 
          cm.channel_id,
          cm.last_read_at,
          c.type,
          c.name
      FROM chat_members cm
      JOIN chat_channels c ON cm.channel_id = c.id
      WHERE cm.user_id = current_user_id

      UNION ALL

      -- Include Global Channel if user is not a member (default visibility)
      SELECT 
          c.id as channel_id,
          now() as last_read_at, -- Default to now so historical messages aren't all unread
          c.type,
          c.name
      FROM chat_channels c
      WHERE c.type = 'global'
      AND NOT EXISTS (
          SELECT 1 FROM chat_members cm 
          WHERE cm.channel_id = c.id AND cm.user_id = current_user_id
      )
  ),
  channel_meta AS (
      -- Calculate unread counts and get last message for each channel
      SELECT 
          uc.channel_id,
          (
              SELECT count(*)
              FROM chat_messages msg
              WHERE msg.channel_id = uc.channel_id
              AND msg.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz)
              AND msg.sender_id != current_user_id
          ) AS unread_count,
          (
              SELECT created_at
              FROM chat_messages msg
              WHERE msg.channel_id = uc.channel_id
              ORDER BY created_at DESC
              LIMIT 1
          ) AS last_msg_time,
          (
              SELECT content
              FROM chat_messages msg
              WHERE msg.channel_id = uc.channel_id
              ORDER BY created_at DESC
              LIMIT 1
          ) AS last_msg_content
      FROM user_channels uc
  ),
  dm_info AS (
      -- Get partner info for DM channels
      SELECT 
          m.channel_id,
          p.id AS partner_id,
          p.full_name AS partner_name,
          p.last_seen_at AS partner_last_seen,
          p.avatar_url AS partner_avatar
      FROM chat_members m
      JOIN profiles p ON m.user_id = p.id
      WHERE m.user_id != current_user_id
      AND m.channel_id IN (SELECT channel_id FROM user_channels WHERE type = 'dm')
  )
  SELECT 
      uc.channel_id,
      uc.type::text, -- Cast enum to text
      uc.name,
      cm.last_msg_time,
      cm.last_msg_content,
      cm.unread_count,
      di.partner_id,
      di.partner_name,
      di.partner_last_seen,
      di.partner_avatar
  FROM user_channels uc
  JOIN channel_meta cm ON uc.channel_id = cm.channel_id
  LEFT JOIN dm_info di ON uc.channel_id = di.channel_id
  ORDER BY cm.last_msg_time DESC NULLS LAST; -- Sort by newest message
END;
$$;

-- Helper to mark channel as read
CREATE OR REPLACE FUNCTION mark_channel_read(p_channel_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_members
  SET last_read_at = now()
  WHERE channel_id = p_channel_id AND user_id = auth.uid();
END;
$$;
