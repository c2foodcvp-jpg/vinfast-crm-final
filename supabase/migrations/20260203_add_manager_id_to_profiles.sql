-- Add manager_id to profiles for Mod management scope
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
