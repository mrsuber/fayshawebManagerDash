const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/testimonials');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'));
    }
  }
});

// PUBLIC ROUTES

/**
 * GET /api/feedback/testimonials
 * Get all approved testimonials for public display
 */
router.get('/testimonials', async (req, res) => {
  try {
    const { limit = 10, featured = false } = req.query;

    let query = `
      SELECT
        id, name, role, rating, testimonial_text, image_url,
        approved_at, created_at
      FROM feedback
      WHERE status = 'approved'
        AND allow_public_display = true
        AND testimonial_text IS NOT NULL
    `;

    const params = [];

    // Filter for featured testimonials only
    if (featured === 'true') {
      query += ' AND is_featured = true';
    }

    // Order by featured first, then most recent
    query += ' ORDER BY is_featured DESC, approved_at DESC';

    // Add limit
    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await db.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      testimonials: result.rows
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials'
    });
  }
});

/**
 * POST /api/feedback/submit
 * Submit new feedback (public endpoint)
 */
router.post('/submit', upload.single('profileImage'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      feedbackType = 'general',
      rating,
      testimonialText,
      role,
      allowPublicDisplay = 'false',
      whatWentWell,
      areasForImprovement,
      additionalComments
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // If testimonial type, require testimonial text and rating
    if (feedbackType === 'testimonial') {
      if (!testimonialText || !testimonialText.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Testimonial text is required for testimonials'
        });
      }
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating (1-5) is required for testimonials'
        });
      }
    }

    // Get image URL if file was uploaded
    let imageUrl = null;
    if (req.file) {
      // Create URL path for the uploaded file
      imageUrl = `/uploads/testimonials/${req.file.filename}`;
    }

    // Insert feedback
    const result = await db.query(
      `INSERT INTO feedback (
        name, email, phone, feedback_type, rating,
        testimonial_text, role, allow_public_display,
        what_went_well, areas_for_improvement, additional_comments,
        image_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
      RETURNING id, created_at`,
      [
        name.trim(),
        email?.trim() || null,
        phone?.trim() || null,
        feedbackType,
        rating || null,
        testimonialText?.trim() || null,
        role?.trim() || null,
        allowPublicDisplay === 'true',
        whatWentWell?.trim() || null,
        areasForImprovement?.trim() || null,
        additionalComments?.trim() || null,
        imageUrl
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We will review it shortly.',
      feedbackId: result.rows[0].id,
      submittedAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback. Please try again.'
    });
  }
});

// ADMIN ROUTES (require authentication)

/**
 * GET /api/feedback/admin/all
 * Get all feedback for admin dashboard
 */
router.get('/admin/all', authenticateToken, requireRole('superadmin', 'admin', 'manager'), async (req, res) => {
  try {
    const { status, feedbackType, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        f.*,
        u1.username as reviewed_by_username,
        u2.username as approved_by_username
      FROM feedback f
      LEFT JOIN users u1 ON f.reviewed_by = u1.id
      LEFT JOIN users u2 ON f.approved_by = u2.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by status
    if (status) {
      params.push(status);
      query += ` AND f.status = $${params.length}`;
    }

    // Filter by feedback type
    if (feedbackType) {
      params.push(feedbackType);
      query += ` AND f.feedback_type = $${params.length}`;
    }

    // Order by newest first, pending first
    query += ` ORDER BY
      CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END,
      f.created_at DESC
    `;

    // Add pagination
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM feedback WHERE 1=1` +
      (status ? ` AND status = '${status}'` : '') +
      (feedbackType ? ` AND feedback_type = '${feedbackType}'` : '');
    const countResult = await db.query(countQuery);

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].total),
      feedback: result.rows
    });
  } catch (error) {
    console.error('Error fetching feedback for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback'
    });
  }
});

/**
 * GET /api/feedback/admin/stats
 * Get feedback statistics for admin dashboard
 */
router.get('/admin/stats', authenticateToken, requireRole('superadmin', 'admin', 'manager'), async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE feedback_type = 'testimonial') as testimonials,
        COUNT(*) FILTER (WHERE feedback_type = 'general') as general_feedback,
        COUNT(*) FILTER (WHERE feedback_type = 'suggestion') as suggestions,
        COUNT(*) FILTER (WHERE feedback_type = 'complaint') as complaints,
        ROUND(AVG(rating), 2) as average_rating
      FROM feedback
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * PUT /api/feedback/admin/:id/status
 * Update feedback status (review, approve, reject)
 */
router.put('/admin/:id/status', authenticateToken, requireRole('superadmin', 'admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, isFeatured } = req.body;
    const adminId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'reviewed', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, reviewed, approved, or rejected'
      });
    }

    let updateQuery = `
      UPDATE feedback
      SET status = $1,
          admin_notes = $2,
          is_featured = $3,
    `;

    const params = [status, adminNotes || null, isFeatured || false];

    // Set reviewed_by and reviewed_at if status is reviewed or higher
    if (status === 'reviewed') {
      params.push(adminId);
      updateQuery += `reviewed_by = $${params.length}, reviewed_at = CURRENT_TIMESTAMP,`;
    }

    // Set approved_by and approved_at if status is approved
    if (status === 'approved') {
      params.push(adminId);
      updateQuery += `
        reviewed_by = COALESCE(reviewed_by, $${params.length}),
        reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
        approved_by = $${params.length},
        approved_at = CURRENT_TIMESTAMP,
      `;
    }

    // Remove trailing comma and add WHERE clause
    updateQuery = updateQuery.slice(0, -1);
    params.push(id);
    updateQuery += ` WHERE id = $${params.length} RETURNING *`;

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      message: `Feedback ${status} successfully`,
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback status'
    });
  }
});

/**
 * PUT /api/feedback/admin/:id
 * Edit feedback content (admin only)
 */
router.put('/admin/:id', authenticateToken, requireRole('superadmin', 'admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      testimonialText,
      rating,
      adminNotes
    } = req.body;

    const result = await db.query(
      `UPDATE feedback
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           testimonial_text = COALESCE($3, testimonial_text),
           rating = COALESCE($4, rating),
           admin_notes = COALESCE($5, admin_notes)
       WHERE id = $6
       RETURNING *`,
      [name, role, testimonialText, rating, adminNotes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback'
    });
  }
});

/**
 * DELETE /api/feedback/admin/:id
 * Delete feedback (admin only)
 */
router.delete('/admin/:id', authenticateToken, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM feedback WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback'
    });
  }
});

module.exports = router;
