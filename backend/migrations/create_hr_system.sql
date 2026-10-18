-- ============================================
-- FAYSHAA HR & PEOPLE MANAGEMENT SYSTEM
-- Database Schema Migration
-- ============================================

-- ============================================
-- 1. DEPARTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. EMPLOYEE TYPES & CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS employee_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- 'manager', 'cleaner', 'security', 'engineer', 'receptionist', etc.
  display_name VARCHAR(100) NOT NULL,
  requires_keycard BOOLEAN DEFAULT false,
  requires_clock_in BOOLEAN DEFAULT true,
  can_work_remotely BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  employee_number VARCHAR(20) UNIQUE NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  category_id INTEGER REFERENCES employee_categories(id),

  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(20),
  address TEXT,

  -- Employment Details
  job_title VARCHAR(100) NOT NULL,
  employment_type VARCHAR(50) NOT NULL, -- 'full-time', 'part-time', 'contract', 'intern'
  hire_date DATE NOT NULL,
  termination_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'on_leave', 'suspended', 'terminated'

  -- Work Configuration
  requires_keycard BOOLEAN DEFAULT false,
  keycard_number VARCHAR(50) UNIQUE,
  can_work_remotely BOOLEAN DEFAULT false,
  default_shift VARCHAR(50), -- 'morning', 'afternoon', 'night', 'flexible'

  -- Compensation
  salary_amount DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'XAF',
  salary_period VARCHAR(20) DEFAULT 'monthly', -- 'hourly', 'daily', 'monthly'

  -- Manager & Reporting
  reports_to INTEGER REFERENCES employees(id),

  -- System Fields
  profile_picture VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- ============================================
-- 4. JOB POSTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  category_id INTEGER REFERENCES employee_categories(id),

  -- Job Details
  description TEXT NOT NULL,
  responsibilities TEXT,
  requirements TEXT,
  qualifications TEXT,

  -- Employment Details
  employment_type VARCHAR(50) NOT NULL, -- 'full-time', 'part-time', 'contract'
  location VARCHAR(100),
  salary_range_min DECIMAL(12, 2),
  salary_range_max DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'XAF',

  -- Posting Details
  posted_date DATE DEFAULT CURRENT_DATE,
  closing_date DATE,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed', 'filled', 'cancelled'
  number_of_positions INTEGER DEFAULT 1,

  -- System Fields
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. JOB APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_applications (
  id SERIAL PRIMARY KEY,
  job_posting_id INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,

  -- Applicant Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,

  -- Application Documents
  cv_file_path VARCHAR(255) NOT NULL,
  cover_letter_file_path VARCHAR(255),
  additional_documents TEXT, -- JSON array of file paths

  -- Application Details
  cover_letter_text TEXT,
  expected_salary DECIMAL(12, 2),
  available_start_date DATE,

  -- Application Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'shortlisted', 'interviewed', 'rejected', 'hired'
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- System Fields
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. EMPLOYEE ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employee_attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,

  -- Clock In/Out
  clock_in_time TIMESTAMP NOT NULL,
  clock_out_time TIMESTAMP,

  -- Location & Method
  clock_in_method VARCHAR(50) NOT NULL, -- 'keycard', 'manual', 'mobile', 'biometric'
  clock_out_method VARCHAR(50),
  clock_in_location VARCHAR(100), -- 'main_office', 'remote', 'building_a', etc.
  clock_out_location VARCHAR(100),

  -- Calculated Fields
  total_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2) DEFAULT 0,

  -- Status & Notes
  status VARCHAR(50) DEFAULT 'present', -- 'present', 'late', 'half_day', 'absent'
  notes TEXT,

  -- Approval
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. LEAVE TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_types (
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

-- ============================================
-- 8. EMPLOYEE LEAVE BALANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employee_leave_balance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL,
  used_days DECIMAL(5, 2) DEFAULT 0,
  remaining_days DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_type_id, year)
);

-- ============================================
-- 9. LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id),

  -- Leave Details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days DECIMAL(5, 2) NOT NULL,
  reason TEXT NOT NULL,

  -- Approval Workflow
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- System Fields
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. EMPLOYEE NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employee_notifications (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,

  -- Notification Content
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'leave_approved', 'leave_rejected', 'announcement', etc.
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

  -- Metadata
  sent_by INTEGER REFERENCES users(id),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  -- System Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. EMPLOYEE DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,

  -- Document Details
  document_type VARCHAR(100) NOT NULL, -- 'contract', 'id_card', 'certificate', 'performance_review', etc.
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,

  -- Metadata
  uploaded_by INTEGER REFERENCES users(id),
  expiry_date DATE,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default Employee Categories
INSERT INTO employee_categories (name, display_name, requires_keycard, requires_clock_in, can_work_remotely) VALUES
('manager', 'Manager', false, false, true),
('cleaner', 'Cleaner', true, true, false),
('security', 'Security Guard', true, true, false),
('receptionist', 'Receptionist', true, true, false),
('engineer', 'Software Engineer', false, false, true),
('maintenance', 'Maintenance Staff', true, true, false),
('accountant', 'Accountant', false, true, true),
('hr', 'HR Personnel', false, true, true)
ON CONFLICT (name) DO NOTHING;

-- Default Leave Types
INSERT INTO leave_types (name, description, days_per_year, requires_approval, is_paid) VALUES
('Annual Leave', 'Paid annual vacation leave', 21, true, true),
('Sick Leave', 'Medical leave for illness', 10, true, true),
('Casual Leave', 'Short-term personal leave', 5, true, true),
('Maternity Leave', 'Maternity leave for mothers', 90, true, true),
('Paternity Leave', 'Paternity leave for fathers', 7, true, true),
('Unpaid Leave', 'Leave without pay', 0, true, false),
('Emergency Leave', 'Emergency situations', 3, true, true),
('Bereavement Leave', 'Family bereavement', 5, true, true)
ON CONFLICT (name) DO NOTHING;

-- Default Departments
INSERT INTO departments (name, description, is_active) VALUES
('Administration', 'Administrative and management staff', true),
('Housekeeping', 'Cleaning and maintenance staff', true),
('Security', 'Security personnel', true),
('Technology', 'IT and software development', true),
('Guest Services', 'Reception and guest relations', true),
('Finance', 'Accounting and finance', true),
('Human Resources', 'HR and people management', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_notifications_employee ON employee_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_notifications_read ON employee_notifications(is_read);

-- ============================================
-- CREATE TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANTS (if needed for specific database user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fayshaa_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fayshaa_app;
