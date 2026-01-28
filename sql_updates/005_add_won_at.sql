-- Migration: Add won_at logic
ALTER TABLE customers ADD COLUMN won_at TIMESTAMPTZ;

-- Backfill: If delivery_progress exists, use earliest timestamp. Else use updated_at for WON customers.
UPDATE customers
SET won_at = COALESCE(
  (
    SELECT MIN((value->>'timestamp')::timestamptz)
    FROM jsonb_each(delivery_progress)
    WHERE (value->>'completed')::boolean = true
    AND value->>'timestamp' IS NOT NULL
  ),
  updated_at
)
WHERE status = 'Chốt đơn' AND won_at IS NULL;
