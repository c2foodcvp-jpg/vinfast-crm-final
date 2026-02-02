-- Add fund_period_id to customers table to allow explicit fund assignment overrides
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS fund_period_id UUID REFERENCES public.fund_periods(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_fund_period_id ON public.customers(fund_period_id);
