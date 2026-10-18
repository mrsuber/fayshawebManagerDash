-- Seed HR Data for Fayshaa
-- This script creates sample data for testing the HR system

-- First, let's get some leave types (if they don't exist)
INSERT INTO leave_types (name, max_days_per_year, requires_approval, description, is_paid)
VALUES
  ('Annual Leave', 21, true, 'Regular paid annual vacation leave', true),
  ('Sick Leave', 10, true, 'Medical/health related absence', true),
  ('Emergency Leave', 5, true, 'Urgent family or personal emergencies', true),
  ('Unpaid Leave', 30, true, 'Extended unpaid time off', false),
  ('Maternity Leave', 90, true, 'Maternity leave for new mothers', true),
  ('Paternity Leave', 10, true, 'Paternity leave for new fathers', true)
ON CONFLICT (name) DO NOTHING;

-- Get the leave type IDs for later use
DO $$
DECLARE
  annual_leave_id INT;
  sick_leave_id INT;
  emergency_leave_id INT;
BEGIN
  SELECT id INTO annual_leave_id FROM leave_types WHERE name = 'Annual Leave';
  SELECT id INTO sick_leave_id FROM leave_types WHERE name = 'Sick Leave';
  SELECT id INTO emergency_leave_id FROM leave_types WHERE name = 'Emergency Leave';
END $$;

-- Create some departments
INSERT INTO departments (name, description)
VALUES
  ('Front Office', 'Guest reception, check-in/check-out services'),
  ('Housekeeping', 'Room cleaning and maintenance'),
  ('Food & Beverage', 'Restaurant and catering services'),
  ('Maintenance', 'Property maintenance and repairs'),
  ('Management', 'Executive and administrative management'),
  ('Human Resources', 'Employee recruitment and management')
ON CONFLICT (name) DO NOTHING;

