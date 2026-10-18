const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// ============================================
// ATTENDANCE & TIME TRACKING ENDPOINTS
// ============================================

// Clock in
router.post('/clock-in', async (req, res) => {
  try {
    const {
      employee_id, keycard_number, method, location
    } = req.body;

    let employeeId = employee_id;

    // If keycard is used, find employee by keycard
    if (method === 'keycard' && keycard_number) {
      const employeeResult = await pool.query(
        'SELECT id FROM employees WHERE keycard_number = $1 AND is_active = true',
        [keycard_number]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invalid keycard number'
        });
      }

      employeeId = employeeResult.rows[0].id;
    }

    // Check if already clocked in today
    const existingClock = await pool.query(`
      SELECT * FROM employee_attendance
      WHERE employee_id = $1
        AND DATE(clock_in_time) = CURRENT_DATE
        AND clock_out_time IS NULL
    `, [employeeId]);

    if (existingClock.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in. Please clock out first.',
        attendance: existingClock.rows[0]
      });
    }

    // Create clock-in record
    const result = await pool.query(`
      INSERT INTO employee_attendance (
        employee_id, clock_in_time, clock_in_method, clock_in_location, status
      ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, 'present')
      RETURNING *
    `, [employeeId, method || 'manual', location || 'main_office']);

    // Get employee details
    const employee = await pool.query(
      'SELECT first_name, last_name, employee_number FROM employees WHERE id = $1',
      [employeeId]
    );

    res.json({
      success: true,
      message: `Clock in successful. Welcome ${employee.rows[0].first_name}!`,
      attendance: result.rows[0],
      employee: employee.rows[0]
    });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock in',
      error: error.message
    });
  }
});

// Clock out
router.post('/clock-out', async (req, res) => {
  try {
    const {
      employee_id, keycard_number, method, location, notes
    } = req.body;

    let employeeId = employee_id;

    // If keycard is used, find employee by keycard
    if (method === 'keycard' && keycard_number) {
      const employeeResult = await pool.query(
        'SELECT id FROM employees WHERE keycard_number = $1 AND is_active = true',
        [keycard_number]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invalid keycard number'
        });
      }

      employeeId = employeeResult.rows[0].id;
    }

    // Find today's clock-in record
    const clockInRecord = await pool.query(`
      SELECT * FROM employee_attendance
      WHERE employee_id = $1
        AND DATE(clock_in_time) = CURRENT_DATE
        AND clock_out_time IS NULL
      ORDER BY clock_in_time DESC
      LIMIT 1
    `, [employeeId]);

    if (clockInRecord.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No clock-in record found for today'
      });
    }

    const clockInTime = new Date(clockInRecord.rows[0].clock_in_time);
    const clockOutTime = new Date();
    const totalHours = (clockOutTime - clockInTime) / (1000 * 60 * 60);

    // Calculate overtime (assuming 8 hours is standard)
    const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;

    // Update clock-out record
    const result = await pool.query(`
      UPDATE employee_attendance SET
        clock_out_time = CURRENT_TIMESTAMP,
        clock_out_method = $1,
        clock_out_location = $2,
        total_hours = $3,
        overtime_hours = $4,
        notes = $5
      WHERE id = $6
      RETURNING *
    `, [
      method || 'manual',
      location || 'main_office',
      totalHours.toFixed(2),
      overtimeHours.toFixed(2),
      notes,
      clockInRecord.rows[0].id
    ]);

    // Get employee details
    const employee = await pool.query(
      'SELECT first_name, last_name, employee_number FROM employees WHERE id = $1',
      [employeeId]
    );

    res.json({
      success: true,
      message: `Clock out successful. Goodbye ${employee.rows[0].first_name}!`,
      attendance: result.rows[0],
      employee: employee.rows[0],
      hours_worked: totalHours.toFixed(2)
    });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock out',
      error: error.message
    });
  }
});

