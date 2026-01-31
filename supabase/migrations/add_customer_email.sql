-- =====================================================
-- MIGRATION: Add Email Column to Customers
-- Description: Thêm trường email cho khách hàng để hỗ trợ
--              gửi báo giá và thông báo tiến trình tự động
-- =====================================================

-- Add email column to customers table (nullable)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for faster email lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN customers.email IS 'Email khách hàng - dùng cho gửi báo giá và thông báo tiến trình';
