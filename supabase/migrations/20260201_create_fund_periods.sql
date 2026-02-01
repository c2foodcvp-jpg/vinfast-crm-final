-- =================================================================
-- Fund Periods Table Migration
-- Purpose: Track fund closing periods for finance calculations
-- Customers are assigned to periods based on their created_at date
-- =================================================================

-- 1. Create fund_periods table
CREATE TABLE IF NOT EXISTS public.fund_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,                  -- e.g. "Quỹ T1/2026", "Quỹ Q1/2026"
    start_date DATE NOT NULL,            -- Period start (inclusive)
    end_date DATE,                       -- Period end (inclusive), NULL = open/current
    closed_at TIMESTAMPTZ,               -- When the period was closed
    closed_by UUID REFERENCES public.profiles(id),
    is_completed BOOLEAN DEFAULT false,  -- NEW: Fund is fully completed/archived
    completed_at TIMESTAMPTZ,            -- NEW: When fund was marked as completed
    manager_id UUID REFERENCES public.profiles(id), -- Team isolation
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.fund_periods ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Allow all authenticated users to read fund periods
CREATE POLICY "fund_periods_select_all" ON public.fund_periods
    FOR SELECT 
    USING (true);

-- Allow admins and mods to insert new fund periods
CREATE POLICY "fund_periods_insert_admin_mod" ON public.fund_periods
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'mod')
        )
    );

-- Allow admins and mods to update fund periods
CREATE POLICY "fund_periods_update_admin_mod" ON public.fund_periods
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'mod')
        )
    );

-- Allow admins to delete fund periods
CREATE POLICY "fund_periods_delete_admin" ON public.fund_periods
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 4. Optional: Add fund_period_id to customers table for explicit assignment
-- (Not required - customers are assigned based on created_at date)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fund_period_id UUID REFERENCES public.fund_periods(id);

-- 5. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fund_periods_start_date ON public.fund_periods(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_fund_periods_manager_id ON public.fund_periods(manager_id);
