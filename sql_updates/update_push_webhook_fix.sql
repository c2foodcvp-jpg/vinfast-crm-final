-- Enable pg_net extension to make HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'https://ksrzwrizbqkjyzqhkfkn.supabase.co'; -- REAL URL
    function_name TEXT := 'send-push';
    url TEXT := project_url || '/functions/v1/' || function_name;
    
    -- Using ANON KEY for authorization to Trigger Edge Function
    service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzcnp3cml6YnFranl6cWhrZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzkyMDcsImV4cCI6MjA4MjkxNTIwN30.8OxhjfjI0hqfYONKO4sC650KZO8uGNFtdwSV-2rmbEA'; 
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
