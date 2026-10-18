-- Seed HR Data for Fayshaa (Updated for actual schema)
-- This script creates sample data for testing the HR system

-- Insert leave types
INSERT INTO leave_types (name, description, days_per_year, requires_approval, is_paid, max_consecutive_days, is_active)
VALUES
  ('Annual Leave', 'Regular paid annual vacation leave', 21, true, true, 14, true),
  ('Sick Leave', 'Medical/health related absence', 10, true, true, 7, true),
  ('Emergency Leave', 'Urgent family or personal emergencies', 5, true, true, 3, true),
  ('Unpaid Leave', 'Extended unpaid time off', 30, true, false, 30, true),
  ('Maternity Leave', 'Maternity leave for new mothers', 90, true, true, 90, true),
  ('Paternity Leave', 'Paternity leave for new fathers', 10, true, true, 10, true)
ON CONFLICT (name) DO NOTHING;

-- Create employee categories
INSERT INTO employee_categories (name, description)
VALUES
  ('Management', 'Executive and senior management positions'),
  ('Administrative', 'Administrative and office staff'),
  ('Operations', 'Operational and service staff'),
  ('Technical', 'Technical and maintenance staff')
ON CONFLICT (name) DO NOTHING;

-- Create sample job postings
INSERT INTO job_postings (
  title,
  department_id,
  category_id,
  description,
  requirements,
  responsibilities,
  employment_type,
  location,
  salary_range_min,
  salary_range_max,
  salary_currency,
  closing_date,
  status,
  number_of_positions,
  created_by
)
SELECT
  'Front Desk Receptionist',
  (SELECT id FROM departments WHERE name = 'Front Office' LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = 'Operations' LIMIT 1),
  'We are seeking a friendly and professional Front Desk Receptionist to be the first point of contact for our guests. The ideal candidate will have excellent communication skills and a passion for hospitality.',
  E'- High school diploma or equivalent\n- Fluent in Arabic and English\n- 1+ years in customer service or hospitality\n- Proficient in MS Office and booking systems\n- Excellent interpersonal skills',
  E'- Greet and welcome guests upon arrival\n- Handle check-in and check-out procedures\n- Answer phone calls and respond to guest inquiries\n- Process reservations and payments\n- Coordinate with housekeeping for room readiness\n- Resolve guest complaints professionally',
  'Full-time',
  'Fayshaa Serviced Apartments, Main Building',
  3500.00,
  4500.00,
  'SAR',
  CURRENT_DATE + INTERVAL '30 days',
  'open',
  2,
  1
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Front Desk Receptionist')
UNION ALL
SELECT
  'Housekeeping Supervisor',
  (SELECT id FROM departments WHERE name = 'Housekeeping' LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = 'Operations' LIMIT 1),
  'Experienced Housekeeping Supervisor needed to oversee daily cleaning operations and manage housekeeping staff. Must ensure high standards of cleanliness and guest satisfaction.',
  E'- Previous supervisory experience in housekeeping\n- 3+ years in hotel/serviced apartment industry\n- Strong organizational skills\n- Attention to detail\n- Leadership abilities',
  E'- Supervise housekeeping staff and daily operations\n- Inspect rooms for cleanliness standards\n- Manage inventory of cleaning supplies\n- Train new housekeeping staff\n- Create staff schedules\n- Handle guest complaints related to cleanliness',
  'Full-time',
  'Fayshaa Serviced Apartments',
  4500.00,
  5500.00,
  'SAR',
  CURRENT_DATE + INTERVAL '45 days',
  'open',
  1,
  1
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Housekeeping Supervisor')
UNION ALL
SELECT
  'Chef de Partie',
  (SELECT id FROM departments WHERE name = 'Food & Beverage' LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = 'Operations' LIMIT 1),
  'We are looking for a skilled Chef de Partie to join our kitchen team. The successful candidate will be responsible for a specific section of the kitchen and ensure food quality meets our high standards.',
  E'- Culinary degree or equivalent certification\n- 3+ years experience as Chef de Partie\n- Knowledge of international cuisine\n- Food safety certification\n- Ability to work under pressure',
  E'- Prepare and cook dishes for your section\n- Ensure food quality and presentation\n- Maintain kitchen hygiene standards\n- Manage ingredient inventory\n- Train junior kitchen staff\n- Assist Head Chef with menu planning',
  'Full-time',
  'Fayshaa Restaurant',
  5000.00,
  6500.00,
  'SAR',
  CURRENT_DATE + INTERVAL '60 days',
  'open',
  1,
  1
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Chef de Partie')
UNION ALL
SELECT
  'Maintenance Technician',
  (SELECT id FROM departments WHERE name = 'Maintenance' LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = 'Technical' LIMIT 1),
  'Seeking a skilled Maintenance Technician to handle repairs and maintenance of our facilities. Must be able to troubleshoot and fix various mechanical, electrical, and plumbing issues.',
  E'- Technical diploma in electrical/mechanical/plumbing\n- 2+ years maintenance experience\n- Knowledge of HVAC systems\n- Basic electrical and plumbing skills\n- Valid driver license',
  E'- Perform routine maintenance inspections\n- Repair electrical, plumbing, and HVAC issues\n- Respond to maintenance requests promptly\n- Maintain maintenance logs\n- Coordinate with external contractors when needed\n- Ensure safety compliance',
  'Full-time',
  'Fayshaa Serviced Apartments',
  4000.00,
  5000.00,
  'SAR',
  CURRENT_DATE + INTERVAL '20 days',
  'open',
  2,
  1
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Maintenance Technician')
UNION ALL
SELECT
  'Night Auditor',
  (SELECT id FROM departments WHERE name = 'Front Office' LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = 'Operations' LIMIT 1),
  'We need a detail-oriented Night Auditor to handle front desk operations during night shifts and perform end-of-day financial reconciliation.',
  E'- Experience in hotel accounting or front office\n- Proficient in hotel management software\n- Strong numerical skills\n- Ability to work night shifts\n- Attention to detail',
  E'- Handle check-ins/check-outs during night shift\n- Process daily financial transactions\n- Prepare night audit reports\n- Balance cash and credit transactions\n- Respond to guest needs overnight\n- Ensure security during night hours',
  'Full-time',
  'Fayshaa Serviced Apartments',
  3800.00,
  4800.00,
  'SAR',
  CURRENT_DATE + INTERVAL '15 days',
  'open',
  1,
  1
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Night Auditor');

