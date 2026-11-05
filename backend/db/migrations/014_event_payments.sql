-- Event deposits paid online (card or mobile money) are recorded as payments of the event request, so they sit
-- next to stay payments. A payment belongs to a booking or to an event request.
ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS event_request_id INTEGER REFERENCES event_requests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_request_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_belongs_to_something') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_belongs_to_something CHECK (booking_id IS NOT NULL OR event_request_id IS NOT NULL);
  END IF;
END $$;
