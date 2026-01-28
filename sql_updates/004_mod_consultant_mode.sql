-- =============================================
-- MOD CONSULTANT MODE FEATURE
-- Cho phép MOD chuyển sang chế độ tư vấn (chỉ thấy khách hàng của mình)
-- =============================================

-- Step 1: Add column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_consultant_mode BOOLEAN DEFAULT false;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN profiles.is_consultant_mode IS 'Khi true, MOD chỉ thấy khách hàng của mình (như TVBH) thay vì team';

-- Verification
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'is_consultant_mode';
