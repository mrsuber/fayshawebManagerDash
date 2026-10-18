/**
 * Migration: Unified Wellness Booking System
 *
 * This migration creates a unified system for ALL wellness bookings:
 * - Multi-stage Journeys (Restore, Recharge, Reflect, Explore)
 * - Single Services (Gym, Trainer, Spa, Dining, etc.)
 *
 * Architecture:
 * 1. wellness_activities: All offerings (journeys + services)
 * 2. wellness_bookings: Unified booking table (replaces wellness_journey_bookings)
 * 3. wellness_booking_stages: Journey stages (only for multi-stage activities)
 * 4. wellness_availability: Unified availability tracking
 */

-- ============================================
-- 1. CREATE WELLNESS ACTIVITIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS wellness_activities (
  id SERIAL PRIMARY KEY,

  -- Activity Classification
  type VARCHAR(20) NOT NULL CHECK (type IN ('journey', 'service')),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'restore', 'recharge', 'reflect', 'explore',  -- Journeys
    'fitness', 'spa', 'dining', 'other'           -- Services
  )),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(50),

  -- Timing
  duration INTEGER NOT NULL, -- Total duration in minutes

  -- Capacity & Requirements
  requires_booking BOOLEAN DEFAULT true,
  requires_staff BOOLEAN DEFAULT false,
  requires_access_pin BOOLEAN DEFAULT false, -- Only true for journeys
  max_capacity INTEGER DEFAULT 1,

  -- Journey-specific
  has_stages BOOLEAN DEFAULT false,
  total_stages INTEGER,

  -- Pricing (future use)
  base_price DECIMAL(10, 2) DEFAULT 0,

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  benefits TEXT[],
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_wellness_activities_type ON wellness_activities(type);
CREATE INDEX idx_wellness_activities_category ON wellness_activities(category);
CREATE INDEX idx_wellness_activities_active ON wellness_activities(is_active);

-- ============================================
-- 2. CREATE ACTIVITY STAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS wellness_activity_stages (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES wellness_activities(id) ON DELETE CASCADE,

  stage_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- Minutes

  icon VARCHAR(50),
  activity_type VARCHAR(100), -- 'massage', 'steam', 'cold_plunge', etc.
  location VARCHAR(255),

  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(activity_id, stage_number)
);

CREATE INDEX idx_activity_stages_activity ON wellness_activity_stages(activity_id);

-- ============================================
-- 3. CREATE UNIFIED WELLNESS BOOKINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS wellness_bookings (
  id SERIAL PRIMARY KEY,

  -- Links to apartment booking (REQUIRED)
  apartment_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Activity being booked
  activity_id INTEGER NOT NULL REFERENCES wellness_activities(id) ON DELETE RESTRICT,
  activity_name VARCHAR(255) NOT NULL, -- Snapshot of name at booking time
  activity_type VARCHAR(20) NOT NULL, -- 'journey' or 'service'

  -- Timing
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_duration INTEGER NOT NULL, -- Minutes

  -- Access Control (only for journeys)
  activity_pin VARCHAR(4), -- 4-digit PIN for journey access
  qr_code TEXT, -- Optional QR code
  keys_generated_at TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'in_progress', 'completed', 'cancelled', 'no_show'
  )),

  -- Cancellation
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  -- Guest Info
  special_requests TEXT,

  -- Payment (future use)
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount_paid DECIMAL(10, 2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_wellness_bookings_user ON wellness_bookings(user_id);
CREATE INDEX idx_wellness_bookings_apartment ON wellness_bookings(apartment_booking_id);
CREATE INDEX idx_wellness_bookings_activity ON wellness_bookings(activity_id);
CREATE INDEX idx_wellness_bookings_date ON wellness_bookings(booking_date);
CREATE INDEX idx_wellness_bookings_status ON wellness_bookings(status);

-- Composite index for conflict checking
CREATE INDEX idx_wellness_bookings_user_date_time
  ON wellness_bookings(user_id, booking_date, start_time, end_time);

-- ============================================
-- 4. CREATE BOOKING STAGES TABLE (For Journeys)
-- ============================================

CREATE TABLE IF NOT EXISTS wellness_booking_stages (
  id SERIAL PRIMARY KEY,

  booking_id INTEGER NOT NULL REFERENCES wellness_bookings(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES wellness_activity_stages(id) ON DELETE SET NULL,

  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(255) NOT NULL,

  -- Timing
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'skipped'
  )),

  -- Staff & Guest Feedback
  staff_notes TEXT,
  guest_rating INTEGER CHECK (guest_rating >= 1 AND guest_rating <= 5),
  guest_feedback TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(booking_id, stage_number)
);

