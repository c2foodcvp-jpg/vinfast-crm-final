-- 1. Add member_tier column to profiles if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'member_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN member_tier text CHECK (member_tier IN ('Gold', 'Platinum', 'Diamond'));
    END IF;
END $$;
