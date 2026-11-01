-- Why a confirmation email did not go out (shown to staff so they can resend); cleared once it is sent.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_error TEXT;

-- Deposit boxes: a stay holds its residence's box only while it is the current or next stay (services/stayKeys.js).
-- Earlier code pointed every box at the most recently confirmed booking and copied the same PIN to each guest.
-- Release boxes held by stays that are over, so the next hand-over gives a fresh PIN.
UPDATE deposit_boxes d SET current_booking_id = NULL
  FROM bookings b
 WHERE b.id = d.current_booking_id AND (b.status NOT IN ('confirmed', 'checked_in') OR b.check_out_date < CURRENT_DATE);
