-- Migration: Create Booking System
-- Description: Complete apartment booking system with categories, apartments, media, bookings, and payments
-- Created: 2026-03-02

-- ============================================
-- 1. Create ENUM types
-- ============================================

-- Apartment status
CREATE TYPE apartment_status AS ENUM ('available', 'occupied', 'maintenance', 'unavailable');

-- Booking status
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- Payment method
CREATE TYPE payment_method AS ENUM ('stripe', 'cash', 'bank_transfer', 'mobile_money');

-- Media type
CREATE TYPE media_type AS ENUM ('image', 'video', 'panorama_360');

-- ============================================
-- 2. Create apartment_categories table
-- ============================================
CREATE TABLE IF NOT EXISTS apartment_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL, -- Base price per night
  max_guests INTEGER NOT NULL DEFAULT 2,
  size_sqm DECIMAL(8, 2), -- Size in square meters
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]', -- Array of features: ["WiFi", "Kitchen", "Balcony"]
  amenities JSONB DEFAULT '[]', -- Array of amenities included
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE apartment_categories IS 'Types of apartments (Studio, 1BR, 2BR, etc.)';
COMMENT ON COLUMN apartment_categories.base_price IS 'Base price per night in XAF';
COMMENT ON COLUMN apartment_categories.features IS 'JSON array of features: ["WiFi", "Smart TV", "Kitchen"]';

-- ============================================
-- 3. Create apartments table
-- ============================================
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES apartment_categories(id) ON DELETE RESTRICT,
  unit_number VARCHAR(50) NOT NULL UNIQUE,
  floor INTEGER,
  building VARCHAR(100),
  status apartment_status DEFAULT 'available',

  -- Custom pricing (if different from category base price)
  custom_price DECIMAL(10, 2), -- If set, overrides category base_price

  -- Additional details
  notes TEXT,
  special_features JSONB DEFAULT '[]', -- Specific to this unit

  -- Audit
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE apartments IS 'Individual apartment units';
COMMENT ON COLUMN apartments.custom_price IS 'If set, overrides category base price';
COMMENT ON COLUMN apartments.special_features IS 'Unit-specific features different from category';

-- ============================================
-- 4. Create apartment_media table
-- ============================================
CREATE TABLE IF NOT EXISTS apartment_media (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES apartment_categories(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title VARCHAR(255),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false, -- Primary image for listings
  file_size INTEGER, -- In bytes
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- For videos in seconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Either apartment_id or category_id must be set
  CONSTRAINT media_belongs_to_either CHECK (
    (apartment_id IS NOT NULL AND category_id IS NULL) OR
    (apartment_id IS NULL AND category_id IS NOT NULL)
  )
);

COMMENT ON TABLE apartment_media IS 'Photos, videos, and 360° panoramas for apartments';
COMMENT ON COLUMN apartment_media.is_primary IS 'Primary image shown in listings';

-- ============================================
-- 5. Create bookings table
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_number VARCHAR(50) NOT NULL UNIQUE, -- FAY-20260302-001

  -- Apartment details
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE RESTRICT,

  -- Guest details
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Link to user account
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50) NOT NULL,
  guest_id_number VARCHAR(100), -- National ID or passport

  -- Booking details
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  number_of_nights INTEGER NOT NULL,

  -- Pricing
  price_per_night DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,

  -- Status
  status booking_status DEFAULT 'pending',

  -- Special requests
  special_requests TEXT,
  notes TEXT, -- Internal notes

  -- Access code
  access_code VARCHAR(20), -- Smart lock access code
  access_code_sent_at TIMESTAMP,

  -- Timestamps
  confirmed_at TIMESTAMP,
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE bookings IS 'Guest bookings for apartments';
COMMENT ON COLUMN bookings.booking_number IS 'Unique booking reference number';
COMMENT ON COLUMN bookings.access_code IS 'Smart lock access code (time-limited)';

