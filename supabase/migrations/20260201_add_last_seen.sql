-- Add last_seen_at to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- Policy to allow users to update their own last_seen_at
CREATE POLICY "Users can update their own last_seen_at" ON profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Or update the existing update policy if it covers all columns
-- Usually "Update own profile" exists.

-- Add index for performance if list is long
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at);
