-- =====================================================================================================
-- Faysha platform — the complete database schema.
--
-- Builds an empty PostgreSQL database (13+) into everything the API uses: the website and bookings,
-- the guest app, FAY OS (/manager) and Faysha HQ (/admin). It replaces the old numbered migrations.
--
--   node db/setup.js            create the schema if the database is empty, then load the starter data
--   node db/setup.js --reset    drop everything and start again (asks for confirmation; never in production)
--
-- Conventions: every table has an integer id (SERIAL) unless a natural key is clearer; timestamps are
-- TIMESTAMP (property time) unless they are instants shown across time zones (TIMESTAMPTZ); a column
-- named *_by or *_id that points at users is SET NULL on delete for records that must outlive the
-- person (bookings, payments, audit), and CASCADE for data that belongs to them (tokens, chat, notes).
-- =====================================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- double-booking exclusion constraint

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------------------------------
CREATE TYPE user_status       AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE apartment_status  AS ENUM ('available', 'occupied', 'maintenance', 'unavailable');
CREATE TYPE booking_status    AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE payment_status    AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method    AS ENUM ('stripe', 'cash', 'bank_transfer', 'mobile_money', 'card_terminal', 'room_transfer');
CREATE TYPE media_type        AS ENUM ('image', 'video', 'panorama_360');
CREATE TYPE request_type      AS ENUM ('housekeeping', 'maintenance', 'concierge', 'dining', 'transport', 'wellness', 'experience', 'other');
CREATE TYPE request_priority  AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE request_status    AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled', 'scheduled', 'escalated', 'on_hold');
CREATE TYPE note_category     AS ENUM ('general', 'preference', 'observation', 'incident', 'compliment', 'complaint', 'medical', 'vip', 'alert');
CREATE TYPE note_visibility   AS ENUM ('private', 'staff_only', 'management_only', 'all_staff');
CREATE TYPE activity_type     AS ENUM (
  'booking_created', 'booking_confirmed', 'check_in', 'check_out', 'wellness_booking', 'dining_reservation',
  'experience_booked', 'service_request', 'message_sent', 'message_received', 'preference_updated', 'note_added',
  'payment_made', 'feedback_submitted', 'journey_started', 'journey_completed', 'smart_home_action',
  'concierge_interaction', 'staff_interaction', 'custom'
);
CREATE TYPE dining_status     AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE experience_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- =====================================================================================================
-- 1. Properties, roles and users
-- =====================================================================================================
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Cameroon',
  address TEXT,
  timezone VARCHAR(60) DEFAULT 'Africa/Douala',
  currency VARCHAR(3) DEFAULT 'XAF',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'opening', 'inactive')),
  opened_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- permissions: { area: { view, manage, approve, ... } } — see middleware/hq.js for the HQ areas.
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status user_status DEFAULT 'pending_verification',
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,  -- staff home property (NULL = all)
  job_title VARCHAR(100),
  department VARCHAR(100),

  -- profile (guests)
  phone VARCHAR(50),
  date_of_birth DATE,
  nationality VARCHAR(100),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  dietary_preferences TEXT,
  allergies TEXT,
  profile_image_url VARCHAR(500),

  -- passwords and verification
  is_password_temporary BOOLEAN DEFAULT false,
  must_change_password BOOLEAN DEFAULT false,
  password_changed_at TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP,

  -- sign-in
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_verify_token ON users(email_verification_token);

CREATE TABLE login_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  login_successful BOOLEAN NOT NULL,
  failure_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);

-- Push tokens: Firebase (web dashboards) and Expo (guest app).
CREATE TABLE fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) DEFAULT 'web' CHECK (platform IN ('web', 'ios', 'android', 'expo')),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id, is_active);

-- Website copy per page, language and section (HQ → Website content).
CREATE TABLE page_content (
  id SERIAL PRIMARY KEY,
  page_id VARCHAR(50) NOT NULL,
  language VARCHAR(10) NOT NULL,
  section VARCHAR(100) NOT NULL,
  content_key VARCHAR(100),
  content_value TEXT,
  content_json JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (page_id, language, section, content_key)
);
CREATE INDEX idx_page_content_page_lang ON page_content(page_id, language);