-- ============================================
-- 6. Create payments table
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Payment details
  payment_method payment_method NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XAF',
  status payment_status DEFAULT 'pending',

  -- Stripe details
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  -- Other payment details
  transaction_reference VARCHAR(255),
  payment_metadata JSONB DEFAULT '{}',

  -- Error handling
  error_message TEXT,

  -- Timestamps
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE payments IS 'Payment transactions for bookings';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';

-- ============================================
-- 7. Create availability_overrides table
-- ============================================
CREATE TABLE IF NOT EXISTS availability_overrides (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL, -- True = force available, False = force unavailable
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE availability_overrides IS 'Manual availability overrides for apartments';
COMMENT ON COLUMN availability_overrides.is_available IS 'True = force available (even if booked), False = block';

-- ============================================
-- 8. Create pricing_rules table (seasonal pricing)
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES apartment_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_modifier DECIMAL(5, 2) NOT NULL, -- Multiplier: 1.5 = 50% increase, 0.8 = 20% discount
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pricing_belongs_to_either CHECK (
    (apartment_id IS NOT NULL AND category_id IS NULL) OR
    (apartment_id IS NULL AND category_id IS NOT NULL)
  )
);

COMMENT ON TABLE pricing_rules IS 'Seasonal pricing rules (peak season, holidays, etc.)';
COMMENT ON COLUMN pricing_rules.price_modifier IS 'Multiplier: 1.5 = 50% increase, 0.8 = 20% discount';

-- ============================================
-- 9. Create indexes
-- ============================================

-- Apartment categories
CREATE INDEX idx_apartment_categories_is_active ON apartment_categories(is_active);
CREATE INDEX idx_apartment_categories_sort_order ON apartment_categories(sort_order);

-- Apartments
CREATE INDEX idx_apartments_category_id ON apartments(category_id);
CREATE INDEX idx_apartments_status ON apartments(status);
CREATE INDEX idx_apartments_is_active ON apartments(is_active);
CREATE INDEX idx_apartments_unit_number ON apartments(unit_number);

-- Apartment media
CREATE INDEX idx_apartment_media_apartment_id ON apartment_media(apartment_id);
CREATE INDEX idx_apartment_media_category_id ON apartment_media(category_id);
CREATE INDEX idx_apartment_media_media_type ON apartment_media(media_type);
CREATE INDEX idx_apartment_media_is_primary ON apartment_media(is_primary);

