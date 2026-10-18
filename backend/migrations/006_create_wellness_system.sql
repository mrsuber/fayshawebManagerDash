-- Wellness System Migration
-- Creates tables for wellness tracking, activities, bookings, and concierge chat

-- Wellness Metrics Table (user wellness tracking)
CREATE TABLE IF NOT EXISTS wellness_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sleep_score INTEGER DEFAULT 0 CHECK (sleep_score >= 0 AND sleep_score <= 100),
  activity_score INTEGER DEFAULT 0 CHECK (activity_score >= 0 AND activity_score <= 100),
  nutrition_score INTEGER DEFAULT 0 CHECK (nutrition_score >= 0 AND nutrition_score <= 100),
  hydration_score INTEGER DEFAULT 0 CHECK (hydration_score >= 0 AND hydration_score <= 100),
  mood_score INTEGER DEFAULT 0 CHECK (mood_score >= 0 AND mood_score <= 100),
  mood_label VARCHAR(50) DEFAULT 'Neutral',
  overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Wellness Activities Table (catalog of all wellness activities)
CREATE TABLE IF NOT EXISTS wellness_activities (
  id SERIAL PRIMARY KEY,
  mood_category VARCHAR(50) NOT NULL CHECK (mood_category IN ('restore', 'recharge', 'reflect', 'explore')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration VARCHAR(100),
  image_url TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wellness Bookings Table (activity bookings)
CREATE TABLE IF NOT EXISTS wellness_bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES wellness_activities(id) ON DELETE SET NULL,
  activity_name VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME,
  status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Concierge Messages Table (chat history)
CREATE TABLE IF NOT EXISTS concierge_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('user', 'concierge', 'system')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Smart Home Controls Table (digital key & villa controls)
CREATE TABLE IF NOT EXISTS smart_home_controls (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  villa_id INTEGER,
  villa_name VARCHAR(255),
  is_locked BOOLEAN DEFAULT true,
  lights_status VARCHAR(50) DEFAULT 'off',
  climate_temp INTEGER DEFAULT 22,
  curtains_status VARCHAR(50) DEFAULT 'closed',
  last_action_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Wellness Zones Table (estate zones/areas)
CREATE TABLE IF NOT EXISTS wellness_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  description TEXT,
  image_url TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  glyph VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wellness_metrics_user_date ON wellness_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_activities_mood ON wellness_activities(mood_category);
CREATE INDEX IF NOT EXISTS idx_wellness_bookings_user ON wellness_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_bookings_date ON wellness_bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_user ON concierge_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_created ON concierge_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_home_user ON smart_home_controls(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_wellness_metrics_updated_at ON wellness_metrics;
CREATE TRIGGER update_wellness_metrics_updated_at BEFORE UPDATE ON wellness_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_activities_updated_at ON wellness_activities;
CREATE TRIGGER update_wellness_activities_updated_at BEFORE UPDATE ON wellness_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_bookings_updated_at ON wellness_bookings;
CREATE TRIGGER update_wellness_bookings_updated_at BEFORE UPDATE ON wellness_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_concierge_messages_updated_at ON concierge_messages;
CREATE TRIGGER update_concierge_messages_updated_at BEFORE UPDATE ON concierge_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_smart_home_controls_updated_at ON smart_home_controls;
CREATE TRIGGER update_smart_home_controls_updated_at BEFORE UPDATE ON smart_home_controls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellness_zones_updated_at ON wellness_zones;
CREATE TRIGGER update_wellness_zones_updated_at BEFORE UPDATE ON wellness_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON wellness_metrics TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_activities TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_bookings TO divisionaluser;
GRANT ALL PRIVILEGES ON concierge_messages TO divisionaluser;
GRANT ALL PRIVILEGES ON smart_home_controls TO divisionaluser;
GRANT ALL PRIVILEGES ON wellness_zones TO divisionaluser;

GRANT USAGE, SELECT ON SEQUENCE wellness_metrics_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_activities_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_bookings_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE concierge_messages_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE smart_home_controls_id_seq TO divisionaluser;
GRANT USAGE, SELECT ON SEQUENCE wellness_zones_id_seq TO divisionaluser;
