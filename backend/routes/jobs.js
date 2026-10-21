const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAreaByMethod } = require('../middleware/hq');

// Posting jobs and reviewing applications: super administrators, managers and HR roles.
const hrStaff = requireAreaByMethod('hr');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// CVs and cover letters are personal documents: they are kept outside the public uploads folder and only
// HR can download them (GET /applications/:id/files/:kind).
const APPLICATIONS_DIR = path.join(__dirname, '..', 'storage', 'applications');
fs.mkdirSync(APPLICATIONS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, APPLICATIONS_DIR),
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const extname = /\.(pdf|doc|docx)$/.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /pdf|msword|officedocument/.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(Object.assign(new Error('Only PDF, DOC and DOCX files are allowed'), { status: 400 }));
  }
});

/** Runs the upload and turns its errors (wrong type, too large) into a 400. */
const applicationFiles = (req, res, next) =>
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'cover_letter_file', maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Files must be 10 MB or smaller' : err.message;
    res.status(400).json({ success: false, message });
  });

// ============================================
// JOB POSTINGS ENDPOINTS
// ============================================

// Create new job posting
router.post('/', hrStaff, async (req, res) => {
  try {
    const {
      title, department_id, category_id, description, responsibilities,
      requirements, qualifications, employment_type, location,
      salary_range_min, salary_range_max, closing_date, number_of_positions
    } = req.body;

    const result = await pool.query(`
      INSERT INTO job_postings (
        title, department_id, category_id, description, responsibilities,
        requirements, qualifications, employment_type, location,
        salary_range_min, salary_range_max, closing_date, number_of_positions,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      title, department_id, category_id, description, responsibilities,
      requirements, qualifications, employment_type, location,
      salary_range_min, salary_range_max, closing_date, number_of_positions,
      req.user?.id || null
    ]);

    res.json({
      success: true,
      message: 'Job posting created successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job posting',
      error: error.message
    });
  }
});

// Get all job postings (with filters)
router.get('/', async (req, res) => {
  try {
    const { status, department_id, employment_type, active_only } = req.query;

    let query = `
      SELECT
        j.*,
        d.name as department_name,
        ec.display_name as category_name,
        (SELECT COUNT(*) FROM job_applications WHERE job_posting_id = j.id) as application_count
      FROM job_postings j
      LEFT JOIN departments d ON j.department_id = d.id
      LEFT JOIN employee_categories ec ON j.category_id = ec.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND j.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (department_id) {
      query += ` AND j.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (employment_type) {
      query += ` AND j.employment_type = $${paramCount}`;
      params.push(employment_type);
      paramCount++;
    }

    if (active_only === 'true') {
      query += ` AND j.status = 'open' AND (j.closing_date IS NULL OR j.closing_date >= CURRENT_DATE)`;
    }

    query += ` ORDER BY j.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      jobs: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job postings',
      error: error.message
    });
  }
});

// Get single job posting
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        j.*,
        d.name as department_name,
        ec.display_name as category_name,
        ec.requires_keycard,
        ec.can_work_remotely,
        (SELECT COUNT(*) FROM job_applications WHERE job_posting_id = j.id) as application_count
      FROM job_postings j
      LEFT JOIN departments d ON j.department_id = d.id
      LEFT JOIN employee_categories ec ON j.category_id = ec.id
      WHERE j.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job posting',
      error: error.message
    });
  }
});

// Update job posting
router.put('/:id', hrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, department_id, category_id, description, responsibilities,
      requirements, qualifications, employment_type, location,
      salary_range_min, salary_range_max, closing_date, number_of_positions, status
    } = req.body;

    const result = await pool.query(`
      UPDATE job_postings SET
        title = $1,
        department_id = $2,
        category_id = $3,
        description = $4,
        responsibilities = $5,
        requirements = $6,
        qualifications = $7,
        employment_type = $8,
        location = $9,
        salary_range_min = $10,
        salary_range_max = $11,
        closing_date = $12,
        number_of_positions = $13,
        status = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `, [
      title, department_id, category_id, description, responsibilities,
      requirements, qualifications, employment_type, location,
      salary_range_min, salary_range_max, closing_date, number_of_positions, status, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      message: 'Job posting updated successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job posting',
      error: error.message
    });
  }
});