-- Bookings
CREATE INDEX idx_bookings_apartment_id ON bookings(apartment_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_check_in_date ON bookings(check_in_date);
CREATE INDEX idx_bookings_check_out_date ON bookings(check_out_date);
CREATE INDEX idx_bookings_guest_email ON bookings(guest_email);
CREATE INDEX idx_bookings_dates_range ON bookings(check_in_date, check_out_date);

-- Payments
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

-- Availability overrides
CREATE INDEX idx_availability_overrides_apartment_id ON availability_overrides(apartment_id);
CREATE INDEX idx_availability_overrides_dates ON availability_overrides(start_date, end_date);

-- Pricing rules
CREATE INDEX idx_pricing_rules_apartment_id ON pricing_rules(apartment_id);
CREATE INDEX idx_pricing_rules_category_id ON pricing_rules(category_id);
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(start_date, end_date);
CREATE INDEX idx_pricing_rules_is_active ON pricing_rules(is_active);

-- ============================================
-- 10. Create triggers
-- ============================================

-- Update updated_at for apartment_categories
DROP TRIGGER IF EXISTS update_apartment_categories_updated_at ON apartment_categories;
CREATE TRIGGER update_apartment_categories_updated_at
  BEFORE UPDATE ON apartment_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at for apartments
DROP TRIGGER IF EXISTS update_apartments_updated_at ON apartments;
CREATE TRIGGER update_apartments_updated_at
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at for bookings
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at for payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Create useful functions
-- ============================================

-- Function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  sequence_num INTEGER;
BEGIN
  -- Get next sequence number for today
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM bookings
  WHERE DATE(created_at) = CURRENT_DATE;

  -- Format: FAY-YYYYMMDD-XXX
  new_number := 'FAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate nights between dates
CREATE OR REPLACE FUNCTION calculate_nights(check_in DATE, check_out DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN (check_out - check_in);
END;
$$ LANGUAGE plpgsql;

-- Function to generate random access code
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS VARCHAR AS $$
DECLARE
  code VARCHAR;
BEGIN
  -- Generate 6-digit code
  code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. Create views
-- ============================================

-- View for available apartments with details
CREATE OR REPLACE VIEW available_apartments_view AS
SELECT
  a.id,
  a.unit_number,
  a.floor,
  a.building,
  a.status,
  a.custom_price,
  c.id as category_id,
  c.name as category_name,
  c.display_name as category_display_name,
  c.description as category_description,
  c.base_price,
  COALESCE(a.custom_price, c.base_price) as effective_price,
  c.max_guests,
  c.size_sqm,
  c.bedrooms,
  c.bathrooms,
  c.features,
  c.amenities,
  (
    SELECT file_url
    FROM apartment_media
    WHERE apartment_id = a.id AND is_primary = true
    LIMIT 1
  ) as primary_image,
  (
    SELECT COUNT(*)
    FROM apartment_media
    WHERE apartment_id = a.id
  ) as media_count
FROM apartments a
JOIN apartment_categories c ON a.category_id = c.id
WHERE a.is_active = true AND c.is_active = true;

COMMENT ON VIEW available_apartments_view IS 'All available apartments with category details';

-- View for booking details
CREATE OR REPLACE VIEW booking_details_view AS
SELECT
  b.id,
  b.user_id,
  b.apartment_id,
  b.booking_number,
  b.guest_name,
  b.guest_email,
  b.guest_phone,
  b.check_in_date,
  b.check_out_date,
  b.number_of_guests,
  b.number_of_nights,
  b.total_price,
  b.final_price,
  b.status,
  b.access_code,
  b.created_at,
  a.unit_number,
  a.building,
  c.display_name as apartment_name,
  u.full_name as user_full_name,
  u.email as user_email,
  p.status as payment_status,
  p.payment_method,
  p.paid_at,
  b.total_guests
FROM bookings b
JOIN apartments a ON b.apartment_id = a.id
JOIN apartment_categories c ON a.category_id = c.id
LEFT JOIN users u ON b.user_id = u.id
LEFT JOIN payments p ON p.booking_id = b.id;

COMMENT ON VIEW booking_details_view IS 'Complete booking details with apartment and payment info';

-- ============================================
-- 13. Insert sample data (optional)
-- ============================================

-- Sample apartment categories
INSERT INTO apartment_categories (name, display_name, description, base_price, max_guests, size_sqm, bedrooms, bathrooms, features, amenities) VALUES
('studio', 'Studio Apartment', 'Modern studio with open-plan living space', 28000, 2, 35, 0, 1,
  '["WiFi", "Smart TV", "Air Conditioning", "Kitchenette", "Work Desk"]',
  '["Pool Access", "Gym Access", "Smart Access", "Housekeeping"]'
),
('1br', 'One Bedroom Apartment', 'Spacious one bedroom with separate living area', 45000, 3, 50, 1, 1,
  '["WiFi", "Smart TV", "Air Conditioning", "Full Kitchen", "Balcony", "Work Desk"]',
  '["Pool Access", "Gym Access", "Smart Access", "Housekeeping", "Concierge"]'
),
('2br', 'Two Bedroom Apartment', 'Family-friendly two bedroom apartment', 65000, 5, 75, 2, 2,
  '["WiFi", "2 Smart TVs", "Air Conditioning", "Full Kitchen", "Balcony", "Dining Area", "Work Desk"]',
  '["Pool Access", "Gym Access", "Smart Access", "Housekeeping", "Concierge", "Parking"]'
),
('executive', 'Executive Suite', 'Luxury executive suite with premium amenities', 95000, 4, 90, 2, 2,
  '["WiFi", "2 Smart TVs", "Premium Air Conditioning", "Gourmet Kitchen", "Terrace", "Premium Furnishing", "Executive Work Space"]',
  '["Private Pool Access", "Gym Access", "Smart Access", "Daily Housekeeping", "24/7 Concierge", "Parking", "Priority Services"]'
);