-- =====================================================================================================
-- 2. Residences, bookings and payments
-- =====================================================================================================
CREATE TABLE apartment_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  view_description VARCHAR(255),
  base_price DECIMAL(10, 2) NOT NULL,          -- per night, XAF
  max_guests INTEGER NOT NULL DEFAULT 2,
  size_sqm DECIMAL(8, 2),
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]',
  amenities JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE apartments (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE RESTRICT,
  category_id INTEGER NOT NULL REFERENCES apartment_categories(id) ON DELETE RESTRICT,
  unit_number VARCHAR(50) NOT NULL UNIQUE,
  floor INTEGER,
  building VARCHAR(100),
  status apartment_status DEFAULT 'available',
  custom_price DECIMAL(10, 2),                 -- overrides the category price when set
  notes TEXT,
  special_features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_apartments_category ON apartments(category_id);
CREATE INDEX idx_apartments_property ON apartments(property_id);

-- New residences belong to the first property unless another is chosen.
CREATE OR REPLACE FUNCTION apartments_default_property()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    NEW.property_id := (SELECT id FROM properties ORDER BY id LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER apartments_default_property BEFORE INSERT ON apartments
  FOR EACH ROW EXECUTE FUNCTION apartments_default_property();

CREATE TABLE apartment_media (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES apartment_categories(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title VARCHAR(255),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT media_belongs_to_either CHECK ((apartment_id IS NULL) <> (category_id IS NULL))
);
CREATE INDEX idx_apartment_media_apartment ON apartment_media(apartment_id);
CREATE INDEX idx_apartment_media_category ON apartment_media(category_id);

CREATE TABLE reservation_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  collection VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  booking_number VARCHAR(50) NOT NULL UNIQUE,        -- FAY-YYYYMMDD-NNN
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE RESTRICT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50) NOT NULL,
  guest_id_number VARCHAR(100),

  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  number_of_nights INTEGER NOT NULL,

  price_per_night DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,

  status booking_status DEFAULT 'pending',
  source VARCHAR(50) DEFAULT 'Direct Website',
  package_id INTEGER REFERENCES reservation_packages(id) ON DELETE SET NULL,
  special_requests TEXT,
  notes TEXT,

  -- terms of stay accepted at booking time
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMP,

  -- digital key (released when the booking is confirmed)
  access_code VARCHAR(20),
  access_code_sent_at TIMESTAMP,
  gate_qr_code VARCHAR(255),
  door_pin VARCHAR(4),
  deposit_box_number VARCHAR(20),
  deposit_box_pin VARCHAR(4),
  keys_generated_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,
  temporary_password VARCHAR(255),   -- a new guest account's first password, cleared once emailed

  confirmed_at TIMESTAMP,
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT bookings_dates CHECK (check_out_date > check_in_date),
  -- No two live bookings may overlap on the same residence.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    apartment_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'checked_in'))
);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_bookings_email ON bookings(guest_email);
CREATE INDEX idx_bookings_gate_qr ON bookings(gate_qr_code);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XAF',
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  transaction_reference VARCHAR(255),
  payment_metadata JSONB DEFAULT '{}',
  error_message TEXT,
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_intent ON payments(stripe_payment_intent_id);

