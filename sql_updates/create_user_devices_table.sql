-- Create user_devices table for storing FCM tokens
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fcm_token TEXT NOT NULL,
    device_type TEXT DEFAULT 'web',
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate tokens for same user (or same token for different users?)
    -- Token should be unique per device. One user can have multiple devices.
    -- But one device token usually belongs to one user at a time.
    CONSTRAINT user_devices_user_token_key UNIQUE (user_id, fcm_token)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can insert/update their own devices
CREATE POLICY "Users can insert their own devices" 
ON public.user_devices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" 
ON public.user_devices FOR UPDATE 
USING (auth.uid() = user_id);

-- 2. Users can see their own devices
CREATE POLICY "Users can view their own devices" 
ON public.user_devices FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Service Role (Edge Functions) can see all
-- (Service Role bypasses RLS by default, but explicit policy helps if using restricted client)
-- No need for policy for Service Role usually.

-- Grant permissions (if needed for Anon/Authenticated)
GRANT ALL ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
