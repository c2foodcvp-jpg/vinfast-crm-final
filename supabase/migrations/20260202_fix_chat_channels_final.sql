-- 3. Fix Group/Team Avatar Update Permissions
-- Ensure RLS is enabled on chat_channels
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- Allow Admins and Mods to update Team/Global channels
-- (Adjust logic if you want normal users to update DM avatars?? DMs usually use user avatar)
DROP POLICY IF EXISTS "Admins and Mods can update channels" ON chat_channels;
CREATE POLICY "Admins and Mods can update channels"
ON chat_channels
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'mod')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'mod')
  )
);

-- Allow VIEWING channels (Everyone needs this to see the avatar)
DROP POLICY IF EXISTS "Everyone can view visible channels" ON chat_channels;
CREATE POLICY "Everyone can view visible channels"
ON chat_channels
FOR SELECT
USING (
  type = 'global' 
  OR 
  (type = 'team' AND EXISTS (
      -- Assuming team logic is based on membership or global visibility for now
      -- If strictly by membership:
      SELECT 1 FROM chat_members WHERE channel_id = id AND user_id = auth.uid()
  ))
  OR
  (type = 'dm' AND EXISTS (
      SELECT 1 FROM chat_members WHERE channel_id = id AND user_id = auth.uid()
  ))
);

-- 4. Re-run V2 Function (Safety Check)
DROP FUNCTION IF EXISTS get_channels_v2();

CREATE OR REPLACE FUNCTION get_channels_v2()
RETURNS TABLE (
  channel_id UUID,
  channel_type TEXT,
  channel_name TEXT,
  channel_avatar_url TEXT, -- Added this field explicitly if missing in previous return
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
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  RETURN QUERY
  WITH user_channels AS (
      SELECT 
          cm.channel_id,
          cm.last_read_at,
          c.type,
          c.name,
          c.avatar_url
      FROM chat_members cm
      JOIN chat_channels c ON cm.channel_id = c.id
      WHERE cm.user_id = current_user_id
      UNION ALL
      SELECT 
          c.id as channel_id,
          now() as last_read_at,
          c.type,
          c.name,
          c.avatar_url
      FROM chat_channels c
      WHERE c.type = 'global'
      AND NOT EXISTS (SELECT 1 FROM chat_members cm WHERE cm.channel_id = c.id AND cm.user_id = current_user_id)
  ),
  channel_meta AS (
      SELECT 
          uc.channel_id,
          (SELECT count(*) FROM chat_messages msg WHERE msg.channel_id = uc.channel_id AND msg.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz) AND msg.sender_id != current_user_id) AS unread_count,
          (SELECT created_at FROM chat_messages msg WHERE msg.channel_id = uc.channel_id ORDER BY created_at DESC LIMIT 1) AS last_msg_time,
          (SELECT content FROM chat_messages msg WHERE msg.channel_id = uc.channel_id ORDER BY created_at DESC LIMIT 1) AS last_msg_content
      FROM user_channels uc
  ),
  dm_info AS (
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
      uc.type::text,
      uc.name,
      uc.avatar_url, -- RETURN THE AVATAR URL
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
  ORDER BY cm.last_msg_time DESC NULLS LAST;
END;
$$;
