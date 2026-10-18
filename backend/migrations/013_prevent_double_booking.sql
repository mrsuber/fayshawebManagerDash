-- Migration: Prevent Double Booking with Database Constraints
-- This adds database-level protection against overlapping bookings
-- Date: 2026-09-21

-- Enable btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint to prevent overlapping bookings
-- This ensures that no two confirmed/checked_in/pending bookings can overlap for the same apartment
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  apartment_id WITH =,
  daterange(check_in_date, check_out_date, '[)') WITH &&
)
WHERE (status IN ('confirmed', 'checked_in', 'pending'));

-- Create index for better performance on availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_availability
ON bookings(apartment_id, check_in_date, check_out_date, status)
WHERE status IN ('confirmed', 'checked_in', 'pending');

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT bookings_no_overlap ON bookings IS
'Prevents double-booking: No two active bookings (confirmed, checked_in, pending) can have overlapping dates for the same apartment';
