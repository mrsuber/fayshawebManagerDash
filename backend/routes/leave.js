const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// ============================================
// LEAVE MANAGEMENT ENDPOINTS
// ============================================

// Submit leave request
router.post('/request', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const {
      employee_id, leave_type_id, start_date, end_date, reason
    } = req.body;

    // Calculate number of days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const numberOfDays = (end - start) / (1000 * 60 * 60 * 24) + 1;

    // Check leave balance
    const year = new Date().getFullYear();
    const balanceResult = await client.query(`
      SELECT * FROM employee_leave_balance
      WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
    `, [employee_id, leave_type_id, year]);

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Leave balance not found for this employee'
      });
    }

    const balance = balanceResult.rows[0];

    if (parseFloat(balance.remaining_days) < numberOfDays) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${balance.remaining_days} days remaining.`
      });
    }

    // Check for overlapping leave requests
    const overlapCheck = await client.query(`
      SELECT * FROM leave_requests
      WHERE employee_id = $1
        AND status NOT IN ('rejected', 'cancelled')
        AND (
          (start_date <= $2 AND end_date >= $2) OR
          (start_date <= $3 AND end_date >= $3) OR
          (start_date >= $2 AND end_date <= $3)
        )
    `, [employee_id, start_date, end_date]);

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You have an overlapping leave request for these dates'
      });
    }

    // Create leave request
    const result = await client.query(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date,
        number_of_days, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [employee_id, leave_type_id, start_date, end_date, numberOfDays, reason]);

    // Send notification to manager
    const employee = await client.query(
      'SELECT reports_to, first_name, last_name FROM employees WHERE id = $1',
      [employee_id]
    );

    if (employee.rows[0].reports_to) {
      await client.query(`
        INSERT INTO employee_notifications (
          employee_id, title, message, type, priority
        ) VALUES ($1, $2, $3, 'leave_request', 'normal')
      `, [
        employee.rows[0].reports_to,
        'New Leave Request',
        `${employee.rows[0].first_name} ${employee.rows[0].last_name} has requested leave from ${start_date} to ${end_date}`
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Leave request submitted successfully',
      leave_request: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit leave request',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get employee's leave requests
router.get('/my-requests', async (req, res) => {
  try {
    const { employee_id, status } = req.query;

    let query = `
      SELECT
        lr.*,
        lt.name as leave_type_name,
        u.full_name as approved_by_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users u ON lr.approved_by = u.id
      WHERE lr.employee_id = $1
    `;

    const params = [employee_id];
    let paramCount = 2;

    if (status) {
      query += ` AND lr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY lr.requested_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      requests: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
});

// Get pending leave requests (for managers/admin)
router.get('/pending', async (req, res) => {
  try {
    const { department_id } = req.query;

    let query = `
      SELECT
        lr.*,
        lt.name as leave_type_name,
        e.first_name,
        e.last_name,
        e.employee_number,
        e.job_title,
        d.name as department_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE lr.status = 'pending'
    `;

    const params = [];
    let paramCount = 1;

    if (department_id) {
      query += ` AND e.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    query += ` ORDER BY lr.requested_at ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      requests: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching pending leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending leave requests',
      error: error.message
    });
  }
});

// Approve leave request
router.put('/:id/approve', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { approved_by } = req.body;

    // Get leave request details
    const leaveRequest = await client.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (leaveRequest.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const leave = leaveRequest.rows[0];

    // Update leave request status
    await client.query(`
      UPDATE leave_requests SET
        status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [approved_by, id]);

    // Update leave balance
    const year = new Date().getFullYear();
    await client.query(`
      UPDATE employee_leave_balance SET
        used_days = used_days + $1,
        remaining_days = remaining_days - $1
      WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
    `, [leave.number_of_days, leave.employee_id, leave.leave_type_id, year]);

    // Send notification to employee
    await client.query(`
      INSERT INTO employee_notifications (
        employee_id, title, message, type, priority, sent_by
      ) VALUES ($1, $2, $3, 'leave_approved', 'normal', $4)
    `, [
      leave.employee_id,
      'Leave Request Approved',
      `Your leave request from ${leave.start_date} to ${leave.end_date} has been approved.`,
      approved_by
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Leave request approved successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve leave request',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Reject leave request
router.put('/:id/reject', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rejection_reason, approved_by } = req.body;

    // Get leave request details
    const leaveRequest = await client.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (leaveRequest.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const leave = leaveRequest.rows[0];

    // Update leave request status
    await client.query(`
      UPDATE leave_requests SET
        status = 'rejected',
        rejection_reason = $1,
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [rejection_reason, approved_by, id]);

    // Send notification to employee
    await client.query(`
      INSERT INTO employee_notifications (
        employee_id, title, message, type, priority, sent_by
      ) VALUES ($1, $2, $3, 'leave_rejected', 'normal', $4)
    `, [
      leave.employee_id,
      'Leave Request Rejected',
      `Your leave request from ${leave.start_date} to ${leave.end_date} has been rejected. Reason: ${rejection_reason}`,
      approved_by
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Leave request rejected'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject leave request',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Cancel leave request (employee)
router.put('/:id/cancel', async (req, res) => {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { employee_id } = req.body;

    // Get leave request
    const leaveRequest = await client.query(
      'SELECT * FROM leave_requests WHERE id = $1 AND employee_id = $2',
      [id, employee_id]
    );

    if (leaveRequest.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const leave = leaveRequest.rows[0];

    if (leave.status === 'approved') {
      // If already approved, restore the leave balance
      const year = new Date().getFullYear();
      await client.query(`
        UPDATE employee_leave_balance SET
          used_days = used_days - $1,
          remaining_days = remaining_days + $1
        WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
      `, [leave.number_of_days, leave.employee_id, leave.leave_type_id, year]);
    }

    // Update leave request status
    await client.query(
      "UPDATE leave_requests SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Leave request cancelled successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel leave request',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get leave balance
router.get('/balance', async (req, res) => {
  try {
    const { employee_id } = req.query;
    const year = req.query.year || new Date().getFullYear();

    const result = await pool.query(`
      SELECT
        lb.*,
        lt.name as leave_type_name,
        lt.is_paid
      FROM employee_leave_balance lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.year = $2
      ORDER BY lt.name
    `, [employee_id, year]);

    res.json({
      success: true,
      balances: result.rows
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance',
      error: error.message
    });
  }
});

// Get leave types
router.get('/types', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_types WHERE is_active = true ORDER BY name'
    );

    res.json({
      success: true,
      leave_types: result.rows
    });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave types',
      error: error.message
    });
  }
});

// Get leave calendar/schedule
router.get('/calendar', async (req, res) => {
  try {
    const { start_date, end_date, department_id } = req.query;

    let query = `
      SELECT
        lr.*,
        lt.name as leave_type_name,
        e.first_name,
        e.last_name,
        e.employee_number,
        d.name as department_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE lr.status = 'approved'
    `;

    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND lr.end_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND lr.start_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (department_id) {
      query += ` AND e.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    query += ` ORDER BY lr.start_date`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      leave_calendar: result.rows
    });
  } catch (error) {
    console.error('Error fetching leave calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave calendar',
      error: error.message
    });
  }
});

module.exports = router;