CREATE INDEX idx_booking_stages_booking ON wellness_booking_stages(booking_id);
CREATE INDEX idx_booking_stages_status ON wellness_booking_stages(status);

-- ============================================
-- 5. CREATE UNIFIED AVAILABILITY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS wellness_availability (
  id SERIAL PRIMARY KEY,

  activity_id INTEGER NOT NULL REFERENCES wellness_activities(id) ON DELETE CASCADE,

  -- Date & Time
  available_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Capacity
  max_capacity INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,

  -- Staff (if activity requires staff)
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Overrides
  custom_price DECIMAL(10, 2),
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(activity_id, available_date, start_time)
);

CREATE INDEX idx_wellness_availability_activity ON wellness_availability(activity_id);
CREATE INDEX idx_wellness_availability_date ON wellness_availability(available_date);
CREATE INDEX idx_wellness_availability_available ON wellness_availability(is_available);

-- ============================================
-- 6. SEED WELLNESS ACTIVITIES DATA
-- ============================================

-- Insert Multi-Stage Journeys (from old wellness_journeys)
INSERT INTO wellness_activities
  (type, category, name, display_name, description, duration, requires_booking, requires_access_pin, has_stages, total_stages, display_order, is_active, icon)
SELECT
  'journey' as type,
  category,
  name,
  name as display_name,
  description,
  total_duration as duration,
  true as requires_booking,
  true as requires_access_pin,
  true as has_stages,
  (SELECT COUNT(*) FROM wellness_journey_stages wjs WHERE wjs.journey_id = wj.id) as total_stages,
  display_order,
  is_active,
  icon
FROM wellness_journeys wj
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_activities wa
  WHERE wa.name = wj.name AND wa.type = 'journey'
);

-- Insert Journey Stages (from old wellness_journey_stages)
INSERT INTO wellness_activity_stages
  (activity_id, stage_number, name, description, duration, icon, activity_type, location, is_required, display_order)
SELECT
  wa.id as activity_id,
  wjs.stage_number,
  wjs.name,
  wjs.description,
  wjs.duration,
  wjs.icon,
  wjs.activity_type,
  wjs.location,
  wjs.is_required,
  wjs.stage_number as display_order
FROM wellness_journey_stages wjs
JOIN wellness_journeys wj ON wjs.journey_id = wj.id
JOIN wellness_activities wa ON wa.name = wj.name AND wa.type = 'journey'
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_activity_stages was
  WHERE was.activity_id = wa.id AND was.stage_number = wjs.stage_number
);

-- Insert Common Wellness Services
INSERT INTO wellness_activities
  (type, category, name, display_name, description, duration, requires_booking, requires_staff, requires_access_pin, has_stages, max_capacity, display_order, is_active, icon)
