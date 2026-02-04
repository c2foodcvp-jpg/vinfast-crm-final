
-- Create user_devices table to store FCM tokens
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type TEXT, -- 'ios', 'android', 'web'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, fcm_token)
);

-- RLS Policies
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own devices" 
ON public.user_devices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own devices" 
ON public.user_devices FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" 
ON public.user_devices FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" 
ON public.user_devices FOR DELETE 
USING (auth.uid() = user_id);