-- Create sample job postings
INSERT INTO jobs (
  title,
  department,
  location,
  employment_type,
  description,
  requirements,
  responsibilities,
  salary_range,
  benefits,
  deadline,
  is_active,
  created_by
) VALUES
(
  'Front Desk Receptionist',
  'Front Office',
  'Fayshaa Serviced Apartments, Main Building',
  'full-time',
  'We are seeking a friendly and professional Front Desk Receptionist to be the first point of contact for our guests. The ideal candidate will have excellent communication skills and a passion for hospitality.',
  '["High school diploma or equivalent", "Fluent in Arabic and English", "1+ years in customer service or hospitality", "Proficient in MS Office and booking systems", "Excellent interpersonal skills"]',
  '["Greet and welcome guests upon arrival", "Handle check-in and check-out procedures", "Answer phone calls and respond to guest inquiries", "Process reservations and payments", "Coordinate with housekeeping for room readiness", "Resolve guest complaints professionally"]',
  'SAR 3,500 - 4,500 per month',
  '["Medical insurance", "Annual leave (21 days)", "Transportation allowance", "Staff meals", "Annual bonus based on performance"]',
  CURRENT_DATE + INTERVAL '30 days',
  true,
  1
),
(
  'Housekeeping Supervisor',
  'Housekeeping',
  'Fayshaa Serviced Apartments',
  'full-time',
  'Experienced Housekeeping Supervisor needed to oversee daily cleaning operations and manage housekeeping staff. Must ensure high standards of cleanliness and guest satisfaction.',
  '["Previous supervisory experience in housekeeping", "3+ years in hotel/serviced apartment industry", "Strong organizational skills", "Attention to detail", "Leadership abilities"]',
  '["Supervise housekeeping staff and daily operations", "Inspect rooms for cleanliness standards", "Manage inventory of cleaning supplies", "Train new housekeeping staff", "Create staff schedules", "Handle guest complaints related to cleanliness"]',
  'SAR 4,500 - 5,500 per month',
  '["Medical insurance", "Annual leave", "Housing allowance", "Transportation", "Performance bonuses"]',
  CURRENT_DATE + INTERVAL '45 days',
  true,
  1
),
(
  'Chef de Partie',
  'Food & Beverage',
  'Fayshaa Restaurant',
  'full-time',
  'We are looking for a skilled Chef de Partie to join our kitchen team. The successful candidate will be responsible for a specific section of the kitchen and ensure food quality meets our high standards.',
  '["Culinary degree or equivalent certification", "3+ years experience as Chef de Partie", "Knowledge of international cuisine", "Food safety certification", "Ability to work under pressure"]',
  '["Prepare and cook dishes for your section", "Ensure food quality and presentation", "Maintain kitchen hygiene standards", "Manage ingredient inventory", "Train junior kitchen staff", "Assist Head Chef with menu planning"]',
  'SAR 5,000 - 6,500 per month',
  '["Medical insurance", "Annual leave", "Staff accommodation", "Meals provided", "Annual flight ticket"]',
  CURRENT_DATE + INTERVAL '60 days',
  true,
  1
),
(
  'Maintenance Technician',
  'Maintenance',
  'Fayshaa Serviced Apartments',
  'full-time',
  'Seeking a skilled Maintenance Technician to handle repairs and maintenance of our facilities. Must be able to troubleshoot and fix various mechanical, electrical, and plumbing issues.',
  '["Technical diploma in electrical/mechanical/plumbing", "2+ years maintenance experience", "Knowledge of HVAC systems", "Basic electrical and plumbing skills", "Valid driver license"]',
  '["Perform routine maintenance inspections", "Repair electrical, plumbing, and HVAC issues", "Respond to maintenance requests promptly", "Maintain maintenance logs", "Coordinate with external contractors when needed", "Ensure safety compliance"]',
  'SAR 4,000 - 5,000 per month',
  '["Medical insurance", "Annual leave", "Tools and equipment provided", "Training opportunities", "Transportation"]',
  CURRENT_DATE + INTERVAL '20 days',
  true,
  1
),
(
  'Guest Relations Officer',
  'Front Office',
  'Fayshaa Serviced Apartments',
  'full-time',
  'Join our team as a Guest Relations Officer to ensure exceptional guest experiences. You will be responsible for building relationships with guests and handling special requests.',
  '["Bachelor degree in Hospitality or related field", "Excellent communication skills in Arabic, English", "2+ years in guest relations or hospitality", "Problem-solving abilities", "Professional appearance"]',
  '["Welcome VIP guests and handle special requests", "Conduct guest satisfaction surveys", "Resolve guest complaints and issues", "Coordinate special occasions and events", "Maintain guest database", "Ensure personalized service"]',
  'SAR 4,000 - 5,000 per month',
  '["Medical insurance", "Annual leave (21 days)", "Service charge", "Training and development", "Career advancement"]',
  CURRENT_DATE - INTERVAL '5 days',
  false,
  1
),
(
  'Night Auditor',
  'Front Office',
  'Fayshaa Serviced Apartments',
  'full-time',
  'We need a detail-oriented Night Auditor to handle front desk operations during night shifts and perform end-of-day financial reconciliation.',
  '["Experience in hotel accounting or front office", "Proficient in hotel management software", "Strong numerical skills", "Ability to work night shifts", "Attention to detail"]',
  '["Handle check-ins/check-outs during night shift", "Process daily financial transactions", "Prepare night audit reports", "Balance cash and credit transactions", "Respond to guest needs overnight", "Ensure security during night hours"]',
  'SAR 3,800 - 4,800 per month',
  '["Medical insurance", "Night shift allowance", "Annual leave", "Transportation", "Staff meals"]',
  CURRENT_DATE + INTERVAL '15 days',
  true,
  1
);

-- Create sample employees
INSERT INTO employees (
  employee_number,
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  gender,
  nationality,
  national_id,
  passport_number,
  job_title,
  department_id,
  employment_type,
  hire_date,
  salary,
  bank_account,
  emergency_contact_name,
  emergency_contact_phone,
  address,
  status,
  created_by
)
SELECT
  'EMP' || LPAD(nextval('employees_id_seq')::TEXT, 5, '0'),
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  gender,
  nationality,
  national_id,
  passport_number,
  job_title,
  (SELECT id FROM departments WHERE name = department_name LIMIT 1),
  employment_type,
  hire_date,
  salary,
  bank_account,
  emergency_contact_name,
  emergency_contact_phone,
  address,
  status,
  1