VALUES
  -- Fitness Services
  ('service', 'fitness', 'Gym Access', 'Gym Access', 'Access to fully equipped fitness center with cardio and strength training equipment', 60, true, false, false, false, 20, 100, true, '💪'),
  ('service', 'fitness', 'Personal Training', 'Personal Training Session', 'One-on-one training session with certified fitness instructor', 60, true, true, false, false, 1, 101, true, '🏋️'),
  ('service', 'fitness', 'Group Yoga', 'Group Yoga Class', 'Guided yoga session suitable for all levels', 45, true, true, false, false, 10, 102, true, '🧘'),
  ('service', 'fitness', 'Pilates', 'Pilates Class', 'Core strengthening and flexibility training', 45, true, true, false, false, 8, 103, true, '🤸'),

  -- Spa Services
  ('service', 'spa', 'Massage', 'Therapeutic Massage', 'Professional massage therapy for relaxation and muscle relief', 60, true, true, false, false, 1, 200, true, '💆'),
  ('service', 'spa', 'Facial', 'Facial Treatment', 'Rejuvenating facial treatment with premium products', 60, true, true, false, false, 1, 201, true, '✨'),
  ('service', 'spa', 'Sauna', 'Sauna Session', 'Traditional sauna experience for detoxification', 30, true, false, false, false, 6, 202, true, '♨️'),
  ('service', 'spa', 'Steam Room', 'Steam Room Session', 'Eucalyptus-infused steam room experience', 20, true, false, false, false, 8, 203, true, '💨'),

  -- Dining Services
  ('service', 'dining', 'Restaurant', 'Restaurant Reservation', 'Fine dining experience at our signature restaurant', 120, true, false, false, false, 40, 300, true, '🍽️'),
  ('service', 'dining', 'Private Chef', 'Private Chef Experience', 'Personal chef prepares meal in your apartment', 180, true, true, false, false, 1, 301, true, '👨‍🍳')
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. MIGRATE EXISTING BOOKINGS
-- ============================================

-- Migrate wellness journey bookings to new unified table
INSERT INTO wellness_bookings
  (apartment_booking_id, user_id, activity_id, activity_name, activity_type,
   booking_date, start_time, end_time, total_duration, activity_pin, qr_code,
   keys_generated_at, status, cancelled_at, cancellation_reason, special_requests,
   payment_status, created_at, updated_at)
SELECT
  (SELECT b.id FROM bookings b
   WHERE b.user_id = wjb.user_id
     AND b.status IN ('confirmed', 'checked_in')
     AND b.check_in_date <= wjb.booking_date
     AND b.check_out_date > wjb.booking_date
   ORDER BY b.check_in_date DESC
   LIMIT 1
  ) as apartment_booking_id,
  wjb.user_id,
  wa.id as activity_id,
  wjb.journey_name as activity_name,
  'journey' as activity_type,
  wjb.booking_date,
  wjb.start_time,
  wjb.end_time,
  wjb.total_duration,
  wjb.journey_pin as activity_pin,
  wjb.qr_code,
  wjb.keys_generated_at,
  CASE
    WHEN wjb.status = 'confirmed' THEN 'upcoming'
    ELSE wjb.status
  END as status,
  wjb.cancelled_at,
  wjb.cancellation_reason,
  wjb.special_requests,
  wjb.payment_status,
  wjb.created_at,
  wjb.updated_at
FROM wellness_journey_bookings wjb
JOIN wellness_journeys wj ON wjb.journey_id = wj.id
JOIN wellness_activities wa ON wa.name = wj.name AND wa.type = 'journey'
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_bookings wb
  WHERE wb.user_id = wjb.user_id
    AND wb.booking_date = wjb.booking_date
    AND wb.start_time = wjb.start_time
);

-- Migrate journey booking stages
INSERT INTO wellness_booking_stages
  (booking_id, stage_id, stage_number, stage_name, scheduled_start, scheduled_end,
   actual_start, actual_end, status, staff_notes, guest_rating, guest_feedback,
   created_at, updated_at)
SELECT
  wb.id as booking_id,
  was.id as stage_id,
  wjbs.stage_number,
  wjbs.stage_name,
  wjbs.scheduled_start,
  wjbs.scheduled_end,
  wjbs.actual_start,
  wjbs.actual_end,
  wjbs.status,
  wjbs.staff_notes,
  wjbs.guest_rating,
  wjbs.guest_feedback,
  wjbs.created_at,
  wjbs.updated_at
FROM wellness_journey_booking_stages wjbs
JOIN wellness_journey_bookings wjb ON wjbs.booking_id = wjb.id
JOIN wellness_bookings wb ON wb.user_id = wjb.user_id
  AND wb.booking_date = wjb.booking_date
  AND wb.start_time = wjb.start_time
JOIN wellness_activities wa ON wb.activity_id = wa.id
JOIN wellness_activity_stages was ON was.activity_id = wa.id
  AND was.stage_number = wjbs.stage_number
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_booking_stages wbs
  WHERE wbs.booking_id = wb.id AND wbs.stage_number = wjbs.stage_number
);

