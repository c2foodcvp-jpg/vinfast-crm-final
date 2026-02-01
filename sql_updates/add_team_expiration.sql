-- Add team_expiration_date to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_expiration_date TIMESTAMPTZ;

-- Comment on column
COMMENT ON COLUMN profiles.team_expiration_date IS 'Expiration date for the Team. Only applicable for MOD (Team Leader). If expired, the MOD and their employees cannot login.';
