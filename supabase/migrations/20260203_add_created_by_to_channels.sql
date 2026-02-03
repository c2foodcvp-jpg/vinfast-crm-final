-- Add created_by column to chat_channels
ALTER TABLE chat_channels 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_chat_channels_created_by ON chat_channels(created_by);
