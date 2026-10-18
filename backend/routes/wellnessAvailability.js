const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole, STAFF_ROLES } = require('../middleware/auth');

const requireAdmin = requireRole(...STAFF_ROLES);

// ============================================
// WELLNESS JOURNEY AVAILABILITY MANAGEMENT
// ============================================

/**
 * Get all availability slots with filters
 * Query params: journey_id, date_from, date_to, is_available
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { journey_id, date_from, date_to, is_available } = req.query;

    let query = `
      SELECT
        a.*,
        j.name as journey_name,
        j.category as journey_category,
        (a.max_capacity - a.current_bookings) as available_slots
      FROM wellness_journey_availability a
      JOIN wellness_journeys j ON a.journey_id = j.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (journey_id) {
      query += ` AND a.journey_id = $${paramCount}`;
      params.push(journey_id);
      paramCount++;
    }

    if (date_from) {
      query += ` AND a.available_date >= $${paramCount}`;
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      query += ` AND a.available_date <= $${paramCount}`;
      params.push(date_to);
      paramCount++;
    }

    if (is_available !== undefined) {
      query += ` AND a.is_available = $${paramCount}`;
      params.push(is_available === 'true');
      paramCount++;
    }

    query += ` ORDER BY a.available_date ASC, a.start_time ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      availability: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability slots'
    });
  }
});

/**
 * Get single availability slot
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        j.name as journey_name,
        j.category as journey_category
      FROM wellness_journey_availability a
      JOIN wellness_journeys j ON a.journey_id = j.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Availability slot not found'
      });
    }

    res.json({
      success: true,
      availability: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching availability slot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability slot'
    });
  }
});

/**
 * Create new availability slot(s)
 * Can create single slot or bulk create for multiple dates
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      journey_id,
      start_date,
      end_date, // Optional - for bulk creation
      start_time,
      end_time,
      max_capacity = 3,
      notes = null,
      days_of_week = null // Optional - array like [1,2,3,4,5] for Mon-Fri
    } = req.body;

    if (!journey_id || !start_date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: journey_id, start_date, start_time, end_time'
      });
    }

    // Verify journey exists
    const journeyCheck = await client.query(
      'SELECT id FROM wellness_journeys WHERE id = $1',
      [journey_id]
    );

    if (journeyCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Wellness journey not found'
      });
    }

    const created = [];

    // If end_date is provided, create slots for date range
    if (end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);

      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        // If days_of_week filter is provided, check if current day matches
        if (days_of_week && !days_of_week.includes(date.getDay())) {
          continue;
        }

        const dateStr = date.toISOString().split('T')[0];

        const result = await client.query(`
          INSERT INTO wellness_journey_availability
          (journey_id, available_date, start_time, end_time, max_capacity, current_bookings, is_available, notes)
          VALUES ($1, $2, $3, $4, $5, 0, true, $6)
          ON CONFLICT (journey_id, available_date, start_time) DO NOTHING
          RETURNING *
        `, [journey_id, dateStr, start_time, end_time, max_capacity, notes]);

        if (result.rows.length > 0) {
          created.push(result.rows[0]);
        }
      }
    } else {
      // Create single slot
      const result = await client.query(`
        INSERT INTO wellness_journey_availability
        (journey_id, available_date, start_time, end_time, max_capacity, current_bookings, is_available, notes)
        VALUES ($1, $2, $3, $4, $5, 0, true, $6)
        RETURNING *
      `, [journey_id, start_date, start_time, end_time, max_capacity, notes]);

      created.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Created ${created.length} availability slot(s)`,
      availability: created,
      count: created.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating availability:', error);

    if (error.code === '23505') { // Unique violation
      res.status(409).json({
        success: false,
        error: 'Availability slot already exists for this journey, date, and time'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create availability slot'
      });
    }
  } finally {
    client.release();
  }
});

/**
 * Update availability slot
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      available_date,
      start_time,
      end_time,
      max_capacity,
      is_available,
      notes
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (available_date !== undefined) {
      updates.push(`available_date = $${paramCount}`);
      values.push(available_date);
      paramCount++;
    }
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramCount}`);
      values.push(start_time);
      paramCount++;
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramCount}`);
      values.push(end_time);
      paramCount++;
    }
    if (max_capacity !== undefined) {
      updates.push(`max_capacity = $${paramCount}`);
      values.push(max_capacity);
      paramCount++;
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCount}`);
      values.push(is_available);
      paramCount++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      values.push(notes);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);
    const query = `
      UPDATE wellness_journey_availability
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Availability slot not found'
      });
    }

    res.json({
      success: true,
      availability: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability slot'
    });
  }
});

/**
 * Delete availability slot
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are any bookings for this slot
    const bookingCheck = await pool.query(`
      SELECT COUNT(*) FROM wellness_journey_bookings
      WHERE journey_id = (SELECT journey_id FROM wellness_journey_availability WHERE id = $1)
        AND booking_date = (SELECT available_date FROM wellness_journey_availability WHERE id = $1)
        AND start_time = (SELECT start_time FROM wellness_journey_availability WHERE id = $1)
        AND status IN ('upcoming', 'in_progress')
    `, [id]);

    if (parseInt(bookingCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete availability slot with active bookings'
      });
    }

    const result = await pool.query(
      'DELETE FROM wellness_journey_availability WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Availability slot not found'
      });
    }

    res.json({
      success: true,
      message: 'Availability slot deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete availability slot'
    });
  }
});

/**
 * Bulk delete availability slots
 */
router.post('/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No IDs provided'
      });
    }

    // Check for active bookings
    const bookingCheck = await client.query(`
      SELECT COUNT(*) FROM wellness_journey_bookings wb
      JOIN wellness_journey_availability wa ON
        wb.journey_id = wa.journey_id AND
        wb.booking_date = wa.available_date AND
        wb.start_time = wa.start_time
      WHERE wa.id = ANY($1)
        AND wb.status IN ('upcoming', 'in_progress')
    `, [ids]);

    if (parseInt(bookingCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete availability slots with active bookings'
      });
    }

    const result = await client.query(
      'DELETE FROM wellness_journey_availability WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Deleted ${result.rows.length} availability slot(s)`,
      deleted_count: result.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk deleting availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete availability slots'
    });
  } finally {
    client.release();
  }
});

/**
 * Get availability statistics
 */
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_slots,
        COUNT(*) FILTER (WHERE is_available = true AND (max_capacity - current_bookings) > 0) as available_slots,
        COUNT(*) FILTER (WHERE current_bookings >= max_capacity) as fully_booked_slots,
        COUNT(*) FILTER (WHERE is_available = false) as disabled_slots,
        SUM(max_capacity) as total_capacity,
        SUM(current_bookings) as total_bookings,
        COUNT(DISTINCT journey_id) as journeys_with_availability,
        COUNT(DISTINCT available_date) as dates_with_availability
      FROM wellness_journey_availability
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching availability stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability statistics'
    });
  }
});

module.exports = router;
