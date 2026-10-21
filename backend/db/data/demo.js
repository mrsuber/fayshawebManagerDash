/**
 * Sample data for trying the platform out (node db/setup.js --demo). Dates are relative to today, so the
 * dashboards always show guests in house, arrivals, departures and upcoming stays. Not for production.
 */
const bcrypt = require('bcryptjs');

const PASSWORD = 'Faysha2026!';

const CATEGORIES = [
  ['studio', 'Studio Residence', 'An open-plan studio with a kitchenette and a garden view.', 'Garden view', 28000, 2, 35, 0, 1,
    ['WiFi', 'Smart TV', 'Air conditioning', 'Kitchenette', 'Work desk'], ['Pool', 'Gym', 'Smart access', 'Housekeeping']],
  ['one-bedroom', 'One Bedroom Residence', 'A separate bedroom, a full kitchen and a balcony.', 'Pool view', 45000, 3, 50, 1, 1,
    ['WiFi', 'Smart TV', 'Air conditioning', 'Full kitchen', 'Balcony'], ['Pool', 'Gym', 'Smart access', 'Housekeeping', 'Concierge']],
  ['two-bedroom', 'Two Bedroom Residence', 'Room for a family, with two bathrooms and a dining area.', 'Pool view', 65000, 5, 75, 2, 2,
    ['WiFi', 'Two smart TVs', 'Air conditioning', 'Full kitchen', 'Balcony', 'Dining area'], ['Pool', 'Gym', 'Smart access', 'Housekeeping', 'Concierge', 'Parking']],
  ['executive-suite', 'Executive Suite', 'The finest residence: a terrace, a gourmet kitchen and an executive workspace.', 'Panoramic view', 95000, 4, 90, 2, 2,
    ['WiFi', 'Two smart TVs', 'Gourmet kitchen', 'Terrace', 'Executive workspace'], ['Private pool access', 'Gym', 'Smart access', 'Daily housekeeping', '24/7 concierge', 'Parking']],
];

const UNITS = [
  ['S-101', 'studio', 1], ['S-102', 'studio', 1], ['A-201', 'one-bedroom', 2], ['A-202', 'one-bedroom', 2],
  ['A-203', 'one-bedroom', 2], ['B-301', 'two-bedroom', 3], ['B-302', 'two-bedroom', 3], ['E-401', 'executive-suite', 4],
];

const STAFF = [
  ['manager@fayshaa.com', 'Amina Nkemelu', 'manager', 'General Manager', 'Management'],
  ['hr@fayshaa.com', 'Paul Ndi', 'hr_manager', 'HR Manager', 'Human Resources'],
  ['housekeeping@fayshaa.com', 'Grace Mbah', 'staff', 'Housekeeping Supervisor', 'Housekeeping'],
];

const GUESTS = [
  ['claire.fontaine@example.com', 'Claire Fontaine', '+33 6 12 34 56 78', 'France'],
  ['daniel.okafor@example.com', 'Daniel Okafor', '+234 803 555 0101', 'Nigeria'],
  ['sophie.ekwe@example.com', 'Sophie Ekwe', '+237 677 55 01 02', 'Cameroon'],
  ['james.whitfield@example.com', 'James Whitfield', '+44 7700 900123', 'United Kingdom'],
  ['nadia.bello@example.com', 'Nadia Bello', '+237 699 55 01 03', 'Cameroon'],
  ['marc.tchoupo@example.com', 'Marc Tchoupo', '+237 655 55 01 04', 'Cameroon'],
];

// [guest index, unit, check-in offset (days from today), nights, status, payment method, payment status]
const STAYS = [
  [0, 'E-401', -2, 5, 'checked_in', 'stripe', 'completed'],
  [1, 'A-201', 0, 3, 'confirmed', 'stripe', 'completed'],
  [2, 'S-101', -3, 3, 'checked_in', 'mobile_money', 'completed'],
  [3, 'B-301', 6, 4, 'confirmed', 'stripe', 'completed'],
  [4, 'A-202', 2, 2, 'pending', 'mobile_money', 'pending'],
  [5, 'S-102', -30, 4, 'checked_out', 'cash', 'completed'],
  [3, 'A-203', -60, 3, 'checked_out', 'stripe', 'completed'],
  [5, 'B-302', 12, 2, 'cancelled', 'stripe', 'refunded'],
];

