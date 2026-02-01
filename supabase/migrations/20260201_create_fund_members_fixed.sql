-- =================================================================
-- Fund Members Table Migration
-- Purpose: Track explicit membership in fund periods (who pays/receives)
-- This allows Funds to be isolated per group/team effectively
-- =================================================================

-- 1. Create fund_members table
CREATE TABLE IF NOT EXISTS public.fund_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fund_id UUID REFERENCES public.fund_periods(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique membership per fund
    UNIQUE(fund_id, user_id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.fund_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Allow all authenticated users to read fund members (needed for visibility checks)
CREATE POLICY "fund_members_select_all" ON public.fund_members
    FOR SELECT 
    USING (true);

-- Allow admins and mods to insert members (Manage funds)
CREATE POLICY "fund_members_insert_admin_mod" ON public.fund_members
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'mod')
        )
    );

-- Allow admins and mods to delete members
CREATE POLICY "fund_members_delete_admin_mod" ON public.fund_members
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'mod')
        )
    );

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_fund_members_fund_id ON public.fund_members(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_members_user_id ON public.fund_members(user_id);