FROM (VALUES
  ('Sarah', 'Ahmed', 'sarah.ahmed@fayshaa.com', '+966501234567', '1992-03-15', 'female', 'Saudi Arabia', '1234567890', NULL, 'Front Desk Manager', 'Front Office', 'full-time', '2023-01-15', 6000.00, 'SA1234567890123456789012', 'Mohammed Ahmed', '+966509876543', 'Riyadh, Saudi Arabia', 'active'),
  ('Mohammed', 'Al-Rashid', 'mohammed.rashid@fayshaa.com', '+966502345678', '1988-07-22', 'male', 'Saudi Arabia', '2345678901', NULL, 'Housekeeping Manager', 'Housekeeping', 'full-time', '2022-06-01', 5500.00, 'SA2345678901234567890123', 'Fatima Al-Rashid', '+966508765432', 'Jeddah, Saudi Arabia', 'active'),
  ('Fatima', 'Hassan', 'fatima.hassan@fayshaa.com', '+966503456789', '1995-11-08', 'female', 'Saudi Arabia', '3456789012', NULL, 'Receptionist', 'Front Office', 'full-time', '2023-09-01', 4000.00, 'SA3456789012345678901234', 'Ali Hassan', '+966507654321', 'Riyadh, Saudi Arabia', 'active'),
  ('Ahmed', 'Khalid', 'ahmed.khalid@fayshaa.com', '+966504567890', '1990-05-17', 'male', 'Egypt', NULL, 'A12345678', 'Chef', 'Food & Beverage', 'full-time', '2022-03-10', 5800.00, 'SA4567890123456789012345', 'Layla Khalid', '+201234567890', 'Cairo, Egypt', 'active'),
  ('Layla', 'Ibrahim', 'layla.ibrahim@fayshaa.com', '+966505678901', '1993-09-25', 'female', 'Jordan', NULL, 'B23456789', 'HR Coordinator', 'Human Resources', 'full-time', '2023-02-20', 4500.00, 'SA5678901234567890123456', 'Omar Ibrahim', '+962791234567', 'Amman, Jordan', 'active'),
  ('Omar', 'Mahmoud', 'omar.mahmoud@fayshaa.com', '+966506789012', '1987-12-30', 'male', 'Saudi Arabia', '4567890123', NULL, 'Maintenance Supervisor', 'Maintenance', 'full-time', '2021-08-15', 5200.00, 'SA6789012345678901234567', 'Aisha Mahmoud', '+966506543210', 'Dammam, Saudi Arabia', 'active'),
  ('Aisha', 'Ali', 'aisha.ali@fayshaa.com', '+966507890123', '1996-04-12', 'female', 'Saudi Arabia', '5678901234', NULL, 'Housekeeper', 'Housekeeping', 'full-time', '2023-07-01', 3500.00, 'SA7890123456789012345678', 'Khalid Ali', '+966505432109', 'Riyadh, Saudi Arabia', 'active'),
  ('Khalid', 'Saleh', 'khalid.saleh@fayshaa.com', '+966508901234', '1991-08-19', 'male', 'Saudi Arabia', '6789012345', NULL, 'Waiter', 'Food & Beverage', 'part-time', '2023-10-15', 2500.00, 'SA8901234567890123456789', 'Nora Saleh', '+966504321098', 'Jeddah, Saudi Arabia', 'active'),
  ('Nora', 'Abdullah', 'nora.abdullah@fayshaa.com', '+966509012345', '1994-02-28', 'female', 'Lebanon', NULL, 'C34567890', 'Guest Relations Officer', 'Front Office', 'full-time', '2022-11-01', 4200.00, 'SA9012345678901234567890', 'Hassan Abdullah', '+9611234567', 'Beirut, Lebanon', 'active'),
  ('Hassan', 'Yousef', 'hassan.yousef@fayshaa.com', '+966510123456', '1989-06-05', 'male', 'Saudi Arabia', '7890123456', NULL, 'Electrician', 'Maintenance', 'full-time', '2022-04-20', 4800.00, 'SA0123456789012345678901', 'Maryam Yousef', '+966503210987', 'Riyadh, Saudi Arabia', 'active'),
  ('Maryam', 'Nasser', 'maryam.nasser@fayshaa.com', '+966511234567', '1997-10-14', 'female', 'Saudi Arabia', '8901234567', NULL, 'Receptionist', 'Front Office', 'full-time', '2024-01-10', 3800.00, 'SA1234567890123456789013', 'Fahad Nasser', '+966502109876', 'Riyadh, Saudi Arabia', 'active'),
  ('Fahad', 'Saeed', 'fahad.saeed@fayshaa.com', '+966512345678', '1985-03-07', 'male', 'Saudi Arabia', '9012345678', NULL, 'General Manager', 'Management', 'full-time', '2020-01-01', 12000.00, 'SA2345678901234567890124', 'Huda Saeed', '+966501098765', 'Riyadh, Saudi Arabia', 'active')
) AS employees_data(first_name, last_name, email, phone, date_of_birth, gender, nationality, national_id, passport_number, job_title, department_name, employment_type, hire_date, salary, bank_account, emergency_contact_name, emergency_contact_phone, address, status);

