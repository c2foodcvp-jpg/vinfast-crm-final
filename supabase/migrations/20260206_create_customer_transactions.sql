-- Create customer_transactions table for independent customer finance tracking
CREATE TABLE IF NOT EXISTS customer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('revenue', 'expense')),
    amount NUMERIC NOT NULL,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON customer_transactions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON customer_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for creators and admins" ON customer_transactions FOR UPDATE USING (
    auth.uid() = created_by OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'mod'))
);
CREATE POLICY "Enable delete for creators and admins" ON customer_transactions FOR DELETE USING (
    auth.uid() = created_by OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'mod'))
);

-- Comment to clarify purpose
COMMENT ON TABLE customer_transactions IS 'Independent finance tracking for customers (Revenue/Expense) separate from Team Funds';