CREATE TABLE availability_overrides (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL,   -- false blocks the dates
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_availability_overrides ON availability_overrides(apartment_id, start_date, end_date);

-- One deposit box per residence; the PIN changes after every delivery so couriers cannot reopen it.
CREATE TABLE deposit_boxes (
  id SERIAL PRIMARY KEY,
  box_number VARCHAR(20) NOT NULL UNIQUE,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  current_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  current_pin VARCHAR(10),
  status VARCHAR(50) DEFAULT 'empty' CHECK (status IN ('empty', 'package_waiting', 'maintenance')),
  pin_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_deposit_boxes_apartment ON deposit_boxes(apartment_id);

CREATE TABLE deposit_box_history (
  id SERIAL PRIMARY KEY,
  deposit_box_id INTEGER REFERENCES deposit_boxes(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  delivery_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  delivered_by VARCHAR(255),
  tracking_number VARCHAR(255),
  package_description TEXT,
  pin_used_by_delivery VARCHAR(10),
  new_pin_generated VARCHAR(10),
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'collected', 'returned')),
  collected_at TIMESTAMPTZ,
  collected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_deposit_box_history_box ON deposit_box_history(deposit_box_id);
CREATE INDEX idx_deposit_box_history_booking ON deposit_box_history(booking_id);

CREATE OR REPLACE FUNCTION generate_deposit_box_pin()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_pin VARCHAR(10);
BEGIN
  LOOP
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM deposit_boxes WHERE current_pin = new_pin AND status = 'package_waiting');
  END LOOP;
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- Bookings with their residence, guest account and latest payment (website account pages, HQ bookings).
CREATE VIEW booking_details_view AS
SELECT
  b.id, b.user_id, b.apartment_id, b.booking_number, b.guest_name, b.guest_email, b.guest_phone,
  b.check_in_date, b.check_out_date, b.number_of_guests, b.number_of_guests AS total_guests, b.number_of_nights,
  b.total_price, b.final_price, b.status, b.access_code, b.created_at,
  a.unit_number, a.building, c.display_name AS apartment_name,
  u.full_name AS user_full_name, u.email AS user_email,
  p.status AS payment_status, p.payment_method, p.paid_at
FROM bookings b
JOIN apartments a ON b.apartment_id = a.id
JOIN apartment_categories c ON a.category_id = c.id
LEFT JOIN users u ON b.user_id = u.id
LEFT JOIN LATERAL (
  SELECT status, payment_method, paid_at FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1
) p ON true;

CREATE VIEW available_apartments_view AS
SELECT
  a.id, a.unit_number, a.floor, a.building, a.status, a.custom_price,
  c.id AS category_id, c.name AS category_name, c.display_name AS category_display_name,
  c.description AS category_description, c.base_price, COALESCE(a.custom_price, c.base_price) AS effective_price,
  c.max_guests, c.size_sqm, c.bedrooms, c.bathrooms, c.features, c.amenities,
  (SELECT file_url FROM apartment_media WHERE apartment_id = a.id AND is_primary = true LIMIT 1) AS primary_image,
  (SELECT COUNT(*) FROM apartment_media WHERE apartment_id = a.id) AS media_count
FROM apartments a
JOIN apartment_categories c ON a.category_id = c.id
WHERE a.is_active = true AND c.is_active = true;

-- =====================================================================================================
-- 3. Guest feedback
-- =====================================================================================================
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  feedback_type VARCHAR(50) DEFAULT 'general',     -- testimonial, general, suggestion, complaint
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  testimonial_text TEXT,
  role VARCHAR(255),
  allow_public_display BOOLEAN DEFAULT false,
  what_went_well TEXT,
  areas_for_improvement TEXT,
  additional_comments TEXT,
  status VARCHAR(20) DEFAULT 'pending',            -- pending, reviewed, approved, rejected
  is_featured BOOLEAN DEFAULT false,
  admin_notes TEXT,
  image_url VARCHAR(500),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_feedback_status ON feedback(status, created_at DESC);

-- =====================================================================================================
-- 4. Wellness: one catalogue of journeys (multi-stage) and services, one bookings table
-- =====================================================================================================
CREATE TABLE wellness_activities (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'service' CHECK (type IN ('journey', 'service')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('restore', 'recharge', 'reflect', 'explore', 'fitness', 'spa', 'dining', 'other')),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(50),
  image_url TEXT,
  duration INTEGER NOT NULL DEFAULT 60,           -- minutes
  requires_booking BOOLEAN DEFAULT true,
  requires_staff BOOLEAN DEFAULT false,
  requires_access_pin BOOLEAN DEFAULT false,
  max_capacity INTEGER DEFAULT 1,                 -- guests per time slot
  has_stages BOOLEAN DEFAULT false,
  total_stages INTEGER,
  base_price DECIMAL(10, 2) DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  benefits TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name, category)
);
CREATE INDEX idx_wellness_activities_type ON wellness_activities(type, category);

