-- Deposit Box System Migration
-- Handles package delivery tracking with auto-changing PINs

-- Deposit Boxes Table (one per apartment)
CREATE TABLE IF NOT EXISTS deposit_boxes (
  id SERIAL PRIMARY KEY,
  box_number VARCHAR(20) NOT NULL UNIQUE,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  current_booking_id INTEGER,
  current_pin VARCHAR(10),
  status VARCHAR(50) DEFAULT 'empty' CHECK (status IN ('empty', 'package_waiting', 'maintenance')),
  pin_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deposit Box History Table (package delivery tracking)
CREATE TABLE IF NOT EXISTS deposit_box_history (
  id SERIAL PRIMARY KEY,
  deposit_box_id INTEGER REFERENCES deposit_boxes(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  delivery_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivered_by VARCHAR(255),
  tracking_number VARCHAR(255),
  package_description TEXT,
  pin_used_by_delivery VARCHAR(10),
  new_pin_generated VARCHAR(10),
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'collected', 'returned')),
  collected_at TIMESTAMP WITH TIME ZONE,
  collected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposit_boxes_apartment ON deposit_boxes(apartment_id);
CREATE INDEX IF NOT EXISTS idx_deposit_boxes_booking ON deposit_boxes(current_booking_id);
CREATE INDEX IF NOT EXISTS idx_deposit_box_history_box ON deposit_box_history(deposit_box_id);
CREATE INDEX IF NOT EXISTS idx_deposit_box_history_booking ON deposit_box_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_deposit_box_history_user ON deposit_box_history(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_box_history_status ON deposit_box_history(status);
CREATE INDEX IF NOT EXISTS idx_deposit_box_history_delivery_date ON deposit_box_history(delivery_date DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deposit_box_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_deposit_boxes_updated_at ON deposit_boxes;
CREATE TRIGGER update_deposit_boxes_updated_at BEFORE UPDATE ON deposit_boxes
  FOR EACH ROW EXECUTE FUNCTION update_deposit_box_updated_at();

-- Create function to generate unique 4-digit PIN
CREATE OR REPLACE FUNCTION generate_deposit_box_pin()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_pin VARCHAR(10);
  pin_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 4-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Check if PIN is currently in use
    SELECT EXISTS(
      SELECT 1 FROM deposit_boxes
      WHERE current_pin = new_pin
      AND status = 'package_waiting'
    ) INTO pin_exists;

    -- Exit loop if PIN is unique
    EXIT WHEN NOT pin_exists;
  END LOOP;

  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- Comment describing the system
COMMENT ON TABLE deposit_boxes IS 'Digital deposit boxes for package delivery. PIN auto-changes after delivery agent opens box.';
COMMENT ON TABLE deposit_box_history IS 'Tracks all package deliveries and collections. PIN changes prevent delivery agents from retrieving packages.';