-- Create sample employees
INSERT INTO employees (
  employee_number,
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  gender,
  job_title,
  department_id,
  category_id,
  employment_type,
  hire_date,
  salary_amount,
  salary_currency,
  salary_period,
  address,
  status,
  is_active,
  created_by
)
SELECT
  employee_number,
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  gender,
  job_title,
  (SELECT id FROM departments WHERE name = department_name LIMIT 1),
  (SELECT id FROM employee_categories WHERE name = category_name LIMIT 1),
  employment_type,
  hire_date,
  salary,
  'SAR',
  'monthly',
  address,
  status,
  true,
  1
FROM (VALUES
  ('EMP00001', 'Sarah', 'Ahmed', 'sarah.ahmed@fayshaa.com', '+966501234567', '1992-03-15', 'female', 'Front Desk Manager', 'Front Office', 'Management', 'Full-time', '2023-01-15', 6000.00, 'Riyadh, Saudi Arabia', 'active'),
  ('EMP00002', 'Mohammed', 'Al-Rashid', 'mohammed.rashid@fayshaa.com', '+966502345678', '1988-07-22', 'male', 'Housekeeping Manager', 'Housekeeping', 'Management', 'Full-time', '2022-06-01', 5500.00, 'Jeddah, Saudi Arabia', 'active'),
  ('EMP00003', 'Fatima', 'Hassan', 'fatima.hassan@fayshaa.com', '+966503456789', '1995-11-08', 'female', 'Receptionist', 'Front Office', 'Operations', 'Full-time', '2023-09-01', 4000.00, 'Riyadh, Saudi Arabia', 'active'),
  ('EMP00004', 'Ahmed', 'Khalid', 'ahmed.khalid@fayshaa.com', '+966504567890', '1990-05-17', 'male', 'Chef', 'Food & Beverage', 'Operations', 'Full-time', '2022-03-10', 5800.00, 'Cairo, Egypt', 'active'),
  ('EMP00005', 'Layla', 'Ibrahim', 'layla.ibrahim@fayshaa.com', '+966505678901', '1993-09-25', 'female', 'HR Coordinator', 'Human Resources', 'Administrative', 'Full-time', '2023-02-20', 4500.00, 'Amman, Jordan', 'active'),
  ('EMP00006', 'Omar', 'Mahmoud', 'omar.mahmoud@fayshaa.com', '+966506789012', '1987-12-30', 'male', 'Maintenance Supervisor', 'Maintenance', 'Technical', 'Full-time', '2021-08-15', 5200.00, 'Dammam, Saudi Arabia', 'active'),
  ('EMP00007', 'Aisha', 'Ali', 'aisha.ali@fayshaa.com', '+966507890123', '1996-04-12', 'female', 'Housekeeper', 'Housekeeping', 'Operations', 'Full-time', '2023-07-01', 3500.00, 'Riyadh, Saudi Arabia', 'active'),
  ('EMP00008', 'Khalid', 'Saleh', 'khalid.saleh@fayshaa.com', '+966508901234', '1991-08-19', 'male', 'Waiter', 'Food & Beverage', 'Operations', 'Part-time', '2023-10-15', 2500.00, 'Jeddah, Saudi Arabia', 'active'),
  ('EMP00009', 'Nora', 'Abdullah', 'nora.abdullah@fayshaa.com', '+966509012345', '1994-02-28', 'female', 'Guest Relations Officer', 'Front Office', 'Operations', 'Full-time', '2022-11-01', 4200.00, 'Beirut, Lebanon', 'active'),
  ('EMP00010', 'Hassan', 'Yousef', 'hassan.yousef@fayshaa.com', '+966510123456', '1989-06-05', 'male', 'Electrician', 'Maintenance', 'Technical', 'Full-time', '2022-04-20', 4800.00, 'Riyadh, Saudi Arabia', 'active'),
  ('EMP00011', 'Maryam', 'Nasser', 'maryam.nasser@fayshaa.com', '+966511234567', '1997-10-14', 'female', 'Receptionist', 'Front Office', 'Operations', 'Full-time', '2024-01-10', 3800.00, 'Riyadh, Saudi Arabia', 'active'),
  ('EMP00012', 'Fahad', 'Saeed', 'fahad.saeed@fayshaa.com', '+966512345678', '1985-03-07', 'male', 'General Manager', 'Management', 'Management', 'Full-time', '2020-01-01', 12000.00, 'Riyadh, Saudi Arabia', 'active')
) AS employees_data(employee_number, first_name, last_name, email, phone, date_of_birth, gender, job_title, department_name, category_name, employment_type, hire_date, salary, address, status)
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email = employees_data.email);