CREATE TABLE wellness_activity_stages (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES wellness_activities(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  icon VARCHAR(50),
  activity_type VARCHAR(100),
  location VARCHAR(255),
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (activity_id, stage_number)
);

CREATE TABLE wellness_bookings (
  id SERIAL PRIMARY KEY,
  apartment_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES wellness_activities(id) ON DELETE RESTRICT,
  activity_name VARCHAR(255) NOT NULL,             -- name at booking time
  activity_type VARCHAR(20) NOT NULL DEFAULT 'service',
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_duration INTEGER NOT NULL,
  room VARCHAR(100),
  activity_pin VARCHAR(4),
  qr_code TEXT,
  keys_generated_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled', 'no_show')),
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  special_requests TEXT,
  notes TEXT,
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_wellness_bookings_user ON wellness_bookings(user_id, booking_date, start_time);
CREATE INDEX idx_wellness_bookings_activity ON wellness_bookings(activity_id, booking_date);
CREATE INDEX idx_wellness_bookings_stay ON wellness_bookings(apartment_booking_id);

CREATE TABLE wellness_booking_stages (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES wellness_bookings(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES wellness_activity_stages(id) ON DELETE SET NULL,
  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  staff_notes TEXT,
  guest_rating INTEGER CHECK (guest_rating BETWEEN 1 AND 5),
  guest_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (booking_id, stage_number)
);

-- Time slots staff open for an activity (HQ → Wellness → Availability). With none set for a day, the
-- app offers the standard slots.
CREATE TABLE wellness_availability (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES wellness_activities(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 1 CHECK (max_capacity > 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  custom_price DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (activity_id, available_date, start_time),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_wellness_availability_date ON wellness_availability(available_date);

CREATE TABLE wellness_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sleep_score INTEGER DEFAULT 0 CHECK (sleep_score BETWEEN 0 AND 100),
  activity_score INTEGER DEFAULT 0 CHECK (activity_score BETWEEN 0 AND 100),
  nutrition_score INTEGER DEFAULT 0 CHECK (nutrition_score BETWEEN 0 AND 100),
  hydration_score INTEGER DEFAULT 0 CHECK (hydration_score BETWEEN 0 AND 100),
  mood_score INTEGER DEFAULT 0 CHECK (mood_score BETWEEN 0 AND 100),
  mood_label VARCHAR(50) DEFAULT 'Neutral',
  overall_score INTEGER DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, date)
);

CREATE TABLE wellness_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  description TEXT,
  image_url TEXT,
  features JSONB DEFAULT '[]',
  glyph VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Staff-scheduled wellness packages (FAY OS → Wellness)
CREATE TABLE wellness_packages (
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

-- Guest ↔ concierge chat (guest app, n8n AI concierge, FAY OS communications, HQ concierge)
CREATE TABLE concierge_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('user', 'concierge', 'system')),
  channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_concierge_messages_user ON concierge_messages(user_id, created_at);

CREATE TABLE smart_home_controls (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  villa_id INTEGER,
  villa_name VARCHAR(255),
  is_locked BOOLEAN DEFAULT true,
  lights_status VARCHAR(50) DEFAULT 'off',
  climate_temp INTEGER DEFAULT 22,
  curtains_status VARCHAR(50) DEFAULT 'closed',
  last_action_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================================
-- 5. HR
-- =====================================================================================================
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  requires_keycard BOOLEAN DEFAULT false,
  requires_clock_in BOOLEAN DEFAULT true,
  can_work_remotely BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  employee_number VARCHAR(20) NOT NULL UNIQUE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES employee_categories(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  date_of_birth DATE,
  gender VARCHAR(20),
  address TEXT,
  job_title VARCHAR(100) NOT NULL,
  employment_type VARCHAR(50) NOT NULL,           -- full-time, part-time, contract, intern
  hire_date DATE NOT NULL,
  termination_date DATE,
  status VARCHAR(50) DEFAULT 'active',            -- active, on_leave, suspended, terminated
  requires_keycard BOOLEAN DEFAULT false,
  keycard_number VARCHAR(50) UNIQUE,
  can_work_remotely BOOLEAN DEFAULT false,
  default_shift VARCHAR(50),
  salary_amount DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'XAF',
  salary_period VARCHAR(20) DEFAULT 'monthly',
  reports_to INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  profile_picture VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_user ON employees(user_id);

CREATE TABLE job_postings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES employee_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  responsibilities TEXT,
  requirements TEXT,
  qualifications TEXT,
  employment_type VARCHAR(50) NOT NULL,
  location VARCHAR(100),
  salary_range_min DECIMAL(12, 2),
  salary_range_max DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'XAF',
  posted_date DATE DEFAULT CURRENT_DATE,
  closing_date DATE,
  status VARCHAR(50) DEFAULT 'open',              -- open, closed, filled, cancelled
  number_of_positions INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_applications (
  id SERIAL PRIMARY KEY,
  job_posting_id INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  cv_file_path VARCHAR(255) NOT NULL,
  cover_letter_file_path VARCHAR(255),
  additional_documents TEXT,
  cover_letter_text TEXT,
  expected_salary DECIMAL(12, 2),
  available_start_date DATE,
  status VARCHAR(50) DEFAULT 'pending',           -- pending, reviewed, shortlisted, interviewed, rejected, hired
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_job_applications_job ON job_applications(job_posting_id, status);

CREATE TABLE employee_attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMP NOT NULL,
  clock_out_time TIMESTAMP,
  clock_in_method VARCHAR(50) NOT NULL,           -- keycard, manual, mobile, biometric
  clock_out_method VARCHAR(50),
  clock_in_location VARCHAR(100),
  clock_out_location VARCHAR(100),
  total_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'present',           -- present, late, half_day, absent
  notes TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_attendance_employee ON employee_attendance(employee_id, clock_in_time DESC);

CREATE TABLE leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  days_per_year INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT true,
  is_paid BOOLEAN DEFAULT true,
  max_consecutive_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_leave_balance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL,
  used_days DECIMAL(5, 2) DEFAULT 0,
  remaining_days DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days DECIMAL(5, 2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',           -- pending, approved, rejected, cancelled
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

CREATE TABLE employee_notifications (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================================
-- 6. FAY OS operations (/manager)
-- =====================================================================================================
-- Guest 360: what the manager edits on a guest's profile; stays and spend are derived from bookings.
CREATE TABLE guest_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vip BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  preferences JSONB NOT NULL DEFAULT '[]',
  services JSONB NOT NULL DEFAULT '[]',
  insights JSONB NOT NULL DEFAULT '[]',
  purpose VARCHAR(50),
  country VARCHAR(100),
  language VARCHAR(50),
  time_zone VARCHAR(50),
  parking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Charges beyond the accommodation (dining, spa, laundry…)
CREATE TABLE folio_charges (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Services',
  amount DECIMAL(10, 2) NOT NULL,
  source_type VARCHAR(50),
  source_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_folio_charges_guest ON folio_charges(guest_id);
CREATE INDEX idx_folio_charges_booking ON folio_charges(booking_id);

CREATE TABLE guest_itinerary (
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
CREATE INDEX idx_guest_itinerary_guest ON guest_itinerary(guest_id, starts_at);

CREATE TABLE guest_activities (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  category VARCHAR(50),
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
CREATE INDEX idx_guest_activities_guest ON guest_activities(guest_id, activity_timestamp DESC);

CREATE TABLE guest_notes (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category note_category DEFAULT 'general',
  title VARCHAR(255),
  note TEXT NOT NULL,
  visibility note_visibility DEFAULT 'staff_only',
  author_name VARCHAR(255),
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
CREATE INDEX idx_guest_notes_guest ON guest_notes(guest_id);

CREATE TABLE service_requests (
  id SERIAL PRIMARY KEY,
  request_number VARCHAR(50) NOT NULL UNIQUE,     -- SRQ-YYYYMMDD-NNN
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
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
  guest_rating INTEGER CHECK (guest_rating BETWEEN 1 AND 5),
  guest_feedback TEXT,
  acknowledged_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_service_requests_status ON service_requests(status, created_at DESC);
CREATE INDEX idx_service_requests_guest ON service_requests(guest_id);

-- Smart-home state and housekeeping status per residence
CREATE TABLE residence_controls (
  apartment_id INTEGER PRIMARY KEY REFERENCES apartments(id) ON DELETE CASCADE,
  target_temp INTEGER NOT NULL DEFAULT 22 CHECK (target_temp BETWEEN 16 AND 30),
  scene VARCHAR(20) NOT NULL DEFAULT 'relax',
  devices_off JSONB NOT NULL DEFAULT '{}',
  security JSONB NOT NULL DEFAULT '{"front": "Secured", "garage": "Secured", "privacy": "Off"}',
  housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'Ready' CHECK (housekeeping_status IN ('Dirty', 'Cleaning', 'Inspect', 'Ready')),
  housekeeping_note VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Every residence gets its controls row as soon as it exists.
CREATE OR REPLACE FUNCTION apartments_add_controls()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO residence_controls (apartment_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER apartments_add_controls AFTER INSERT ON apartments
  FOR EACH ROW EXECUTE FUNCTION apartments_add_controls();

-- …and its deposit box (box number DB-<unit>, first PIN random).
CREATE OR REPLACE FUNCTION apartments_add_deposit_box()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deposit_boxes (box_number, apartment_id, current_pin)
  VALUES (LEFT('DB-' || NEW.unit_number, 20), NEW.id, generate_deposit_box_pin())
  ON CONFLICT (box_number) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER apartments_add_deposit_box AFTER INSERT ON apartments
  FOR EACH ROW EXECUTE FUNCTION apartments_add_deposit_box();

CREATE TABLE group_bookings (
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

CREATE TABLE device_alerts (
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

-- Housekeeping
CREATE TABLE housekeeping_tasks (
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
CREATE TABLE housekeeping_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  zone VARCHAR(150),
  shift VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE linen_stock (
  id SERIAL PRIMARY KEY,
  item VARCHAR(150) NOT NULL,
  level INTEGER NOT NULL DEFAULT 100 CHECK (level BETWEEN 0 AND 100),
  par INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE housekeeping_guest_notes (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  residence VARCHAR(100),
  guest VARCHAR(150),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance
CREATE TABLE work_orders (
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
CREATE TABLE preventive_maintenance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(150),
  duration VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE maintenance_systems (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  health INTEGER NOT NULL DEFAULT 100 CHECK (health BETWEEN 0 AND 100),
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE maintenance_alerts (
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
CREATE TABLE technicians (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  skill VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dining
CREATE TABLE dining_reservations (
  id SERIAL PRIMARY KEY,
  reservation_number VARCHAR(50) NOT NULL UNIQUE,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  number_of_guests INTEGER NOT NULL,
  seating_preference VARCHAR(100),
  dietary_requirements TEXT,
  special_occasion VARCHAR(100),
  special_requests TEXT,
  source VARCHAR(20) DEFAULT 'Reservation',
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
CREATE INDEX idx_dining_reservations_date ON dining_reservations(reservation_date, reservation_time);
CREATE TABLE dining_orders (
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
CREATE TABLE menu_items (
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
CREATE TABLE dining_tables (
  id VARCHAR(20) PRIMARY KEY,                      -- e.g. R-01
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  guest_name VARCHAR(255) NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transportation
CREATE TABLE transfers (
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
CREATE INDEX idx_transfers_date ON transfers(date);
CREATE TABLE fleet_vehicles (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE chauffeurs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  area VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'Available',
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE flights (
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

-- Experiences
CREATE TABLE experiences (
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
CREATE TABLE experience_bookings (
  id SERIAL PRIMARY KEY,
  booking_number VARCHAR(50) NOT NULL UNIQUE,
  experience_id INTEGER REFERENCES experiences(id) ON DELETE SET NULL,
  guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  experience_name VARCHAR(255) NOT NULL,
  experience_type VARCHAR(100),
  description TEXT,
  experience_date DATE NOT NULL,
  experience_time TIME NOT NULL,
  duration_minutes INTEGER,
  number_of_participants INTEGER NOT NULL,
  price_per_person DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
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
CREATE INDEX idx_experience_bookings_date ON experience_bookings(experience_date);

-- Journey automations, AI command, notifications, settings
CREATE TABLE journey_automations (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  detail VARCHAR(255),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ai_alerts (
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
CREATE TABLE ai_priorities (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'Medium',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard header notifications; user_id NULL = every manager
CREATE TABLE staff_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_notifications_created ON staff_notifications(created_at DESC);
CREATE TABLE staff_notification_reads (
  notification_id INTEGER NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

-- Key/value settings: 'property' and 'preferences'
CREATE TABLE app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE integrations (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  detail VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'Disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  number VARCHAR(30) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Due',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================================
-- 7. Faysha HQ (/admin): audit trail and approvals
-- =====================================================================================================
-- Every change made by a signed-in user (written by middleware/hq.js)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  actor_role VARCHAR(50),
  impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  area VARCHAR(50),
  entity VARCHAR(80),
  entity_id VARCHAR(80),
  action VARCHAR(80),
  summary TEXT,
  status_code INTEGER,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_area ON audit_log(area);

-- Refunds, discounts, expenses and purchases waiting on a decision (HR leave stays in leave_requests).
CREATE TABLE approvals (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('refund', 'discount', 'expense', 'purchase', 'other')),
  title VARCHAR(200) NOT NULL,
  detail TEXT,
  amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'XAF',
  reference_type VARCHAR(30),
  reference_id INTEGER,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMP,
  decision_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_approvals_status ON approvals(status, created_at DESC);

-- =====================================================================================================
-- updated_at on every table that has the column
-- =====================================================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', 'set_updated_at_' || t, t);
  END LOOP;
END $$;
