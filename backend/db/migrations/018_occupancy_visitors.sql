-- Occupancy and the visitor policy.
-- A residence can sleep fewer (or more) than its category says: NULL keeps the category's max_guests.
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS max_occupancy INTEGER CHECK (max_occupancy IS NULL OR max_occupancy BETWEEN 1 AND 30);

-- Discreet passes hide the visitor's name from staff lists and alerts (the gate still sees it when checking the pass).
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS discreet BOOLEAN NOT NULL DEFAULT false;
-- Why a pass needs a closer look (e.g. a visitor coming most days), shown to the team.
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS flag VARCHAR(255);

-- People added to a stay (a visitor who will sleep over, family joining later): registered occupants, within capacity.
CREATE TABLE IF NOT EXISTS stay_guests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,          -- the host who asked
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  relation VARCHAR(60),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,                                             -- the night of to_date - 1 is the last one
  note TEXT,
  fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decline_reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (to_date > from_date)
);
CREATE INDEX IF NOT EXISTS idx_stay_guests_booking ON stay_guests(booking_id, status);
