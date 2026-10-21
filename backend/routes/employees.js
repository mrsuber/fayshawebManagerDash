const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// ============================================

const EDITABLE = [
  'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender', 'address', 'job_title', 'employment_type', 'hire_date',
  'department_id', 'category_id', 'requires_keycard', 'keycard_number', 'can_work_remotely', 'default_shift', 'salary_amount',
  'salary_period', 'reports_to', 'status'
];
/** Form fields arrive as '' when left empty: store NULL instead. */
const blank = (v) => (v === '' ? null : v);

// Generate employee number
const generateEmployeeNumber = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `SELECT COALESCE(MAX(substring(employee_number FROM '(\\d+)$')::int), 0) AS last
       FROM employees WHERE employee_number LIKE $1`,
    [`EMP-${year}-%`]
  );
  const sequence = result.rows[0].last + 1;
  return `EMP-${year}-${String(sequence).padStart(4, '0')}`;
};

// Create new employee
router.post('/', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const body = Object.fromEntries(Object.entries(req.body || {}).map(([k, v]) => [k, blank(v)]));
    const {
      first_name, last_name, email, phone, date_of_birth, gender, address,
      job_title, employment_type, hire_date, department_id, category_id,
      requires_keycard, keycard_number, can_work_remotely, default_shift,
      salary_amount, salary_period, reports_to,
      create_user_account, password
    } = body;

    // Generate employee number
    const employee_number = await generateEmployeeNumber();

    let user_id = null;

    if (!first_name || !last_name || !email || !job_title || !employment_type || !hire_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'First name, last name, email, job title, employment type and hire date are required' });
    }

    // A sign-in for the employee: staff role, a one-time password they must change on first sign-in.
    let temporaryPassword = null;
    if (create_user_account) {
      temporaryPassword = password || crypto.randomBytes(9).toString('base64url');
      const roleResult = await client.query("SELECT id FROM roles WHERE name = 'staff'");
      const userResult = await client.query(`
        INSERT INTO users (
          email, username, password_hash, full_name, role_id, status, job_title,
          is_password_temporary, must_change_password, email_verified, created_by
        ) VALUES ($1, $1, $2, $3, $4, 'active', $5, true, true, true, $6)
        RETURNING id
      `, [email.toLowerCase(), await bcrypt.hash(temporaryPassword, 10), `${first_name} ${last_name}`, roleResult.rows[0].id, job_title, req.user.id]);

      user_id = userResult.rows[0].id;
    }

    // Create employee record
    const result = await client.query(`
      INSERT INTO employees (
        user_id, employee_number, first_name, last_name, email, phone,
        date_of_birth, gender, address, job_title, employment_type, hire_date,
        department_id, category_id, requires_keycard, keycard_number,
        can_work_remotely, default_shift, salary_amount, salary_period,
        reports_to, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'active', $22)
      RETURNING *
    `, [
      user_id, employee_number, first_name, last_name, email, phone,
      date_of_birth, gender, address, job_title, employment_type, hire_date,
      department_id, category_id, requires_keycard, keycard_number,
      can_work_remotely, default_shift, salary_amount, salary_period,
      reports_to, req.user?.id || null
    ]);

    const employee = result.rows[0];

    // Initialize leave balances for current year
    const year = new Date().getFullYear();
    const leaveTypes = await client.query('SELECT * FROM leave_types WHERE is_active = true');

    for (const leaveType of leaveTypes.rows) {
      await client.query(`
        INSERT INTO employee_leave_balance (
          employee_id, leave_type_id, year, total_days, remaining_days
        ) VALUES ($1, $2, $3, $4, $4)
      `, [employee.id, leaveType.id, year, leaveType.days_per_year]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Employee created successfully',
      employee,
      // Shown once to whoever created the account; it must be changed at first sign-in.
      credentials: temporaryPassword ? { email, password: temporaryPassword } : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'An employee or account with this email already exists' });
    }
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get all employees
router.get('/', async (req, res) => {
  try {
    const { status, department_id, category_id, search } = req.query;

    let query = `
      SELECT
        e.*,
        d.name as department_name,
        ec.display_name as category_name,
        m.first_name || ' ' || m.last_name as manager_name,
        u.email as user_email
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      LEFT JOIN employees m ON e.reports_to = m.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.is_active = true
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND e.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (department_id) {
      query += ` AND e.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (category_id) {
      query += ` AND e.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (search) {
      query += ` AND (e.first_name ILIKE $${paramCount} OR e.last_name ILIKE $${paramCount} OR e.email ILIKE $${paramCount} OR e.employee_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      employees: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Get employee by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        e.*,
        d.name as department_name,
        ec.display_name as category_name,
        m.first_name || ' ' || m.last_name as manager_name,
        u.email as user_email,
        u.id as user_id
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      LEFT JOIN employees m ON e.reports_to = m.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get leave balances
    const leaveBalances = await pool.query(`
      SELECT
        lb.*,
        lt.name as leave_type_name
      FROM employee_leave_balance lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [id]);

    res.json({
      success: true,
      employee: {
        ...result.rows[0],
        leave_balances: leaveBalances.rows
      }
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message
    });
  }
});

// Update employee
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Only the fields sent are changed; blank form fields clear optional values.
    const values = {};
    for (const field of EDITABLE) if (req.body[field] !== undefined) values[field] = blank(req.body[field]);
    for (const field of ['first_name', 'last_name', 'email', 'job_title', 'employment_type']) {
      if (field in values && !values[field]) return res.status(400).json({ success: false, message: `${field.replace('_', ' ')} cannot be empty` });
    }
    const fields = Object.keys(values);
    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    const result = await pool.query(
      `UPDATE employees SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1} RETURNING *`,
      [...fields.map((f) => values[f]), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Another employee already has that email or keycard' });
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
});

// Terminate employee
router.post('/:id/terminate', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { termination_date, reason } = req.body;

    // Update employee status
    const result = await client.query(`
      UPDATE employees SET
        status = 'terminated',
        termination_date = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [termination_date || new Date(), id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Deactivate user account if exists
    if (result.rows[0].user_id) {
      await client.query(
        "UPDATE users SET status = 'inactive' WHERE id = $1",
        [result.rows[0].user_id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Employee terminated successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error terminating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to terminate employee',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get employee dashboard stats
router.get('/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee info
    const employee = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (employee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get attendance stats for current month
    const attendanceStats = await pool.query(`
      SELECT
        COUNT(*) as days_worked,
        SUM(total_hours) as total_hours,
        SUM(overtime_hours) as overtime_hours
      FROM employee_attendance
      WHERE employee_id = $1
        AND EXTRACT(MONTH FROM clock_in_time) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM clock_in_time) = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [id]);

    // Get leave balance
    const leaveBalance = await pool.query(`
      SELECT
        SUM(remaining_days) as total_remaining_days
      FROM employee_leave_balance
      WHERE employee_id = $1
        AND year = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [id]);

    // Get pending leave requests
    const pendingLeave = await pool.query(`
      SELECT COUNT(*) as pending_requests
      FROM leave_requests
      WHERE employee_id = $1 AND status = 'pending'
    `, [id]);

    // Get unread notifications
    const notifications = await pool.query(`
      SELECT COUNT(*) as unread_notifications
      FROM employee_notifications
      WHERE employee_id = $1 AND is_read = false
    `, [id]);

    res.json({
      success: true,
      stats: {
        days_worked: parseInt(attendanceStats.rows[0].days_worked || 0),
        total_hours: parseFloat(attendanceStats.rows[0].total_hours || 0),
        overtime_hours: parseFloat(attendanceStats.rows[0].overtime_hours || 0),
        leave_days_remaining: parseFloat(leaveBalance.rows[0].total_remaining_days || 0),
        pending_leave_requests: parseInt(pendingLeave.rows[0].pending_requests || 0),
        unread_notifications: parseInt(notifications.rows[0].unread_notifications || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching employee dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee dashboard',
      error: error.message
    });
  }
});

module.exports = router;
