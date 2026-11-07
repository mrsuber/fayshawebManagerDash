-- A guest who never arrived: the stay is closed as a no-show (it frees the residence like a cancellation).
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'no_show';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20);   -- guest | staff | system
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS changed_at TIMESTAMP;       -- last change of dates or residence
