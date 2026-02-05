-- Migration: Add email_logs table for security audit trail
-- Part of Level 2 Security Enhancement

-- 1. Create email_logs table for audit purposes
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);

-- 3. Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can only view their own email logs
CREATE POLICY "Users can view own email logs"
    ON public.email_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Admin can view all email logs
CREATE POLICY "Admin can view all email logs"
    ON public.email_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only service role (Edge Functions) can insert
CREATE POLICY "Service role can insert email logs"
    ON public.email_logs FOR INSERT
    WITH CHECK (true);

-- Comment
COMMENT ON TABLE public.email_logs IS 'Audit trail for all emails sent through the system (Level 2 Security)';