-- Create sample job applications
INSERT INTO job_applications (
  job_posting_id,
  first_name,
  last_name,
  email,
  phone,
  resume_url,
  cover_letter_url,
  cover_letter_text,
  expected_salary_min,
  available_start_date,
  status,
  notes,
  applied_at
)
SELECT
  (SELECT id FROM job_postings WHERE title = 'Front Desk Receptionist' LIMIT 1),
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
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Front Desk Receptionist')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Front Desk Receptionist' LIMIT 1),
  'Yara',
  'Mustafa',
  'yara.mustafa@email.com',
  '+966521234567',
  '/uploads/applications/cv_yara_mustafa.pdf',
  NULL,
  'With my background in hospitality and excellent communication skills, I believe I would be a great fit for this role.',
  3800.00,
  CURRENT_DATE + INTERVAL '30 days',
  'under_review',
  'Good candidate, invited for interview',
  CURRENT_TIMESTAMP - INTERVAL '3 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Front Desk Receptionist')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Housekeeping Supervisor' LIMIT 1),
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
  'Strong candidate, second interview scheduled',
  CURRENT_TIMESTAMP - INTERVAL '5 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Housekeeping Supervisor')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Chef de Partie' LIMIT 1),
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
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Chef de Partie')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Maintenance Technician' LIMIT 1),
  'Sami',
  'Zaki',
  'sami.zaki@email.com',
  '+966524567890',
  '/uploads/applications/cv_sami_zaki.pdf',
  '/uploads/applications/cover_sami_zaki.pdf',
  'Certified electrician and plumber with extensive experience in building maintenance.',
  4500.00,
  CURRENT_DATE + INTERVAL '10 days',
  'under_review',
  'Meets requirements, good technical background',
  CURRENT_TIMESTAMP - INTERVAL '4 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Maintenance Technician')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Night Auditor' LIMIT 1),
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
  'Does not have required accounting background',
  CURRENT_TIMESTAMP - INTERVAL '6 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Night Auditor')
