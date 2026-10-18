-- Migration: Add Digital Key Fields to Bookings
-- This adds QR codes, PINs, and other access credentials to booking tables
-- Date: 2026-09-22

-- Add fields to apartment bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gate_qr_code VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS door_pin VARCHAR(4);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_box_number VARCHAR(10);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_box_pin VARCHAR(4);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS keys_generated_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;

-- Add fields to wellness journey bookings table
ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS journey_pin VARCHAR(4);
ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);
ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS keys_generated_at TIMESTAMP;
ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;

-- Create index for faster key lookups
CREATE INDEX IF NOT EXISTS idx_bookings_gate_qr_code ON bookings(gate_qr_code);
CREATE INDEX IF NOT EXISTS idx_bookings_user_active ON bookings(user_id, status) WHERE status IN ('confirmed', 'checked_in');
CREATE INDEX IF NOT EXISTS idx_wellness_journey_bookings_user_active ON wellness_journey_bookings(user_id, status) WHERE status = 'confirmed';

-- Add comment
COMMENT ON COLUMN bookings.gate_qr_code IS 'QR code for gate access - format: FAYSHAA-APT-{booking_id}-{user_id}-{timestamp}';
COMMENT ON COLUMN bookings.door_pin IS '4-digit PIN for door access';
COMMENT ON COLUMN bookings.deposit_box_number IS 'Assigned deposit box number (e.g., DB-27)';
COMMENT ON COLUMN bookings.deposit_box_pin IS '4-digit PIN for deposit box - changes after each opening';
COMMENT ON COLUMN wellness_journey_bookings.journey_pin IS '4-digit PIN for journey stage access';
COMMENT ON COLUMN wellness_journey_bookings.qr_code IS 'QR code for journey venue access';
