-- =====================================================
-- Migration 020: Manager dashboard (FAY OS) operations schema
-- =====================================================
-- Backs the /manager dashboard (routes/manager/*).
--
-- Safe to run more than once and on any database state:
--   * Everything is CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--   * Nothing is dropped or renamed (production data is preserved).
--   * The guest tables from 019 are created here if 019 never applied
--     (019 fails on its views, which reference users.role), and extended
--     with the columns the dashboard needs if it did.
--
-- Run: node migrations/run.js 020_create_manager_operations.sql
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. Enum types from 019 (created only if missing)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE request_type AS ENUM ('housekeeping', 'maintenance', 'concierge', 'dining', 'transport', 'wellness', 'experience', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE request_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE note_category AS ENUM ('general', 'preference', 'observation', 'incident', 'compliment', 'complaint', 'medical', 'vip', 'alert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE note_visibility AS ENUM ('private', 'staff_only', 'management_only', 'all_staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'booking_created', 'booking_confirmed', 'check_in', 'check_out',
    'wellness_booking', 'dining_reservation', 'experience_booked',
    'service_request', 'message_sent', 'message_received',
    'preference_updated', 'note_added', 'payment_made',
    'feedback_submitted', 'journey_started', 'journey_completed',
    'smart_home_action', 'concierge_interaction', 'staff_interaction',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE dining_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE experience_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dashboard workflow states the 019 enums lack. (New enum values are not used
-- anywhere else in this file, so this is safe inside one transaction.)
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'escalated';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'card_terminal';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'room_transfer';

-- =====================================================
-- 2. Staff roles and profile fields
-- =====================================================
INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
(
  'staff',
  'Staff',
  'Operations staff (housekeeping, maintenance, dining, wellness, transport). Invited from Manager → Settings → Team.',
  '{"operations": {"view": true}}',
  false
)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- =====================================================
-- 3. Guest profile (Guest 360)
-- =====================================================
-- One row per guest user. Holds what the manager edits on the profile;
-- stays, spend and status are derived from bookings.
CREATE TABLE IF NOT EXISTS guest_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vip BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  preferences JSONB NOT NULL DEFAULT '[]',   -- [{ key, icon, color, title, detail }]
  services JSONB NOT NULL DEFAULT '[]',      -- [{ key, icon, color, title, detail, status }]
  insights JSONB NOT NULL DEFAULT '[]',      -- [string]
  purpose VARCHAR(50),
  country VARCHAR(100),
  language VARCHAR(50),
  time_zone VARCHAR(50),
  parking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Folio charges beyond the accommodation itself (dining, spa, laundry…)
CREATE TABLE IF NOT EXISTS folio_charges (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Services',
  amount DECIMAL(10, 2) NOT NULL,
  source_type VARCHAR(50),   -- e.g. 'dining_order', 'experience_booking'
  source_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_folio_charges_guest ON folio_charges(guest_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_booking ON folio_charges(booking_id);

-- Guest itinerary items booked from Guest 360 (generic wellness/dining/experience/transport)
CREATE TABLE IF NOT EXISTS guest_itinerary (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('wellness', 'dining', 'experience', 'transport')),
  title VARCHAR(255) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  guests INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Pending', 'Completed', 'Cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_guest_itinerary_guest ON guest_itinerary(guest_id, starts_at);

-- Timeline (from 019) + category label used by the dashboard
CREATE TABLE IF NOT EXISTS guest_activities (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  related_entity_type VARCHAR(50),
  related_entity_id INTEGER,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_automated BOOLEAN DEFAULT false,
  location VARCHAR(255),
  activity_data JSONB DEFAULT '{}',
  icon VARCHAR(50),
  color VARCHAR(7),
  activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE guest_activities ADD COLUMN IF NOT EXISTS category VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_guest_activities_guest ON guest_activities(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_activities_timestamp ON guest_activities(activity_timestamp DESC);

-- Staff notes (from 019) + free-text author for imported/system notes
CREATE TABLE IF NOT EXISTS guest_notes (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category note_category DEFAULT 'general',
  title VARCHAR(255),
  note TEXT NOT NULL,
  visibility note_visibility DEFAULT 'staff_only',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  is_important BOOLEAN DEFAULT false,
  is_alert BOOLEAN DEFAULT false,
  alert_expires_at TIMESTAMP,
  attachments JSONB DEFAULT '[]',
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
ALTER TABLE guest_notes ADD COLUMN IF NOT EXISTS author_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_guest_notes_guest ON guest_notes(guest_id);

-- =====================================================
-- 4. Communications: the guest app's concierge chat
-- =====================================================
-- The mobile app and n8n already write here; the dashboard reads and replies
-- in the same table so managers see real guest messages.
ALTER TABLE concierge_messages ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'in_app';
ALTER TABLE concierge_messages ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE concierge_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_concierge_messages_user_created ON concierge_messages(user_id, created_at);

-- =====================================================
-- 5. Service requests (from 019) + dashboard fields
-- =====================================================
CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  request_number VARCHAR(50) NOT NULL UNIQUE,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  request_type request_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority request_priority DEFAULT 'normal',
  status request_status DEFAULT 'pending',
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  department VARCHAR(100),
  estimated_completion TIMESTAMP,
  location VARCHAR(255),
  access_required BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  resolution_notes TEXT,
  resolution_attachments JSONB DEFAULT '[]',
  guest_rating INTEGER CHECK (guest_rating >= 1 AND guest_rating <= 5),
  guest_feedback TEXT,
  acknowledged_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_service_requests_guest ON service_requests(guest_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON service_requests(created_at DESC);

-- =====================================================
-- 6. Reservations (bookings) + residences (apartments)
-- =====================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'Direct Website';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE apartment_categories ADD COLUMN IF NOT EXISTS view_description VARCHAR(255);

-- Smart-home state and housekeeping status per residence
CREATE TABLE IF NOT EXISTS residence_controls (
  apartment_id INTEGER PRIMARY KEY REFERENCES apartments(id) ON DELETE CASCADE,
  target_temp INTEGER NOT NULL DEFAULT 22 CHECK (target_temp BETWEEN 16 AND 30),
  scene VARCHAR(20) NOT NULL DEFAULT 'relax',
  devices_off JSONB NOT NULL DEFAULT '{}',
  security JSONB NOT NULL DEFAULT '{"front": "Secured", "garage": "Secured", "privacy": "Off"}',
  housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'Ready'
    CHECK (housekeeping_status IN ('Dirty', 'Cleaning', 'Inspect', 'Ready')),
  housekeeping_note VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservation_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  collection VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_bookings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  dates VARCHAR(100),
  residences VARCHAR(255),
  guests INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Inquiry',
  contact VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_alerts (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  severity VARCHAR(10) NOT NULL DEFAULT 'Medium',
  residence VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. Housekeeping
-- =====================================================
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id SERIAL PRIMARY KEY,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time VARCHAR(5),
  title VARCHAR(255) NOT NULL,
  location VARCHAR(150),
  assignee VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS housekeeping_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  zone VARCHAR(150),
  shift VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS linen_stock (
  id SERIAL PRIMARY KEY,
  item VARCHAR(150) NOT NULL,
  level INTEGER NOT NULL DEFAULT 100 CHECK (level BETWEEN 0 AND 100),
  par INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS housekeeping_guest_notes (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  residence VARCHAR(100),
  guest VARCHAR(150),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. Maintenance
-- =====================================================
CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  number VARCHAR(30) UNIQUE,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(150),
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium',
  technician VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preventive_maintenance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(150),
  duration VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_systems (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  health INTEGER NOT NULL DEFAULT 100 CHECK (health BETWEEN 0 AND 100),
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_alerts (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  severity VARCHAR(10) NOT NULL DEFAULT 'Medium',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  location VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  work_order VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS technicians (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  skill VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. Wellness: staff-scheduled treatments live in the unified wellness_bookings
-- =====================================================
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS room VARCHAR(100);
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS wellness_packages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  date DATE NOT NULL,
  start VARCHAR(5),
  "end" VARCHAR(5),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. Dining
-- =====================================================
CREATE TABLE IF NOT EXISTS dining_reservations (
  id SERIAL PRIMARY KEY,
  reservation_number VARCHAR(50) NOT NULL UNIQUE,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  number_of_guests INTEGER NOT NULL,
  seating_preference VARCHAR(100),
  dietary_requirements TEXT,
  special_occasion VARCHAR(100),
  special_requests TEXT,
  status dining_status DEFAULT 'pending',
  table_number VARCHAR(20),
  server_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP,
  seated_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE dining_reservations ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE dining_reservations ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'Reservation';
CREATE INDEX IF NOT EXISTS idx_dining_reservations_date ON dining_reservations(reservation_date, reservation_time);

CREATE TABLE IF NOT EXISTS dining_orders (
  id SERIAL PRIMARY KEY,
  number VARCHAR(30),
  venue VARCHAR(100),
  items TEXT NOT NULL,
  time VARCHAR(5),
  location VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  venue VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  category VARCHAR(50),
  available BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id VARCHAR(20) PRIMARY KEY,           -- e.g. 'R-01'
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  guest_name VARCHAR(255) NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 11. Transportation
-- =====================================================
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time VARCHAR(5),
  kind VARCHAR(50),
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  from_location VARCHAR(150),
  to_location VARCHAR(150),
  vehicle VARCHAR(100),
  driver VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date);

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chauffeurs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  area VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flights (
  id SERIAL PRIMARY KEY,
  flight VARCHAR(20) NOT NULL,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  direction VARCHAR(10) NOT NULL DEFAULT 'Arrival',
  airport VARCHAR(10),
  time TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. Experiences
-- =====================================================
CREATE TABLE IF NOT EXISTS experiences (
  id SERIAL PRIMARY KEY,
  img VARCHAR(255),
  category VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration VARCHAR(30),
  capacity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experience_bookings (
  id SERIAL PRIMARY KEY,
  booking_number VARCHAR(50) NOT NULL UNIQUE,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  experience_name VARCHAR(255) NOT NULL,
  experience_type VARCHAR(100),
  description TEXT,
  experience_date DATE NOT NULL,
  experience_time TIME NOT NULL,
  duration_minutes INTEGER,
  number_of_participants INTEGER NOT NULL,
  price_per_person DECIMAL(10,2),
  total_price DECIMAL(10,2),
  fitness_level_required VARCHAR(50),
  age_restriction VARCHAR(50),
  special_requirements TEXT,
  status experience_status DEFAULT 'pending',
  guide_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meeting_location VARCHAR(255),
  pickup_required BOOLEAN DEFAULT false,
  pickup_location VARCHAR(255),
  pickup_time TIME,
  confirmed_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE experience_bookings ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE experience_bookings ADD COLUMN IF NOT EXISTS experience_id INTEGER REFERENCES experiences(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_experience_bookings_date ON experience_bookings(experience_date);

-- =====================================================
-- 13. Guest journey automations, AI command, notifications, settings
-- =====================================================
CREATE TABLE IF NOT EXISTS journey_automations (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  detail VARCHAR(255),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_alerts (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  severity VARCHAR(10) NOT NULL DEFAULT 'Medium',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  link VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_priorities (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'Medium',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff (dashboard header) notifications; user_id NULL = all managers
CREATE TABLE IF NOT EXISTS staff_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_created ON staff_notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS staff_notification_reads (
  notification_id INTEGER NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

-- Key/value settings: 'property' and 'preferences'
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'Disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  number VARCHAR(30) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Due',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 14. updated_at triggers
-- =====================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'guest_profiles', 'guest_itinerary', 'guest_notes', 'service_requests',
    'reservation_packages', 'group_bookings', 'device_alerts', 'residence_controls',
    'housekeeping_tasks', 'housekeeping_staff', 'linen_stock', 'housekeeping_guest_notes',
    'work_orders', 'preventive_maintenance', 'maintenance_systems', 'maintenance_alerts', 'technicians',
    'wellness_packages', 'dining_reservations', 'dining_orders', 'menu_items', 'dining_tables',
    'transfers', 'fleet_vehicles', 'chauffeurs', 'flights', 'experiences', 'experience_bookings',
    'journey_automations', 'ai_alerts', 'ai_priorities', 'app_settings', 'integrations', 'invoices'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- =====================================================
-- 15. Defaults (only inserted when missing)
-- =====================================================
INSERT INTO app_settings (key, value) VALUES
('property', '{
  "name": "Faysha Wellness Residence",
  "brand": "FAY OS",
  "timeZone": "West Africa Time (GMT+1)",
  "currency": "XAF",
  "checkInTime": "3:00 PM",
  "checkOutTime": "11:00 AM",
  "phone": "",
  "email": "concierge@fayshaa.com"
}'),
('preferences', '{
  "ai": {"autoReply": true, "recommendations": true, "autoAssign": false, "smartHome": true, "approvalOver500": true},
  "notifications": {
    "vipArrival": {"push": true, "email": true, "sms": false},
    "escalation": {"push": true, "email": true, "sms": false},
    "newRequest": {"push": true, "email": false, "sms": false},
    "payment": {"push": false, "email": true, "sms": false},
    "deviceAlert": {"push": true, "email": false, "sms": false}
  },
  "billing": {"plan": "FAY OS", "price": 0, "card": "", "nextInvoice": null}
}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO integrations (icon, name, detail, status)
SELECT * FROM (VALUES
  ('chat', 'WhatsApp Business', 'Guest messaging', 'Disconnected'),
  ('smart_toy', 'n8n AI Concierge', 'Automated replies in the guest app chat', 'Connected'),
  ('home_iot_device', 'Smart Home Hub', 'Residence devices', 'Disconnected')
) AS v(icon, name, detail, status)
WHERE NOT EXISTS (SELECT 1 FROM integrations);

INSERT INTO residence_controls (apartment_id)
SELECT id FROM apartments
ON CONFLICT (apartment_id) DO NOTHING;

-- =====================================================
-- 16. booking_details_view (used by /api/bookings and /admin → Bookings)
-- =====================================================
-- 004 defines it with b.total_guests, a column bookings never had, so a fresh database ends up
-- without the view. Create it only when it is missing; an existing (hand-fixed) view is left alone.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'booking_details_view') THEN
    CREATE VIEW booking_details_view AS
    SELECT
      b.id, b.user_id, b.apartment_id, b.booking_number, b.guest_name, b.guest_email, b.guest_phone,
      b.check_in_date, b.check_out_date, b.number_of_guests, b.number_of_nights, b.total_price, b.final_price,
      b.status, b.access_code, b.created_at,
      a.unit_number, a.building, c.display_name AS apartment_name,
      u.full_name AS user_full_name, u.email AS user_email,
      p.status AS payment_status, p.payment_method, p.paid_at,
      b.number_of_guests AS total_guests
    FROM bookings b
    JOIN apartments a ON b.apartment_id = a.id
    JOIN apartment_categories c ON a.category_id = c.id
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN payments p ON p.booking_id = b.id;
  END IF;
END $$;
