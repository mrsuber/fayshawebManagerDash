-- Operations: guest ratings of the team, lockers and equipment on loan, housekeeping inspections,
-- visitor passes at the gate, and dining pre-orders.

-- Ratings a guest gives after a service (a request, a clean, a meal, a treatment, a ride) or for the stay.
CREATE TABLE IF NOT EXISTS staff_ratings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- the guest
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,              -- the team member, when known
  staff_name VARCHAR(150),
  department VARCHAR(40),
  context VARCHAR(30) NOT NULL,                                          -- request, housekeeping, dining, wellness, transfer, loan, stay
  context_id INTEGER,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'followed_up')),
  follow_up TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_ratings_once ON staff_ratings(user_id, context, context_id) WHERE context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_ratings_staff ON staff_ratings(staff_id, created_at DESC);

-- Things lent to guests: extra lockers, golf sets, balls, bicycles, beach kits… Each item is one physical thing.
CREATE TABLE IF NOT EXISTS loan_items (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,                                      -- L-12, GOLF-03
  name VARCHAR(150) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'locker',                        -- locker, golf, sport, beach, kids, other
  location VARCHAR(150),
  status VARCHAR(12) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_loan', 'maintenance', 'retired')),
  default_hours INTEGER NOT NULL DEFAULT 24,                             -- standard loan length
  deposit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  category VARCHAR(30) NOT NULL,
  item_id INTEGER REFERENCES loan_items(id) ON DELETE SET NULL,          -- assigned by staff (or automatically)
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'ready', 'out', 'returned', 'cancelled', 'declined', 'lost')),
  pin VARCHAR(8),                                                        -- locker code for the guest
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  out_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  condition_note TEXT,
  handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_open ON loans(status, due_at);
-- One live loan per item.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_item_live ON loans(item_id) WHERE status IN ('ready', 'out') AND item_id IS NOT NULL;

-- A supervisor's inspection after a clean: passes (residence ready) or fails (back to cleaning).
CREATE TABLE IF NOT EXISTS housekeeping_inspections (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  cleaned_by VARCHAR(150),
  cleaner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  inspector_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  checklist JSONB NOT NULL DEFAULT '[]',                                 -- [{ item, ok }]
  score SMALLINT CHECK (score BETWEEN 1 AND 5),
  passed BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hk_inspections ON housekeeping_inspections(apartment_id, created_at DESC);
ALTER TABLE residence_controls ADD COLUMN IF NOT EXISTS cleaned_by VARCHAR(150);

-- Visitors a resident invites: a pass with a QR code and directions; the gate checks it in.
CREATE TABLE IF NOT EXISTS visitor_passes (
  id SERIAL PRIMARY KEY,
  token VARCHAR(48) NOT NULL UNIQUE,
  code VARCHAR(8) NOT NULL,                                              -- short code read out at the gate
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- the host
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  visitor_name VARCHAR(150) NOT NULL,
  visitor_phone VARCHAR(50),
  people INTEGER NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 20),
  vehicle VARCHAR(40),
  visit_date DATE NOT NULL,
  arrive_from VARCHAR(5),
  arrive_until VARCHAR(5),
  note TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'arrived', 'left', 'cancelled', 'expired')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_day ON visitor_passes(visit_date, status);
CREATE TABLE IF NOT EXISTS gate_events (
  id SERIAL PRIMARY KEY,
  gate VARCHAR(40) NOT NULL DEFAULT 'main',
  action VARCHAR(20) NOT NULL,                                           -- open, denied
  pass_id INTEGER REFERENCES visitor_passes(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  by_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note VARCHAR(255),
  controller_ok BOOLEAN,                                                 -- did the gate controller confirm
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dining: a table booked with dishes chosen in advance (the restaurant serves tea, cakes and breads by default;
-- full meals are prepared on pre-order).
ALTER TABLE dining_reservations ADD COLUMN IF NOT EXISTS preorder JSONB NOT NULL DEFAULT '[]';   -- [{ id, name, qty, price, note }]
ALTER TABLE dining_reservations ADD COLUMN IF NOT EXISTS preorder_total NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS preorder BOOLEAN NOT NULL DEFAULT false;          -- prepared on pre-order only
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS lead_hours INTEGER NOT NULL DEFAULT 0;            -- notice the kitchen needs
