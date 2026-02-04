-- =============================================
-- Migration: Add App Settings Table
-- Date: 2026-02-04
-- Purpose: Store system-wide AND team-specific configurable values
-- =============================================

-- 1. Create app_settings table (if not exists)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL,
    value text NOT NULL
);

-- 2. Add missing columns if table already exists
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id);

-- 3. Drop old unique constraint and create new one (key + manager_id)
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
DROP INDEX IF EXISTS idx_app_settings_key_manager;
CREATE UNIQUE INDEX idx_app_settings_key_manager ON public.app_settings(key, COALESCE(manager_id, '00000000-0000-0000-0000-000000000000'));

-- 4. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Anyone can read, Admin/Mod can write
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Anyone can read settings" ON public.app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage settings" ON public.app_settings;
CREATE POLICY "Admin can manage settings" ON public.app_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'mod')
        )
    );

-- 6. Insert GLOBAL default KPI penalty rate (3% = 0.03) - manager_id = NULL means global
INSERT INTO public.app_settings (key, value, description, manager_id)
VALUES ('kpi_penalty_rate', '0.03', 'Tỉ lệ phạt KPI mỗi xe thiếu chỉ tiêu (mặc định toàn hệ thống)', NULL)
ON CONFLICT DO NOTHING;

-- 7. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