-- Create sample job applications
INSERT INTO applications (
  job_id,
  first_name,
  last_name,
  email,
  phone,
  cv_url,
  cover_letter_url,
  cover_letter_text,
  expected_salary,
  available_start_date,
  status,
  notes
)
SELECT
  (SELECT id FROM jobs WHERE title = 'Front Desk Receptionist' LIMIT 1),
  'Hiba',
  'Farook',
  'hiba.farook@email.com',
  '+966520123456',
  '/uploads/applications/cv_hiba_farook.pdf',
  '/uploads/applications/cover_hiba_farook.pdf',
  'I am very interested in the Front Desk Receptionist position. I have 2 years of experience in customer service and am fluent in both Arabic and English.',
  4000.00,
  CURRENT_DATE + INTERVAL '15 days',
  'pending',
  NULL
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Front Desk Receptionist' LIMIT 1),
  'Yara',
  'Mustafa',
  'yara.mustafa@email.com',
  '+966521234567',
  '/uploads/applications/cv_yara_mustafa.pdf',
  NULL,
  'With my background in hospitality and excellent communication skills, I believe I would be a great fit for this role.',
  3800.00,
  CURRENT_DATE + INTERVAL '30 days',
  'reviewed',
  'Good candidate, invited for interview'
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Housekeeping Supervisor' LIMIT 1),
  'Rania',
  'Karim',
  'rania.karim@email.com',
  '+966522345678',
  '/uploads/applications/cv_rania_karim.pdf',
  '/uploads/applications/cover_rania_karim.pdf',
  'I have been working as a housekeeping supervisor for 4 years at a 5-star hotel. I am excited about the opportunity to join Fayshaa.',
  5000.00,
  CURRENT_DATE + INTERVAL '20 days',
  'interviewed',
  'Strong candidate, second interview scheduled'
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Chef de Partie' LIMIT 1),
  'Tariq',
  'Amin',
  'tariq.amin@email.com',
  '+966523456789',
  '/uploads/applications/cv_tariq_amin.pdf',
  NULL,
  'French-trained chef with 5 years experience in international cuisine. Looking forward to bringing my skills to your kitchen.',
  6000.00,
  CURRENT_DATE + INTERVAL '45 days',
  'pending',
  NULL
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Maintenance Technician' LIMIT 1),
  'Sami',
  'Zaki',
  'sami.zaki@email.com',
  '+966524567890',
  '/uploads/applications/cv_sami_zaki.pdf',
  '/uploads/applications/cover_sami_zaki.pdf',
  'Certified electrician and plumber with extensive experience in building maintenance.',
  4500.00,
  CURRENT_DATE + INTERVAL '10 days',
  'reviewed',
  'Meets requirements, good technical background'
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Night Auditor' LIMIT 1),
  'Lina',
  'Jaber',
  'lina.jaber@email.com',
  '+966525678901',
  '/uploads/applications/cv_lina_jaber.pdf',
  NULL,
  'Experienced in hotel front office operations and night audit procedures. Available for night shifts.',
  4000.00,
  CURRENT_DATE + INTERVAL '7 days',
  'rejected',
  'Does not have required accounting background'
UNION ALL
SELECT
  (SELECT id FROM jobs WHERE title = 'Front Desk Receptionist' LIMIT 1),
  'Zainab',
  'Omar',
  'zainab.omar@email.com',
  '+966526789012',
  '/uploads/applications/cv_zainab_omar.pdf',
  '/uploads/applications/cover_zainab_omar.pdf',
  'Recent hospitality graduate with internship experience at luxury hotel. Passionate about guest service.',
  3500.00,
  CURRENT_DATE + INTERVAL '5 days',
  'offered',
  'Great potential, offered position at SAR 3,600'
