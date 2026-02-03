ALTER TABLE system_notifications
ADD COLUMN target_user_ids uuid[] DEFAULT null;
