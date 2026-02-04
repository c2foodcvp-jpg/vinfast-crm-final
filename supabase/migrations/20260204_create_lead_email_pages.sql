-- Migration: Create lead_email_pages table for MOD-specific Lead Email configurations
-- Each MOD can have their own Lead Email page with separate script settings

CREATE TABLE IF NOT EXISTS lead_email_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mod_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- Display name (e.g., "Lead Form A")
  email_script_url TEXT,                   -- Google Apps Script URL for email notifications
  auto_import_script_url TEXT,             -- Script URL to automatically import/download leads
  source_filter TEXT,                      -- Filter leads by source field (optional)
  auto_download_enabled BOOLEAN DEFAULT FALSE,
  auto_assign_enabled BOOLEAN DEFAULT FALSE,
  auto_assign_config JSONB DEFAULT '{}',   -- { round_robin: true, max_per_day: 5 }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: One page per MOD (can be relaxed later if needed)
ALTER TABLE lead_email_pages ADD CONSTRAINT unique_mod_lead_page UNIQUE (mod_id);

-- Create index for fast lookup by mod_id
CREATE INDEX IF NOT EXISTS idx_lead_email_pages_mod_id ON lead_email_pages(mod_id);

-- Enable Row Level Security
ALTER TABLE lead_email_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything
CREATE POLICY "admin_manage_lead_email_pages" ON lead_email_pages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: MOD can read their own page configuration
CREATE POLICY "mod_read_own_lead_email_page" ON lead_email_pages
  FOR SELECT TO authenticated
  USING (mod_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE lead_email_pages IS 'Stores MOD-specific Lead Email page configurations with email scripts and auto-assign settings';
COMMENT ON COLUMN lead_email_pages.email_script_url IS 'Google Apps Script Web App URL for sending email notifications';
COMMENT ON COLUMN lead_email_pages.source_filter IS 'Filter leads by source field value (e.g., "Form A", "Website")';
COMMENT ON COLUMN lead_email_pages.auto_assign_config IS 'JSON config for auto-assignment: { round_robin: bool, max_per_day: number }';