const pin = () => String(1000 + Math.floor(Math.random() * 9000));

async function load(client) {
  const already = await client.query(`SELECT 1 FROM apartments LIMIT 1`);
  if (already.rows[0]) throw new Error('The database already has residences; demo data is only loaded into a fresh database');

  const hash = await bcrypt.hash(PASSWORD, 10);
  const role = async (name) => (await client.query('SELECT id FROM roles WHERE name = $1', [name])).rows[0].id;
  const today = (await client.query(`SELECT CURRENT_DATE AS d`)).rows[0].d;
  const day = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const accounts = [];

  // Residences
  const cat = {};
  for (const [i, [name, display, description, view, price, guests, size, bedrooms, bathrooms, features, amenities]] of CATEGORIES.entries()) {
    const { rows } = await client.query(
      `INSERT INTO apartment_categories (name, display_name, description, view_description, base_price, max_guests, size_sqm, bedrooms, bathrooms, features, amenities, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, base_price`,
      [name, display, description, view, price, guests, size, bedrooms, bathrooms, JSON.stringify(features), JSON.stringify(amenities), i]
    );
    cat[name] = rows[0];
  }
  const unit = {};
  for (const [number, category, floor] of UNITS) {
    const { rows } = await client.query(
      `INSERT INTO apartments (category_id, unit_number, floor, building) VALUES ($1, $2, $3, 'Main') RETURNING id`,
      [cat[category].id, number, floor]
    );
    unit[number] = { id: rows[0].id, price: Number(cat[category].base_price) }; // its deposit box is created by the schema
  }

  // Staff
  const staffIds = {};
  for (const [email, name, roleName, title, department] of STAFF) {
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, full_name, role_id, status, email_verified, job_title, department, password_changed_at)
       VALUES ($1, $1, $2, $3, $4, 'active', true, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
      [email, hash, name, await role(roleName), title, department]
    );
    staffIds[roleName] = rows[0].id;
    accounts.push({ role: roleName, email });
  }

  // Guests and their stays
  const guestRole = await role('guest');
  const guests = [];
  for (const [email, name, phone, country] of GUESTS) {
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, full_name, role_id, status, email_verified, phone, nationality, password_changed_at)
       VALUES ($1, $1, $2, $3, $4, 'active', true, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
      [email, hash, name, guestRole, phone, country]
    );
    guests.push({ id: rows[0].id, email, name, phone, country });
    await client.query(`INSERT INTO guest_profiles (user_id, country, language, vip) VALUES ($1, $2, 'English', $3)`, [rows[0].id, country, email.startsWith('claire')]);
  }
  accounts.push({ role: 'guest', email: GUESTS[0][0] });

  const stays = [];
  for (const [n, [g, number, offset, nights, status, method, paymentStatus]] of STAYS.entries()) {
    const guest = guests[g];
    const u = unit[number];
    const total = u.price * nights;
    // Unpaid holds expire (services/bookingHolds.js), so the pending one was made today.
    const created = status === 'pending' ? day(0) : day(Math.min(offset, 0) - 7);
    const confirmed = ['confirmed', 'checked_in', 'checked_out'].includes(status);
    const { rows } = await client.query(
      `INSERT INTO bookings (booking_number, apartment_id, user_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date,
                             number_of_guests, number_of_nights, price_per_night, total_price, final_price, status, terms_accepted, terms_accepted_at,
                             door_pin, gate_qr_code, deposit_box_number, deposit_box_pin, keys_generated_at, confirmed_at, checked_in_at, checked_out_at,
                             cancelled_at, cancellation_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2,$9,$10,$11,$11,$12,true,$13::date,
               $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$13::date)
       RETURNING id`,
      [
        `FAY-${created.replace(/-/g, '')}-${String(n + 1).padStart(3, '0')}`, u.id, guest.id, guest.name, guest.email, guest.phone,
        day(offset), day(offset + nights), nights, u.price, total, status, created,
        confirmed ? pin() : null, confirmed ? `FAYSHAA-APT-DEMO-${n + 1}-${guest.id}` : null, confirmed ? `DB-${number}` : null, confirmed ? pin() : null,
        confirmed ? created : null, confirmed ? created : null,
        ['checked_in', 'checked_out'].includes(status) ? day(offset) : null, status === 'checked_out' ? day(offset + nights) : null,
        status === 'cancelled' ? created : null, status === 'cancelled' ? 'Change of plans' : null,
      ]
    );
    stays.push({ id: rows[0].id, guest, status, total });
    await client.query(
      `INSERT INTO payments (booking_id, payment_method, amount, status, paid_at, refunded_at, refund_amount, transaction_reference, payment_metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date)`,
      [
        rows[0].id, method, total, paymentStatus, paymentStatus === 'pending' ? null : created, paymentStatus === 'refunded' ? created : null,
        paymentStatus === 'refunded' ? total : null, method === 'stripe' ? `pi_demo_${n + 1}` : null,
        JSON.stringify(method === 'mobile_money' ? { provider: 'mtn', phone: guest.phone } : {}), created,
      ]
    );
  }

  // Extras on the in-house guests' bills, a wellness booking and a chat
  const inHouse = stays[0];
  await client.query(
    `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount) VALUES
       ($1, $2, 'In-residence dinner for two', 'Dining', 32000), ($1, $2, 'Airport transfer', 'Transport', 25000)`,
    [inHouse.guest.id, inHouse.id]
  );
  const massage = (await client.query(`SELECT id, name, duration FROM wellness_activities WHERE name = 'Massage Therapy'`)).rows[0];
  if (massage) {
    await client.query(
      `INSERT INTO wellness_bookings (apartment_booking_id, user_id, activity_id, activity_name, activity_type, booking_date, start_time, end_time, total_duration)
       VALUES ($1, $2, $3, $4, 'service', $5, '10:00', '11:00', $6)`,
      [inHouse.id, inHouse.guest.id, massage.id, massage.name, day(1), massage.duration]
    );
  }
  await client.query(
    `INSERT INTO concierge_messages (user_id, message, sender_type, created_at) VALUES
       ($1, 'Hello, could we have a table for two at the restaurant tonight at 8?', 'user', NOW() - INTERVAL '2 hours'),
       ($1, 'Of course, Ms Fontaine. Your table for two is booked for 8 pm.', 'concierge', NOW() - INTERVAL '1 hour 50 minutes')`,
    [inHouse.guest.id]
  );
  await client.query(
    `INSERT INTO service_requests (request_number, guest_id, guest_name, booking_id, request_type, title, description, priority, status, department, created_at) VALUES
       ('SRQ-DEMO-001', $1, $2, $3, 'housekeeping', 'Extra towels', 'Two extra bath towels please', 'normal', 'pending', 'housekeeping', NOW() - INTERVAL '30 minutes'),
       ('SRQ-DEMO-002', $4, $5, $6, 'maintenance', 'Air conditioning is noisy', 'Bedroom unit rattles at night', 'high', 'in_progress', 'maintenance', NOW() - INTERVAL '5 hours')`,
    [inHouse.guest.id, inHouse.guest.name, inHouse.id, stays[2].guest.id, stays[2].guest.name, stays[2].id]
  );

  // Testimonials on the website
  await client.query(
    `INSERT INTO feedback (name, role, rating, testimonial_text, feedback_type, allow_public_display, status, approved_at) VALUES
       ('Sarah Johnson', 'Business traveller', 5, 'Check-in with the digital key was effortless and the residence was immaculate.', 'testimonial', true, 'approved', NOW()),
       ('David Mbah', 'Long stay', 5, 'Three months that felt like a resort: the gym, the pool and a team that knows your name.', 'testimonial', true, 'approved', NOW()),
       ('Marie Dubois', 'Holiday', 5, 'The concierge arranged everything. The Restore journey is unmissable.', 'testimonial', true, 'approved', NOW()),
       ('Kevin Ateba', NULL, 4, NULL, 'suggestion', false, 'pending', NULL)`
  );

  // People
  const dept = async (name) => (await client.query('SELECT id FROM departments WHERE name = $1', [name])).rows[0].id;
  const empCat = async (name) => (await client.query('SELECT id FROM employee_categories WHERE name = $1', [name])).rows[0].id;
  const people = [
    ['Amina', 'Nkemelu', 'manager@fayshaa.com', 'General Manager', 'Management', 'manager', staffIds.manager],
    ['Paul', 'Ndi', 'hr@fayshaa.com', 'HR Manager', 'Human Resources', 'hr', staffIds.hr_manager],
    ['Grace', 'Mbah', 'housekeeping@fayshaa.com', 'Housekeeping Supervisor', 'Housekeeping', 'housekeeping', staffIds.staff],
    ['Eric', 'Fon', 'eric.fon@fayshaa.com', 'Maintenance Technician', 'Maintenance', 'maintenance', null],
    ['Linda', 'Ayuk', 'linda.ayuk@fayshaa.com', 'Spa Therapist', 'Wellness', 'therapist', null],
  ];
  const leaveTypes = (await client.query('SELECT id, days_per_year FROM leave_types')).rows;
  const year = new Date(today).getFullYear();
  const employeeIds = [];
  for (const [i, [first, last, email, title, department, category, userId]] of people.entries()) {
    const { rows } = await client.query(
      `INSERT INTO employees (user_id, employee_number, department_id, category_id, first_name, last_name, email, job_title, employment_type, hire_date, salary_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'full-time', $9, $10) RETURNING id`,
      [userId, `EMP-${year}-${String(i + 1).padStart(4, '0')}`, await dept(department), await empCat(category), first, last, email, title, day(-400 + i * 30), 350000 + i * 25000]
    );
    employeeIds.push(rows[0].id);
    for (const lt of leaveTypes) {
      await client.query(
        `INSERT INTO employee_leave_balance (employee_id, leave_type_id, year, total_days, remaining_days) VALUES ($1, $2, $3, $4, $4)`,
        [rows[0].id, lt.id, year, lt.days_per_year]
      );
    }
    await client.query(
      `INSERT INTO employee_attendance (employee_id, clock_in_time, clock_out_time, clock_in_method, total_hours)
       VALUES ($1, $2::date + TIME '07:58', $2::date + TIME '16:05', 'keycard', 8.1)`,
      [rows[0].id, day(-1)]
    );
  }
  const annual = (await client.query(`SELECT id FROM leave_types WHERE name = 'Annual Leave'`)).rows[0].id;
  await client.query(
    `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, number_of_days, reason) VALUES ($1, $2, $3, $4, 3, 'Family visit')`,
    [employeeIds[4], annual, day(14), day(16)]
  );
  const { rows: jobs } = await client.query(
    `INSERT INTO job_postings (title, department_id, description, requirements, employment_type, location, salary_range_min, salary_range_max, closing_date, created_by)
     VALUES ('Front Office Agent', $1, 'Welcome guests, run check-in and look after them during their stay.', 'Fluent English and French; two years in hospitality.', 'full-time', 'On site', 250000, 350000, $3, $4),
            ('Spa Therapist', $2, 'Deliver massage and spa treatments and the Restore journey.', 'Certified massage therapist.', 'full-time', 'On site', 280000, 380000, $3, $4)
     RETURNING id`,
    [await dept('Front Office'), await dept('Wellness'), day(30), staffIds.hr_manager]
  );
  await client.query(
    `INSERT INTO job_applications (job_posting_id, first_name, last_name, email, phone, cv_file_path, cover_letter_text)
     VALUES ($1, 'Brenda', 'Tabi', 'brenda.tabi@example.com', '+237 670 00 00 01', 'uploads/cv/demo-cv.pdf', 'I would love to welcome your guests.')`,
    [jobs[0].id]
  );

  // Operations (FAY OS)
  await client.query(
    `INSERT INTO menu_items (name, venue, price, category, popular) VALUES
       ('Ndolé with plantains', 'Restaurant', 9500, 'Mains', true), ('Grilled tilapia', 'Restaurant', 11000, 'Mains', true),
       ('Garden salad', 'Restaurant', 5500, 'Starters', false), ('Fresh fruit platter', 'In-residence', 4500, 'Desserts', false),
       ('Continental breakfast', 'In-residence', 8000, 'Breakfast', true), ('Fresh juice', 'Pool bar', 2500, 'Drinks', false)`
  );
  await client.query(`INSERT INTO dining_tables (id) VALUES ('R-01'), ('R-02'), ('R-03'), ('R-04'), ('T-01'), ('T-02')`);
  await client.query(
    `INSERT INTO dining_reservations (reservation_number, guest_id, guest_name, booking_id, restaurant_name, reservation_date, reservation_time, number_of_guests, status)
     VALUES ('DIN-DEMO-001', $1, $2, $3, 'Restaurant', CURRENT_DATE, '20:00', 2, 'confirmed')`,
    [inHouse.guest.id, inHouse.guest.name, inHouse.id]
  );
  await client.query(
    `INSERT INTO experiences (category, name, description, duration, capacity, price) VALUES
       ('Nature', 'Waterfall hike', 'A guided half-day hike to the falls', '4 h', 8, 25000),
       ('Culture', 'Craft market tour', 'Artisans, music and local food', '3 h', 10, 18000),
       ('Culinary', 'Cooking class', 'Learn three Cameroonian classics with our chef', '2 h', 6, 22000)`
  );
  await client.query(
    `INSERT INTO transfers (date, time, kind, guest_id, guest_name, from_location, to_location, vehicle, driver, status)
     VALUES (CURRENT_DATE, '14:30', 'Airport pickup', $1, $2, 'Douala Airport (DLA)', 'Faysha Wellness Residence', 'Range Rover', 'Samuel', 'Scheduled')`,
    [stays[1].guest.id, stays[1].guest.name]
  );
  await client.query(
    `INSERT INTO fleet_vehicles (icon, name, detail, status) VALUES ('directions_car', 'Range Rover', 'LT 123 AB · 4 seats', 'Available'), ('airport_shuttle', 'Toyota Hiace', 'LT 456 CD · 12 seats', 'Available')`
  );
  await client.query(`INSERT INTO chauffeurs (name, area, status, phone) VALUES ('Samuel', 'Airport and city', 'Available', '+237 670 00 00 10')`);
  await client.query(
    `INSERT INTO housekeeping_tasks (task_date, time, title, location, assignee, status) VALUES
       (CURRENT_DATE, '09:00', 'Departure clean', 'S-101', 'Grace Mbah', 'Scheduled'),
       (CURRENT_DATE, '11:00', 'Arrival preparation', 'A-201', 'Grace Mbah', 'Scheduled')`
  );
  await client.query(`INSERT INTO housekeeping_staff (name, zone, shift) VALUES ('Grace Mbah', 'All residences', 'Morning')`);
  await client.query(`INSERT INTO linen_stock (item, level, par) VALUES ('Bath towels', 72, 60), ('Bed sheets', 55, 60), ('Bathrobes', 90, 40)`);
  await client.query(
    `INSERT INTO work_orders (number, title, location, priority, technician, status) VALUES ('WO-DEMO-001', 'Air conditioning noise', 'S-101', 'High', 'Eric Fon', 'In Progress')`
  );
  await client.query(`INSERT INTO technicians (name, skill, status) VALUES ('Eric Fon', 'HVAC and electrical', 'Busy')`);
  await client.query(
    `INSERT INTO maintenance_systems (icon, name, health) VALUES ('ac_unit', 'Air conditioning', 86), ('pool', 'Pool filtration', 94), ('bolt', 'Generator', 100)`
  );

  // A refund waiting on HQ
  await client.query(
    `INSERT INTO approvals (property_id, type, title, detail, amount, reference_type, reference_id, requested_by)
     VALUES ((SELECT id FROM properties ORDER BY id LIMIT 1), 'discount', 'Late check-out discount', 'Flight delayed; 50% off the extra night', 22500, 'booking', $1, $2)`,
    [stays[1].id, staffIds.manager]
  );

  return accounts;
}

module.exports = { load, PASSWORD };
