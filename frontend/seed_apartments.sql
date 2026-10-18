-- ================================================
-- SEED DATA FOR FAYSHAA APARTMENTS (CORRECTED)
-- ================================================

-- Insert sample apartments for each category
-- Note: Images can be uploaded later through the admin interface

-- Studio Apartments (Category ID: 1)
INSERT INTO apartments (
  category_id, unit_number, floor, building, status, custom_price, notes
) VALUES
(1, 'S101', 1, 'Block A', 'available', NULL, 'Cozy studio apartment on the ground floor with modern amenities and city view.'),
(1, 'S201', 2, 'Block A', 'available', NULL, 'Bright studio apartment on second floor with balcony access.'),
(1, 'S301', 3, 'Block A', 'available', NULL, 'Top floor studio with excellent natural lighting and quiet environment.');

-- One Bedroom Apartments (Category ID: 2)
INSERT INTO apartments (
  category_id, unit_number, floor, building, status, custom_price, notes
) VALUES
(2, '1B101', 1, 'Block B', 'available', NULL, 'Spacious one bedroom with separate living area and modern kitchen.'),
(2, '1B102', 1, 'Block B', 'available', 46000.00, 'Premium one bedroom with upgraded appliances and fixtures.'),
(2, '1B201', 2, 'Block B', 'available', NULL, 'Second floor one bedroom with balcony and pool view.'),
(2, '1B202', 2, 'Block B', 'available', NULL, 'Corner unit with extra windows and natural light.');

-- Two Bedroom Apartments (Category ID: 3)
INSERT INTO apartments (
  category_id, unit_number, floor, building, status, custom_price, notes
) VALUES
(3, '2B101', 1, 'Block C', 'available', NULL, 'Family-friendly two bedroom with spacious living area and dining space.'),
(3, '2B201', 2, 'Block C', 'available', 68000.00, 'Premium two bedroom with panoramic views and modern finishes.'),
(3, '2B301', 3, 'Block C', 'available', NULL, 'Top floor two bedroom with terrace access.');

-- Executive Suites (Category ID: 4)
INSERT INTO apartments (
  category_id, unit_number, floor, building, status, custom_price, notes
) VALUES
(4, 'EX101', 1, 'Executive Wing', 'available', NULL, 'Luxury executive suite with private terrace and premium amenities.'),
(4, 'EX201', 2, 'Executive Wing', 'available', 98000.00, 'Premium executive suite with jacuzzi and office space.'),
(4, 'EX301', 3, 'Executive Wing', 'available', NULL, 'Penthouse executive suite with rooftop access and city views.');

-- Sample booking (Optional - demonstrates the booking system)
-- First, let's create a sample guest user (only if not exists)
INSERT INTO users (
  email, username, password_hash, full_name, role_id,
  status, must_change_password, email_verified
)
VALUES (
  'guest@example.com',
  'guest_example',
  '$2a$10$rZJ9H6wYhPKGmJvKzQzQd.L8yBmDqC1K.Ov8nN8xqXvHqJGqJ1pPG',
  'John Doe',
  4,
  'active',
  false,
  true
)
ON CONFLICT (email) DO NOTHING;

-- Create a sample booking with correct column names
INSERT INTO bookings (
  booking_number,
  apartment_id,
  guest_email,
  guest_name,
  guest_phone,
  check_in_date,
  check_out_date,
  number_of_guests,
  number_of_nights,
  price_per_night,
  total_price,
  final_price,
  status,
  special_requests,
  access_code
)
SELECT
  'FAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
  a.id,
  'guest@example.com',
  'John Doe',
  '+237670000000',
  CURRENT_DATE + INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '10 days',
  2,
  7,
  ac.base_price,
  ac.base_price * 7,
  ac.base_price * 7,
  'confirmed',
  'Early check-in requested',
  '123456'
FROM apartments a
JOIN apartment_categories ac ON a.category_id = ac.id
WHERE a.unit_number = 'S101'
LIMIT 1;

-- Create sample payment for the booking
INSERT INTO payments (
  booking_id,
  amount,
  payment_method,
  status,
  transaction_id,
  paid_at
)
SELECT
  b.id,
  b.final_price,
  'stripe',
  'completed',
  'pi_test_' || substring(md5(random()::text), 1, 24),
  CURRENT_TIMESTAMP
FROM bookings b
WHERE b.guest_email = 'guest@example.com'
  AND b.booking_number LIKE 'FAY-%'
ORDER BY b.created_at DESC
LIMIT 1;

-- Mark one apartment as occupied (for demonstration)
UPDATE apartments
SET status = 'occupied'
WHERE unit_number = 'S101';

-- Mark another apartment as maintenance (for demonstration)
UPDATE apartments
SET status = 'maintenance'
WHERE unit_number = '2B301';

-- Display summary
SELECT
  ac.display_name as "Category",
  ac.base_price as "Base Price (XAF)",
  COUNT(a.id) as "Total Units",
  COUNT(CASE WHEN a.status = 'available' THEN 1 END) as "Available",
  COUNT(CASE WHEN a.status = 'occupied' THEN 1 END) as "Occupied",
  COUNT(CASE WHEN a.status = 'maintenance' THEN 1 END) as "Maintenance"
FROM apartment_categories ac
LEFT JOIN apartments a ON ac.id = a.category_id
GROUP BY ac.id, ac.display_name, ac.base_price
ORDER BY ac.id;

-- Display bookings summary
SELECT
  COUNT(*) as "Total Bookings",
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as "Pending",
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as "Confirmed",
  COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as "Checked In",
  COUNT(CASE WHEN status = 'checked_out' THEN 1 END) as "Checked Out"
FROM bookings;

-- Display payments summary
SELECT
  COUNT(*) as "Total Payments",
  SUM(amount) as "Total Revenue (XAF)",
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as "Completed",
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as "Pending"
FROM payments;
