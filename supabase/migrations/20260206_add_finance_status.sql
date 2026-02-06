-- Add finance_status column to customers table for tracking active/completed finance
ALTER TABLE customers ADD COLUMN IF NOT EXISTS finance_status TEXT DEFAULT 'active' CHECK (finance_status IN ('active', 'completed'));

-- Comment
COMMENT ON COLUMN customers.finance_status IS 'Active: Đang quản lý, Completed: Đã hoàn thành (Finance)';
