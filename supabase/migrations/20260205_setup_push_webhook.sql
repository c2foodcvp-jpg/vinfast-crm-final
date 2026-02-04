
-- Enable pg_net extension to make HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'https://ksrzwrizbqkjyzqhkfkn.supabase.co'; -- Replace with your actual Project URL if different
    function_name TEXT := 'send-push';
    url TEXT := project_url || '/functions/v1/' || function_name;
    -- You need to put your SERVICE_ROLE_KEY here or use a secure way to store it if using vault
    -- For this example, we assume we can pass the Anon Key or explicit header, but usually Edge Functions are protected.
    -- Better approach: Put this in a Security Definer function or use Database Webhooks in Dashboard.
    
    -- NOTE: Creating Database Webhooks via SQL is complex because it involves `supabase_functions` schema which is managed.
    -- BELOW IS A SIMPLIFIED HTTP CALL USING pg_net.
    
    -- REPLACE 'YOUR_SERVICE_ROLE_KEY' with the actual key if you run this manually.
    service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY'; 
    payload JSONB;
BEGIN
    payload := row_to_json(NEW);
    
    PERFORM net.http_post(
        url := url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object('record', payload)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger logic
DROP TRIGGER IF EXISTS on_system_notification_created ON public.system_notifications;

CREATE TRIGGER on_system_notification_created
AFTER INSERT ON public.system_notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_push();
