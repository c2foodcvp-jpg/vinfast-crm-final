-- Add manager_id to chat_channels to link teams
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);

-- RPC to ensure user is in their correct Team Channel
CREATE OR REPLACE FUNCTION ensure_team_channel()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_manager_id UUID;
  v_team_owner_id UUID;
  v_channel_id UUID;
  v_team_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user info
  SELECT role, manager_id INTO v_role, v_manager_id
  FROM profiles
  WHERE id = v_user_id;

  -- Determine Team Owner
  IF v_role IN ('admin', 'mod') THEN
    v_team_owner_id := v_user_id;
  ELSE
    v_team_owner_id := v_manager_id;
  END IF;

  -- If no team owner (e.g. freelance employee?), exit
  IF v_team_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find existing Team Channel
  SELECT id INTO v_channel_id
  FROM chat_channels
  WHERE type = 'team' AND manager_id = v_team_owner_id
  LIMIT 1;

  -- Create if not exists
  IF v_channel_id IS NULL THEN
    -- Get Team Name
    SELECT COALESCE(full_name, 'Unknown') || '''s Team' INTO v_team_name
    FROM profiles
    WHERE id = v_team_owner_id;

    INSERT INTO chat_channels (type, name, manager_id)
    VALUES ('team', v_team_name, v_team_owner_id)
    RETURNING id INTO v_channel_id;
  END IF;

  -- Ensure User is Member
  INSERT INTO chat_members (channel_id, user_id)
  VALUES (v_channel_id, v_user_id)
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel_id;
END;
$$;