// Delete job posting
router.delete('/:id', hrStaff, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM job_postings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      message: 'Job posting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job posting',
      error: error.message
    });
  }
});

// ============================================
// JOB APPLICATIONS ENDPOINTS
// ============================================

// Submit job application
router.post('/:id/apply', applicationFiles, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, email, phone, cover_letter_text,
      expected_salary, available_start_date
    } = req.body;

    // Check if job exists and is open
    const jobCheck = await pool.query(
      'SELECT * FROM job_postings WHERE id = $1 AND status = $2',
      [id, 'open']
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or closed'
      });
    }

    // Check for duplicate application
    const duplicateCheck = await pool.query(
      'SELECT * FROM job_applications WHERE job_posting_id = $1 AND email = $2',
      [id, email]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this position'
      });
    }

    const files = req.files || {};
    const cvPath = files.cv ? files.cv[0].filename : null;
    const coverLetterPath = files.cover_letter_file ? files.cover_letter_file[0].filename : null;
    if (!first_name || !last_name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Please give your name, email and phone' });
    }

    if (!cvPath) {
      return res.status(400).json({
        success: false,
        message: 'CV is required'
      });
    }

    const result = await pool.query(`
      INSERT INTO job_applications (
        job_posting_id, first_name, last_name, email, phone,
        cv_file_path, cover_letter_file_path, cover_letter_text,
        expected_salary, available_start_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id, first_name, last_name, email, phone,
      cvPath, coverLetterPath, cover_letter_text,
      expected_salary, available_start_date
    ]);

    res.json({
      success: true,
      message: 'Application submitted successfully',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// Get applications for a job
router.get('/:id/applications', hrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    let query = `
      SELECT
        a.*,
        j.title as job_title,
        u.full_name as reviewed_by_name
      FROM job_applications a
      JOIN job_postings j ON a.job_posting_id = j.id
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE a.job_posting_id = $1
    `;

    const params = [id];
    let paramCount = 2;

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY a.applied_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      applications: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// Get all applications (admin)
router.get('/applications/all', hrStaff, async (req, res) => {
  try {
    const { status, job_id } = req.query;

    let query = `
      SELECT
        a.*,
        j.title as job_title,
        d.name as department_name,
        u.full_name as reviewed_by_name
      FROM job_applications a
      JOIN job_postings j ON a.job_posting_id = j.id
      LEFT JOIN departments d ON j.department_id = d.id
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (job_id) {
      query += ` AND a.job_posting_id = $${paramCount}`;
      params.push(job_id);
      paramCount++;
    }

    query += ` ORDER BY a.applied_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      applications: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// Update application status
router.put('/applications/:id/status', hrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    const result = await pool.query(`
      UPDATE job_applications SET
        status = $1,
        review_notes = $2,
        reviewed_by = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, review_notes, req.user?.id || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      message: 'Application status updated successfully',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message
    });
  }
});

// ============================================
// DEPARTMENTS & CATEGORIES
// ============================================

// Get all departments
router.get('/meta/departments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*,
        u.full_name as manager_name,
        (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND is_active = true) as employee_count
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.is_active = true
      ORDER BY d.name
    `);

    res.json({
      success: true,
      departments: result.rows
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

// Get all employee categories
router.get('/meta/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employee_categories ORDER BY display_name');

    res.json({
      success: true,
      categories: result.rows
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Download an applicant's CV or cover letter (HR only)
router.get('/applications/:id/files/:kind', hrStaff, async (req, res) => {
  try {
    const column = { cv: 'cv_file_path', cover_letter: 'cover_letter_file_path' }[req.params.kind];
    if (!column) return res.status(404).json({ success: false, message: 'Unknown file' });
    const { rows } = await pool.query(`SELECT first_name, last_name, ${column} AS file FROM job_applications WHERE id = $1`, [req.params.id]);
    const file = rows[0]?.file && path.join(APPLICATIONS_DIR, path.basename(rows[0].file));
    if (!file || !fs.existsSync(file)) return res.status(404).json({ success: false, message: 'File not found' });
    res.download(file, `${rows[0].first_name} ${rows[0].last_name} - ${req.params.kind === 'cv' ? 'CV' : 'Cover letter'}${path.extname(file)}`);
  } catch (error) {
    console.error('Error downloading application file:', error);
    res.status(500).json({ success: false, message: 'Could not download the file' });
  }
});

module.exports = router;
