-- Update RLS to allow ALL authenticated users to DELETE/UPDATE customer_transactions
-- (As requested: "Tất cả user đều có quyền xoá")

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable update for creators and admins" ON customer_transactions;
DROP POLICY IF EXISTS "Enable delete for creators and admins" ON customer_transactions;

-- Create new permissive policies for authenticated users
CREATE POLICY "Enable update for all authenticated users" 
ON customer_transactions FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for all authenticated users" 
ON customer_transactions FOR DELETE 
USING (auth.role() = 'authenticated');
