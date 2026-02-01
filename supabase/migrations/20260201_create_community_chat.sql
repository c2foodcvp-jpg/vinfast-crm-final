-- Create Chat Tables
DO $$ BEGIN
    CREATE TYPE chat_channel_type AS ENUM ('global', 'team', 'dm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type chat_channel_type NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Using profiles(id) as it likely maps to auth.users
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_system BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Channels: Everyone can see global. Members can see their DM/Team.
CREATE POLICY "View all channels" ON chat_channels FOR SELECT USING (true); -- Simplify for now, filter in UI or Join
CREATE POLICY "Insert channels" ON chat_channels FOR INSERT WITH CHECK (true); -- Allow creation (e.g. DMs)

-- Members:
CREATE POLICY "View members" ON chat_members FOR SELECT USING (true);
CREATE POLICY "Join members" ON chat_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Update members" ON chat_members FOR UPDATE USING (user_id = auth.uid());

-- Messages:
-- Visible if: Channel is Global OR User is in chat_members
CREATE POLICY "View messages" ON chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_channels WHERE id = chat_messages.channel_id AND type = 'global')
  OR
  EXISTS (SELECT 1 FROM chat_members WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid())
);

CREATE POLICY "Send messages" ON chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM chat_channels WHERE id = chat_messages.channel_id AND type = 'global')
  OR
  EXISTS (SELECT 1 FROM chat_members WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid())
);

-- Seed Global Channel
INSERT INTO chat_channels (id, type, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'global', 'Kênh Chung')
ON CONFLICT (id) DO NOTHING;

-- RPC to create or get DM channel
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  channel_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if a DM channel already exists with exactly these two members
  SELECT c.id INTO channel_id
  FROM chat_channels c
  JOIN chat_members m1 ON c.id = m1.channel_id
  JOIN chat_members m2 ON c.id = m2.channel_id
  WHERE c.type = 'dm'
    AND m1.user_id = current_user_id
    AND m2.user_id = target_user_id;

  IF channel_id IS NOT NULL THEN
    RETURN channel_id;
  END IF;

  -- Create new channel
  INSERT INTO chat_channels (type) VALUES ('dm') RETURNING id INTO channel_id;
  
  -- Add members
  INSERT INTO chat_members (channel_id, user_id) VALUES (channel_id, current_user_id);
  INSERT INTO chat_members (channel_id, user_id) VALUES (channel_id, target_user_id);
  
  RETURN channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
