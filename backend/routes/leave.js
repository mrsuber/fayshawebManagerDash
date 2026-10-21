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
// Leave requests across the team (HQ → HR → Leave). ?status=pending|approved|rejected|cancelled, ?department_id
const listRequests = async (req, res) => {
  try {
    const status = req.path === '/pending' ? 'pending' : req.query.status;
    const params = [];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`lr.status = $${params.length}`);
    }
    if (req.query.department_id) {
      params.push(req.query.department_id);
      where.push(`e.department_id = $${params.length}`);
    }
    const result = await pool.query(
      `SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.employee_number, e.job_title,
              d.name AS department_name, u.full_name AS approved_by_name
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         JOIN employees e ON lr.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN users u ON lr.approved_by = u.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${status === 'pending' ? 'lr.requested_at ASC' : 'lr.requested_at DESC'}`,
      params
    );
    res.json({ success: true, requests: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests' });
  }
};
router.get('/', listRequests);
router.get('/pending', listRequests);

const leaveError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Approves or rejects a pending leave request: updates it, adjusts the leave balance on approval and
 * notifies the employee. `userId` is the signed-in approver. Shared by these routes and HQ approvals.
 */
async function decideLeave(id, decision, userId, reason) {
  if (!['approved', 'rejected'].includes(decision)) throw leaveError(400, 'Decision must be approved or rejected');
  if (decision === 'rejected' && !reason) throw leaveError(400, 'A reason is required to reject leave');
  const client = await pool.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw leaveError(404, 'Leave request not found');
    const leave = rows[0];
    if (leave.status !== 'pending') throw leaveError(409, `This leave request is already ${leave.status}`);

    await client.query(
      `UPDATE leave_requests SET status = $1, rejection_reason = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
      [decision, decision === 'rejected' ? reason : null, userId, id]
    );

    if (decision === 'approved') {
      await client.query(`
        UPDATE employee_leave_balance SET
          used_days = used_days + $1,
          remaining_days = remaining_days - $1
        WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
      `, [leave.number_of_days, leave.employee_id, leave.leave_type_id, new Date(leave.start_date).getFullYear()]);
    }

    const start = new Date(leave.start_date).toISOString().slice(0, 10);
    const end = new Date(leave.end_date).toISOString().slice(0, 10);
    await client.query(`
      INSERT INTO employee_notifications (employee_id, title, message, type, priority, sent_by)
      VALUES ($1, $2, $3, $4, 'normal', $5)
    `, [
      leave.employee_id,
      decision === 'approved' ? 'Leave Request Approved' : 'Leave Request Rejected',
      decision === 'approved'
        ? `Your leave request from ${start} to ${end} has been approved.`
        : `Your leave request from ${start} to ${end} has been rejected. Reason: ${reason}`,
      decision === 'approved' ? 'leave_approved' : 'leave_rejected',
      userId
    ]);

    await client.query('COMMIT');
    return leave;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const decideRoute = (decision) => async (req, res) => {
  try {
    await decideLeave(req.params.id, decision, req.user.id, req.body.rejection_reason);
    res.json({ success: true, message: decision === 'approved' ? 'Leave request approved successfully' : 'Leave request rejected' });
  } catch (error) {
    console.error(`Error deciding leave request (${decision}):`, error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Failed to update leave request', error: error.message });
  }
};

// Approve / reject leave request (the approver is the signed-in user)
router.put('/:id/approve', decideRoute('approved'));
router.put('/:id/reject', decideRoute('rejected'));

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
module.exports.decideLeave = decideLeave;
