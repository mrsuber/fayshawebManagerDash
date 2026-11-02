-- Wellness bookings: every booking carries a code the guest shows on arrival (staff check it in with it). A time the
-- team opened in Availability is confirmed at once; any other time is a request a manager confirms or declines.
-- Several services booked together share a group reference.
ALTER TABLE wellness_bookings DROP CONSTRAINT IF EXISTS wellness_bookings_status_check;
ALTER TABLE wellness_bookings ADD CONSTRAINT wellness_bookings_status_check
  CHECK (status IN ('requested', 'upcoming', 'in_progress', 'completed', 'cancelled', 'no_show', 'declined'));
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS booking_code VARCHAR(12);
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS group_ref VARCHAR(20);
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS people INTEGER NOT NULL DEFAULT 1;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS checked_in_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Existing bookings get a code too.
UPDATE wellness_bookings
   SET booking_code = 'W' || upper(substr(md5(id::text || random()::text), 1, 6))
 WHERE booking_code IS NULL;
UPDATE wellness_bookings SET confirmed_at = created_at WHERE confirmed_at IS NULL AND status NOT IN ('cancelled', 'declined');
CREATE UNIQUE INDEX IF NOT EXISTS idx_wellness_bookings_code ON wellness_bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_wellness_bookings_requested ON wellness_bookings(status) WHERE status = 'requested';
