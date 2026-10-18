-- Wellness Journeys System Migration
-- Creates tables for multi-stage wellness journey experiences and bookings
-- Created: 2026-09-18

-- ============================================
-- WELLNESS JOURNEYS TABLE
-- Stores journey templates (RESTORE, RECHARGE, REFLECT, EXPLORE)
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_journeys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('restore', 'recharge', 'reflect', 'explore')),
  tagline VARCHAR(500),
  description TEXT,
  total_duration INTEGER NOT NULL, -- in minutes
  image_url TEXT,
  icon VARCHAR(50),
  benefits JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- JOURNEY STAGES TABLE
-- Individual stages/activities that make up a journey
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_journey_stages (
  id SERIAL PRIMARY KEY,
  journey_id INTEGER NOT NULL REFERENCES wellness_journeys(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- in minutes
  icon VARCHAR(50),
  activity_type VARCHAR(100), -- massage, steam, meditation, etc.
  instructions TEXT,
  location VARCHAR(255),
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(journey_id, stage_number)
);

-- ============================================
-- JOURNEY BOOKINGS TABLE
-- User bookings for complete journeys
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_journey_bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id INTEGER NOT NULL REFERENCES wellness_journeys(id) ON DELETE RESTRICT,
  journey_name VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_duration INTEGER NOT NULL, -- in minutes
  status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled', 'no_show')),
  current_stage INTEGER DEFAULT 1,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
  payment_amount DECIMAL(10, 2),
  special_requests TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- JOURNEY BOOKING STAGES TABLE
-- Track completion of individual stages within a booking
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_journey_booking_stages (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES wellness_journey_bookings(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES wellness_journey_stages(id) ON DELETE RESTRICT,
  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  scheduled_start TIME,
  scheduled_end TIME,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  staff_notes TEXT,
  guest_rating INTEGER CHECK (guest_rating >= 1 AND guest_rating <= 5),
  guest_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, stage_number)
);

-- ============================================
-- JOURNEY AVAILABILITY TABLE
-- Track available time slots for journey bookings
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_journey_availability (
  id SERIAL PRIMARY KEY,
  journey_id INTEGER NOT NULL REFERENCES wellness_journeys(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(journey_id, available_date, start_time)
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_journey_category ON wellness_journeys(category);
CREATE INDEX IF NOT EXISTS idx_journey_active ON wellness_journeys(is_active);
CREATE INDEX IF NOT EXISTS idx_journey_slug ON wellness_journeys(slug);

CREATE INDEX IF NOT EXISTS idx_journey_stages_journey ON wellness_journey_stages(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_stages_number ON wellness_journey_stages(journey_id, stage_number);

CREATE INDEX IF NOT EXISTS idx_journey_bookings_user ON wellness_journey_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_bookings_date ON wellness_journey_bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_journey_bookings_status ON wellness_journey_bookings(status);
CREATE INDEX IF NOT EXISTS idx_journey_bookings_journey ON wellness_journey_bookings(journey_id);

CREATE INDEX IF NOT EXISTS idx_booking_stages_booking ON wellness_journey_booking_stages(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_stages_status ON wellness_journey_booking_stages(status);

CREATE INDEX IF NOT EXISTS idx_journey_availability_date ON wellness_journey_availability(journey_id, available_date);
CREATE INDEX IF NOT EXISTS idx_journey_availability_available ON wellness_journey_availability(is_available);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_wellness_journeys_updated_at ON wellness_journeys;
CREATE TRIGGER update_wellness_journeys_updated_at BEFORE UPDATE ON wellness_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_journey_stages_updated_at ON wellness_journey_stages;
CREATE TRIGGER update_wellness_journey_stages_updated_at BEFORE UPDATE ON wellness_journey_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_journey_bookings_updated_at ON wellness_journey_bookings;
CREATE TRIGGER update_wellness_journey_bookings_updated_at BEFORE UPDATE ON wellness_journey_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_journey_booking_stages_updated_at ON wellness_journey_booking_stages;
CREATE TRIGGER update_wellness_journey_booking_stages_updated_at BEFORE UPDATE ON wellness_journey_booking_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_journey_availability_updated_at ON wellness_journey_availability;
CREATE TRIGGER update_wellness_journey_availability_updated_at BEFORE UPDATE ON wellness_journey_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA - RESTORE Journey
-- ============================================
INSERT INTO wellness_journeys (name, slug, category, tagline, description, total_duration, icon, benefits) VALUES
('RESTORE', 'restore', 'restore', 'Slow down. Ease your body. Recover fully.', 'A complete restoration experience in three carefully sequenced stages. Each phase builds upon the last, guiding your body through release, purification, and renewal.', 90, '🌿', '[
  "Deep muscle relaxation",
  "Toxin elimination",
  "Improved circulation",
  "Mental clarity",
  "Stress reduction"
]'::jsonb),
('RECHARGE', 'recharge', 'recharge', 'Energize. Revitalize. Feel renewed.', 'An invigorating journey designed to boost your energy levels and awaken your senses through carefully curated therapeutic experiences.', 75, '⚡', '[
  "Increased energy",
  "Enhanced focus",
  "Physical vitality",
  "Mental alertness",
  "Mood elevation"
]'::jsonb),
('REFLECT', 'reflect', 'reflect', 'Find peace. Center yourself. Inner balance.', 'A mindful journey focused on meditation, breathwork, and gentle movement to help you reconnect with your inner self.', 60, '🧘', '[
  "Inner peace",
  "Mental clarity",
  "Emotional balance",
  "Stress relief",
  "Mindfulness"
]'::jsonb),
('EXPLORE', 'explore', 'explore', 'Discover. Experience. Transform.', 'An adventurous journey combining outdoor activities and wellness practices to explore new dimensions of physical and mental well-being.', 120, '🌍', '[
  "Adventure",
  "Physical challenge",
  "New experiences",
  "Connection with nature",
  "Personal growth"
]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED DATA - RESTORE Journey Stages
-- ============================================
INSERT INTO wellness_journey_stages (journey_id, stage_number, name, description, duration, icon, activity_type, instructions) VALUES
((SELECT id FROM wellness_journeys WHERE slug = 'restore'), 1, 'Massage Therapy', 'Deep tissue massage to release muscle tension and promote relaxation', 60, '✋', 'massage', 'Our expert therapists will work on your pressure points and muscle groups to release built-up tension.'),
((SELECT id FROM wellness_journeys WHERE slug = 'restore'), 2, 'Steam Room', 'Detoxifying steam session to cleanse and purify', 20, '♨️', 'steam', 'Relax in our eucalyptus-infused steam room to open pores and eliminate toxins.'),
((SELECT id FROM wellness_journeys WHERE slug = 'restore'), 3, 'Cool Down & Tea', 'Gentle cooldown with herbal tea service', 10, '🍵', 'relaxation', 'Enjoy our signature wellness tea blend while your body adjusts to a relaxed state.')
ON CONFLICT (journey_id, stage_number) DO NOTHING;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL PRIVILEGES ON wellness_journeys TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_journey_stages TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_journey_bookings TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_journey_booking_stages TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_journey_availability TO divisionaluser;

GRANT USAGE, SELECT ON SEQUENCE wellness_journeys_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_journey_stages_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_journey_bookings_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_journey_booking_stages_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_journey_availability_id_seq TO divisionaluser;
