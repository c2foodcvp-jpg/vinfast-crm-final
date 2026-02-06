-- Add transaction_date column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to have transaction_date = created_at if null
UPDATE transactions 
SET transaction_date = created_at 
WHERE transaction_date IS NULL;

-- Comment on column
COMMENT ON COLUMN transactions.transaction_date IS 'Date when the transaction actually occurred (can be backdated)';
