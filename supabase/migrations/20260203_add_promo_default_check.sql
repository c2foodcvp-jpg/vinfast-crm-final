
-- Add is_default column to quote_configs table for promotions
ALTER TABLE public.quote_configs ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT true;