;

-- Create attendance records for this week
DO $$
DECLARE
  emp RECORD;
  attendance_date DATE;
  clock_in TIME;
  clock_out TIME;
  day_of_week INT;
BEGIN
  -- Loop through each active employee
  FOR emp IN SELECT id FROM employees WHERE status = 'active' LOOP
    -- Create attendance for the last 7 days
    FOR i IN 0..6 LOOP
      attendance_date := CURRENT_DATE - i;
      day_of_week := EXTRACT(DOW FROM attendance_date);

      -- Skip Fridays (5) and Saturdays (6) - weekend
      IF day_of_week NOT IN (5, 6) THEN
        -- Random clock in time between 7:45 and 8:15
        clock_in := TIME '08:00:00' + (random() * INTERVAL '30 minutes') - INTERVAL '15 minutes';

        -- For today, only some employees have clocked out
        IF attendance_date = CURRENT_DATE THEN
          -- 60% chance of having clocked out already
          IF random() > 0.4 THEN
            clock_out := TIME '17:00:00' + (random() * INTERVAL '60 minutes');
          ELSE
            clock_out := NULL;
          END IF;
        ELSE
          -- Past days - everyone clocked out
          -- Random clock out time between 17:00 and 18:00
          clock_out := TIME '17:00:00' + (random() * INTERVAL '60 minutes');
        END IF;

        INSERT INTO attendance (
          employee_id,
          date,
          clock_in_time,
          clock_out_time,
          notes
        ) VALUES (
          emp.id,
          attendance_date,
          clock_in,
          clock_out,
          CASE
            WHEN random() > 0.9 THEN 'Late arrival'
            WHEN random() > 0.95 THEN 'Early departure - doctors appointment'
            ELSE NULL
          END
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Create some leave requests
INSERT INTO leave_requests (
  employee_id,
  leave_type_id,
  start_date,
  end_date,
  number_of_days,
  reason,
  status,
  approved_by,
  approved_at,
  rejection_reason
)
SELECT
  (SELECT id FROM employees WHERE email = 'sarah.ahmed@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '17 days',
  7,
  'Family vacation - booked flights to Dubai',
  'pending',
  NULL,
  NULL,
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'fatima.hassan@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Sick Leave'),
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE,
  2,
  'Flu and fever - doctors note attached',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_DATE - INTERVAL '2 days',
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'ahmed.khalid@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '44 days',
  14,
  'Annual vacation to visit family in Egypt',
  'pending',
  NULL,
  NULL,
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'omar.mahmoud@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Emergency Leave'),
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '4 days',
  1,
  'Family emergency - father hospitalized',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_DATE - INTERVAL '5 days',
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'khalid.saleh@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '6 days',
  2,
  'Personal matters',
  'rejected',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_DATE - INTERVAL '1 day',
  'Insufficient coverage during this period. Please request alternative dates.'
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'layla.ibrahim@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE + INTERVAL '74 days',
  14,
  'Summer vacation',
  'pending',
  NULL,
  NULL,
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'aisha.ali@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Sick Leave'),
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '1 day',
  1,
  'Migraine',
  'approved',
  (SELECT id FROM employees WHERE email = 'mohammed.rashid@fayshaa.com'),
  CURRENT_DATE - INTERVAL '1 day',
  NULL
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'nora.abdullah@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '21 days',
  CURRENT_DATE + INTERVAL '28 days',
  7,
  'Visiting family in Lebanon',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_DATE - INTERVAL '3 days',
  NULL
;

-- Display summary
DO $$
DECLARE
  job_count INT;
  app_count INT;
  emp_count INT;
  att_count INT;
  leave_count INT;
BEGIN
  SELECT COUNT(*) INTO job_count FROM jobs;
  SELECT COUNT(*) INTO app_count FROM applications;
  SELECT COUNT(*) INTO emp_count FROM employees;
  SELECT COUNT(*) INTO att_count FROM attendance;
  SELECT COUNT(*) INTO leave_count FROM leave_requests;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '  HR System Seed Data Summary';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Jobs created: %', job_count;
  RAISE NOTICE 'Applications created: %', app_count;
  RAISE NOTICE 'Employees created: %', emp_count;
  RAISE NOTICE 'Attendance records: %', att_count;
  RAISE NOTICE 'Leave requests: %', leave_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
END $$;
