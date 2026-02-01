-- Enable Realtime for Chat Messages
BEGIN;
  -- Add table to publication if it exists (Supabase default is 'supabase_realtime')
  -- We use DO block to avoid errors if publication doesn't exist (rare)
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels; 
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
    END IF;
  END
  $$;
COMMIT;
