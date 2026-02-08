-- Add quote_template column to profiles table to store custom print settings for MODs
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS quote_template JSONB DEFAULT '{"title": "BÁO GIÁ XE VINFAST", "company_name": "VINFAST AUTO", "subtitle": "Cứu hộ miễn phí 24/7"}';

-- Comment: This allows each user (specifically MODs) to have their own print template strings.
