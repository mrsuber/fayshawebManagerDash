const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// ============================================

// Generate employee number
const generateEmployeeNumber = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM employees WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const sequence = parseInt(result.rows[0].count) + 1;
  return `EMP-${year}-${String(sequence).padStart(4, '0')}`;
};

// Create new employee
router.post('/', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const {
      first_name, last_name, email, phone, date_of_birth, gender, address,
      job_title, employment_type, hire_date, department_id, category_id,
      requires_keycard, keycard_number, can_work_remotely, default_shift,
      salary_amount, salary_period, reports_to,
      create_user_account, password
    } = req.body;

    // Generate employee number
    const employee_number = await generateEmployeeNumber();

    let user_id = null;

    // Create user account if requested
    if (create_user_account) {
      const username = email.split('@')[0];
      const password_hash = await bcrypt.hash(password || 'employee123', 10);

      // Get employee role
      const roleResult = await client.query("SELECT id FROM roles WHERE name = 'employee'");
      const role_id = roleResult.rows[0]?.id;

      const userResult = await client.query(`
        INSERT INTO users (
          email, username, password_hash, full_name, role_id, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING id
      `, [email, username, password_hash, `${first_name} ${last_name}`, role_id]);

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
      credentials: create_user_account ? {
        email,
        password: password || 'employee123'
      } : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
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
    const {
      first_name, last_name, email, phone, date_of_birth, gender, address,
      job_title, employment_type, department_id, category_id,
      requires_keycard, keycard_number, can_work_remotely, default_shift,
      salary_amount, salary_period, reports_to, status
    } = req.body;

    const result = await pool.query(`
      UPDATE employees SET
        first_name = $1,
        last_name = $2,
        email = $3,
        phone = $4,
        date_of_birth = $5,
        gender = $6,
        address = $7,
        job_title = $8,
        employment_type = $9,
        department_id = $10,
        category_id = $11,
        requires_keycard = $12,
        keycard_number = $13,
        can_work_remotely = $14,
        default_shift = $15,
        salary_amount = $16,
        salary_period = $17,
        reports_to = $18,
        status = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `, [
      first_name, last_name, email, phone, date_of_birth, gender, address,
      job_title, employment_type, department_id, category_id,
      requires_keycard, keycard_number, can_work_remotely, default_shift,
      salary_amount, salary_period, reports_to, status, id
    ]);

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
