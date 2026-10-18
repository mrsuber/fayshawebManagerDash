-- Fix Deposit Box Foreign Key Constraints
-- This migration fixes issues when bookings are deleted but deposit boxes still reference them

-- Step 1: Clear stale booking references from deposit boxes
UPDATE deposit_boxes db
SET current_booking_id = NULL
WHERE current_booking_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = db.current_booking_id
  );

-- Step 2: Drop and recreate the foreign key constraint with ON DELETE SET NULL
-- This allows the deposit_box_history table to keep historical records even when bookings are deleted

ALTER TABLE deposit_box_history
DROP CONSTRAINT IF EXISTS deposit_box_history_booking_id_fkey;

ALTER TABLE deposit_box_history
ADD CONSTRAINT deposit_box_history_booking_id_fkey
FOREIGN KEY (booking_id)
REFERENCES bookings(id)
ON DELETE SET NULL;

-- Step 3: Also update the deposit_boxes foreign key to handle deleted bookings gracefully
ALTER TABLE deposit_boxes
DROP CONSTRAINT IF EXISTS deposit_boxes_current_booking_id_fkey;

ALTER TABLE deposit_boxes
ADD CONSTRAINT deposit_boxes_current_booking_id_fkey
FOREIGN KEY (current_booking_id)
REFERENCES bookings(id)
ON DELETE SET NULL;

-- Verify the changes
SELECT
  'Deposit boxes with null booking_id' as check_type,
  COUNT(*) as count
FROM deposit_boxes
WHERE current_booking_id IS NULL

UNION ALL

SELECT
  'Deposit boxes with valid booking_id' as check_type,
  COUNT(*) as count
FROM deposit_boxes db
WHERE current_booking_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = db.current_booking_id);
