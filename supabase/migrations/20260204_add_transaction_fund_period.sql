-- Add fund_period_id to transactions table to allow explicit fund assignment for expenses
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS fund_period_id UUID REFERENCES public.fund_periods(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_fund_period_id ON public.transactions(fund_period_id);
