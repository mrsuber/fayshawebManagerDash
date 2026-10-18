-- Migration: Add Temporary Password Field to Bookings
-- This allows us to store the temporary password until the comprehensive email is sent
-- Date: 2026-09-24

-- Add temporary password field to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS temporary_password VARCHAR(255);

-- Add comment
COMMENT ON COLUMN bookings.temporary_password IS 'Temporary storage for new account password - cleared after confirmation email is sent';
