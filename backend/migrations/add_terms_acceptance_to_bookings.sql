-- Add Terms and Conditions Acceptance to Bookings
-- This migration adds fields to track T&C acceptance for each booking

-- Add terms acceptance fields to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;

-- Create an index for queries filtering by terms acceptance
CREATE INDEX IF NOT EXISTS idx_bookings_terms_accepted ON bookings(terms_accepted);

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('terms_accepted', 'terms_accepted_at')
ORDER BY column_name;
