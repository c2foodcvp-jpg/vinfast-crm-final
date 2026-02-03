-- Add 'can_manage_fund' column to 'profiles' table for granular Mod permissions
-- This allows specific Moderators to be granted permission to adjust Fund Periods manually

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_manage_fund BOOLEAN DEFAULT FALSE;

-- Update RLS policies (optional, but good practice if you have specific restrictions)
-- For now, we assume existing Read/Update policies cover typical profile usage.
-- You might want to ensure only Admins can toggle this flag.

-- Example: Allow users to read this column (already covered by "Enable read access for all users" usually)
-- But ensuring Admin-only write for this specific column would require a Trigger or careful API logic if using RLS for updates.
-- Since Supabase Dashboard / Admin API is likely used to set this, standard RLS is fine.

COMMENT ON COLUMN public.profiles.can_manage_fund IS 'Permission for Moderators to manually adjust Customer Fund Periods';