-- Migrate availability data
INSERT INTO wellness_availability
  (activity_id, available_date, start_time, end_time, max_capacity, current_bookings, is_available)
SELECT
  wa.id as activity_id,
  wja.available_date,
  wja.start_time,
  wja.end_time,
  wja.max_capacity,
  wja.current_bookings,
  wja.is_available
FROM wellness_journey_availability wja
JOIN wellness_journeys wj ON wja.journey_id = wj.id
JOIN wellness_activities wa ON wa.name = wj.name AND wa.type = 'journey'
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_availability wav
  WHERE wav.activity_id = wa.id
    AND wav.available_date = wja.available_date
    AND wav.start_time = wja.start_time
);

-- ============================================
-- 8. CREATE VIEWS FOR BACKWARD COMPATIBILITY
-- ============================================

-- View to maintain compatibility with old wellness_journey_bookings queries
CREATE OR REPLACE VIEW wellness_journey_bookings_view AS
SELECT
  wb.id,
  wb.user_id,
  wb.activity_id as journey_id,
  wb.activity_name as journey_name,
  wb.booking_date,
  wb.start_time,
  wb.end_time,
  wb.total_duration,
  wb.activity_pin as journey_pin,
  wb.qr_code,
  wb.keys_generated_at,
  CASE
    WHEN wb.status = 'upcoming' THEN 'confirmed'
    ELSE wb.status
  END as status,
  wb.cancelled_at,
  wb.cancellation_reason,
  wb.special_requests,
  wb.payment_status,
  wa.category,
  wa.icon as journey_icon,
  wb.created_at,
  wb.updated_at
FROM wellness_bookings wb
JOIN wellness_activities wa ON wb.activity_id = wa.id
WHERE wa.type = 'journey';

-- ============================================
-- 9. ADD CONSTRAINTS
-- ============================================

-- Ensure wellness booking is within apartment stay dates
CREATE OR REPLACE FUNCTION check_wellness_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.apartment_booking_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = NEW.apartment_booking_id
        AND b.check_in_date <= NEW.booking_date
        AND b.check_out_date > NEW.booking_date
        AND b.status IN ('confirmed', 'checked_in')
    ) THEN
      RAISE EXCEPTION 'Wellness booking must be within active apartment stay dates';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_wellness_booking_dates
  BEFORE INSERT OR UPDATE ON wellness_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_wellness_booking_dates();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_wellness_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wellness_activities_timestamp
  BEFORE UPDATE ON wellness_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_wellness_updated_at();

CREATE TRIGGER update_wellness_bookings_timestamp
  BEFORE UPDATE ON wellness_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_wellness_updated_at();

CREATE TRIGGER update_wellness_booking_stages_timestamp
  BEFORE UPDATE ON wellness_booking_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_wellness_updated_at();

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

-- Grant access to application user (adjust username as needed)
-- GRANT ALL PRIVILEGES ON wellness_activities TO your_app_user;
-- GRANT ALL PRIVILEGES ON wellness_bookings TO your_app_user;
-- GRANT ALL PRIVILEGES ON wellness_booking_stages TO your_app_user;
-- GRANT ALL PRIVILEGES ON wellness_availability TO your_app_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Summary of changes:
-- ✅ Created wellness_activities table (unified journeys + services)
-- ✅ Created wellness_activity_stages table (for multi-stage journeys)
-- ✅ Created wellness_bookings table (unified booking system)
-- ✅ Created wellness_booking_stages table (journey progress tracking)
-- ✅ Created wellness_availability table (unified availability)
-- ✅ Migrated existing journey data
-- ✅ Created backward compatibility views
-- ✅ Added validation constraints
-- ✅ Added automatic timestamps

COMMENT ON TABLE wellness_activities IS 'Unified table for all wellness offerings (journeys and services)';
COMMENT ON TABLE wellness_bookings IS 'Unified booking table for all wellness activities';
COMMENT ON TABLE wellness_booking_stages IS 'Tracks progress through multi-stage journey experiences';
COMMENT ON TABLE wellness_availability IS 'Unified availability tracking for all wellness activities';