// Get employee's attendance records
router.get('/my-records', async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;

    let query = `
      SELECT *
      FROM employee_attendance
      WHERE employee_id = $1
    `;

    const params = [employee_id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND DATE(clock_in_time) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND DATE(clock_in_time) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ` ORDER BY clock_in_time DESC`;

    const result = await pool.query(query, params);

    // Calculate totals
    const totals = await pool.query(`
      SELECT
        COUNT(*) as total_days,
        SUM(total_hours) as total_hours,
        SUM(overtime_hours) as total_overtime
      FROM employee_attendance
      WHERE employee_id = $1
        ${start_date ? 'AND DATE(clock_in_time) >= $2' : ''}
        ${end_date ? `AND DATE(clock_in_time) <= $${start_date ? '3' : '2'}` : ''}
    `, start_date || end_date ? [employee_id, start_date, end_date].filter(Boolean) : [employee_id]);

    res.json({
      success: true,
      records: result.rows,
      totals: {
        total_days: parseInt(totals.rows[0].total_days || 0),
        total_hours: parseFloat(totals.rows[0].total_hours || 0),
        total_overtime: parseFloat(totals.rows[0].total_overtime || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message
    });
  }
});

// Get specific employee's attendance (admin)
router.get('/employee/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, month, year } = req.query;

    let query = `
      SELECT
        a.*,
        e.first_name,
        e.last_name,
        e.employee_number
      FROM employee_attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = $1
    `;

    const params = [id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND DATE(a.clock_in_time) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND DATE(a.clock_in_time) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (month) {
      query += ` AND EXTRACT(MONTH FROM a.clock_in_time) = $${paramCount}`;
      params.push(month);
      paramCount++;
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM a.clock_in_time) = $${paramCount}`;
      params.push(year);
      paramCount++;
    }

    query += ` ORDER BY a.clock_in_time DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      records: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee attendance',
      error: error.message
    });
  }
});

// Get attendance report
router.get('/report', async (req, res) => {
  try {
    const { start_date, end_date, department_id } = req.query;

    let query = `
      SELECT
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.employee_number,
        e.job_title,
        d.name as department_name,
        COUNT(a.id) as days_present,
        SUM(a.total_hours) as total_hours,
        SUM(a.overtime_hours) as total_overtime
      FROM employees e
      LEFT JOIN employee_attendance a ON e.id = a.employee_id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true
    `;

    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND DATE(a.clock_in_time) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND DATE(a.clock_in_time) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (department_id) {
      query += ` AND e.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    query += `
      GROUP BY e.id, e.first_name, e.last_name, e.employee_number, e.job_title, d.name
      ORDER BY e.employee_number
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      report: result.rows
    });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report',
      error: error.message
    });
  }
});

// Get today's attendance summary
router.get('/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.employee_number,
        e.job_title,
        d.name as department_name,
        a.clock_in_time,
        a.clock_out_time,
        a.total_hours,
        a.status
      FROM employees e
      LEFT JOIN employee_attendance a ON e.id = a.employee_id
        AND DATE(a.clock_in_time) = CURRENT_DATE
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true AND e.status = 'active'
      ORDER BY a.clock_in_time DESC NULLS LAST
    `);

    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT a.employee_id) as present_count,
        (SELECT COUNT(*) FROM employees WHERE is_active = true AND status = 'active') as total_employees,
        SUM(CASE WHEN a.clock_out_time IS NULL THEN 1 ELSE 0 END) as currently_clocked_in
      FROM employee_attendance a
      WHERE DATE(a.clock_in_time) = CURRENT_DATE
    `);

    res.json({
      success: true,
      attendance: result.rows,
      stats: {
        present: parseInt(stats.rows[0].present_count || 0),
        total_employees: parseInt(stats.rows[0].total_employees || 0),
        currently_clocked_in: parseInt(stats.rows[0].currently_clocked_in || 0),
        absent: parseInt(stats.rows[0].total_employees || 0) - parseInt(stats.rows[0].present_count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s attendance',
      error: error.message
    });
  }
});

// Manual attendance entry (admin)
router.post('/manual-entry', async (req, res) => {
  try {
    const {
      employee_id, clock_in_time, clock_out_time, notes, approved_by
    } = req.body;

    const clockIn = new Date(clock_in_time);
    const clockOut = clock_out_time ? new Date(clock_out_time) : null;
    let totalHours = null;
    let overtimeHours = 0;

    if (clockOut) {
      totalHours = (clockOut - clockIn) / (1000 * 60 * 60);
      overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
    }

    const result = await pool.query(`
      INSERT INTO employee_attendance (
        employee_id, clock_in_time, clock_out_time, clock_in_method,
        total_hours, overtime_hours, notes, approved_by, approved_at, status
      ) VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, CURRENT_TIMESTAMP, 'present')
      RETURNING *
    `, [
      employee_id, clock_in_time, clock_out_time,
      totalHours ? totalHours.toFixed(2) : null,
      overtimeHours.toFixed(2), notes, approved_by
    ]);

    res.json({
      success: true,
      message: 'Manual attendance entry created successfully',
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating manual attendance entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create manual attendance entry',
      error: error.message
    });
  }
});

module.exports = router;
