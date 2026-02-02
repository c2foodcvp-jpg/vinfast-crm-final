-- 1. Fix Avatar Profile Update Policy
DO $$ 
BEGIN
    -- Ensure "avatars" bucket exists
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do nothing;

    -- Update Profile Policy
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

    -- Storage Policies
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );

    DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
    CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );
    
    DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
    CREATE POLICY "Public can view avatars" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'avatars' );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. Fix Chat RPC (V2 to avoid type conflicts)
-- We rename this to 'get_channels_v2' to avoid the "cannot change return type" error on the existing function.
CREATE OR REPLACE FUNCTION get_channels_v2()
RETURNS TABLE (
  channel_id UUID,
  channel_type TEXT, -- Changed from ENUM to TEXT
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
          c.name
      FROM chat_members cm
      JOIN chat_channels c ON cm.channel_id = c.id
      WHERE cm.user_id = current_user_id
      UNION ALL
      SELECT 
          c.id as channel_id,
          now() as last_read_at,
          c.type,
          c.name
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
      uc.type::text, -- Explicit cast
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
  ORDER BY cm.last_msg_time DESC NULLS LAST;
END;
$$;