UNION ALL
SELECT
  (SELECT id FROM job_postings WHERE title = 'Front Desk Receptionist' LIMIT 1),
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
  'Great potential, offered position at SAR 3,600',
  CURRENT_TIMESTAMP - INTERVAL '7 days'
WHERE EXISTS (SELECT 1 FROM job_postings WHERE title = 'Front Desk Receptionist');

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
  FOR emp IN SELECT id FROM employees WHERE status = 'active' AND is_active = true LOOP
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
          clock_out := TIME '17:00:00' + (random() * INTERVAL '60 minutes');
        END IF;

        INSERT INTO employee_attendance (
          employee_id,
          check_in_time,
          check_out_time,
          work_date,
          notes
        ) VALUES (
          emp.id,
          (attendance_date || ' ' || clock_in)::TIMESTAMP,
          CASE WHEN clock_out IS NULL THEN NULL ELSE (attendance_date || ' ' || clock_out)::TIMESTAMP END,
          attendance_date,
          CASE
            WHEN random() > 0.9 THEN 'Late arrival'
            WHEN random() > 0.95 THEN 'Early departure - doctors appointment'
            ELSE NULL
          END
        )
        ON CONFLICT (employee_id, work_date) DO NOTHING;
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
  total_days,
  reason,
  status,
  reviewed_by,
  reviewed_at,
  rejection_reason
)
SELECT
  (SELECT id FROM employees WHERE email = 'sarah.ahmed@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '16 days',
  7,
  'Family vacation - booked flights to Dubai',
  'pending',
  NULL,
  NULL,
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'sarah.ahmed@fayshaa.com')
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'fatima.hassan@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Sick Leave'),
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '1 day',
  2,
  'Flu and fever - doctors note attached',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_TIMESTAMP - INTERVAL '2 days',
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'fatima.hassan@fayshaa.com')
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'ahmed.khalid@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '43 days',
  14,
  'Annual vacation to visit family in Egypt',
  'pending',
  NULL,
  NULL,
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'ahmed.khalid@fayshaa.com')
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'omar.mahmoud@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Emergency Leave'),
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '5 days',
  1,
  'Family emergency - father hospitalized',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'omar.mahmoud@fayshaa.com')
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
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  'Insufficient coverage during this period. Please request alternative dates.'
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'khalid.saleh@fayshaa.com')
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'layla.ibrahim@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE + INTERVAL '73 days',
  14,
  'Summer vacation',
  'pending',
  NULL,
  NULL,
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'layla.ibrahim@fayshaa.com')
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
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'aisha.ali@fayshaa.com')
UNION ALL
SELECT
  (SELECT id FROM employees WHERE email = 'nora.abdullah@fayshaa.com'),
  (SELECT id FROM leave_types WHERE name = 'Annual Leave'),
  CURRENT_DATE + INTERVAL '21 days',
  CURRENT_DATE + INTERVAL '27 days',
  7,
  'Visiting family in Lebanon',
  'approved',
  (SELECT id FROM employees WHERE email = 'fahad.saeed@fayshaa.com'),
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  NULL
WHERE EXISTS (SELECT 1 FROM employees WHERE email = 'nora.abdullah@fayshaa.com');

-- Display summary
DO $$
DECLARE
  job_count INT;
  app_count INT;
  emp_count INT;
  att_count INT;
  leave_count INT;
  dept_count INT;
  leave_type_count INT;
BEGIN
  SELECT COUNT(*) INTO job_count FROM job_postings;
  SELECT COUNT(*) INTO app_count FROM job_applications;
  SELECT COUNT(*) INTO emp_count FROM employees;
  SELECT COUNT(*) INTO att_count FROM employee_attendance;
  SELECT COUNT(*) INTO leave_count FROM leave_requests;
  SELECT COUNT(*) INTO dept_count FROM departments;
  SELECT COUNT(*) INTO leave_type_count FROM leave_types;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '  HR System Seed Data Summary';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Departments: %', dept_count;
  RAISE NOTICE 'Leave Types: %', leave_type_count;
  RAISE NOTICE 'Job Postings: %', job_count;
  RAISE NOTICE 'Applications: %', app_count;
  RAISE NOTICE 'Employees: %', emp_count;
  RAISE NOTICE 'Attendance Records: %', att_count;
  RAISE NOTICE 'Leave Requests: %', leave_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
END $$;
