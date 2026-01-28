-- Add delivery_progress column to customers table
ALTER TABLE customers 
ADD COLUMN delivery_progress JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN customers.delivery_progress IS 'Tracks the vehicle delivery stages: { [step_key]: { completed: boolean, timestamp: string } }';
