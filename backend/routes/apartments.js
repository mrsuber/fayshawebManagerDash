const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Reading apartments is public (website, guest app); changing them is for staff.
const staffOnly = [authenticateToken, requireRole('superadmin', 'manager')];
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/apartments');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

// ============================================
// APARTMENT CATEGORIES
// ============================================

// Get all apartment categories
router.get('/categories', async (req, res) => {
  try {
    const { active_only } = req.query;

    let query = `
      SELECT
        c.*,
        COUNT(a.id) as apartment_count,
        (
          SELECT file_url
          FROM apartment_media
          WHERE category_id = c.id AND is_primary = true
          LIMIT 1
        ) as primary_image,
        (
          SELECT file_url
          FROM apartment_media am
          JOIN apartments apt ON am.apartment_id = apt.id
          WHERE apt.category_id = c.id AND am.is_primary = true
          LIMIT 1
        ) as representative_image,
        (
          SELECT COUNT(*)
          FROM apartment_media
          WHERE category_id = c.id
        ) as media_count
      FROM apartment_categories c
      LEFT JOIN apartments a ON c.id = a.category_id AND a.is_active = true
    `;

    const conditions = [];
    if (active_only === 'true') {
      conditions.push('c.is_active = true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY c.id ORDER BY c.sort_order, c.id';

    const result = await pool.query(query);

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

// Get single category
router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(a.id) as apartment_count,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', m.id,
              'media_type', m.media_type,
              'file_url', m.file_url,
              'thumbnail_url', m.thumbnail_url,
              'title', m.title,
              'is_primary', m.is_primary,
              'sort_order', m.sort_order
            ) ORDER BY m.sort_order, m.id
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as media
      FROM apartment_categories c
      LEFT JOIN apartments a ON c.id = a.category_id AND a.is_active = true
      LEFT JOIN apartment_media m ON m.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

// Create apartment category
router.post('/categories', staffOnly, async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      base_price,
      max_guests,
      size_sqm,
      bedrooms,
      bathrooms,
      features,
      amenities,
      is_active,
      sort_order
    } = req.body;

    const result = await pool.query(`
      INSERT INTO apartment_categories (
        name, display_name, description, base_price, max_guests,
        size_sqm, bedrooms, bathrooms, features, amenities, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      name, display_name, description, base_price, max_guests,
      size_sqm, bedrooms, bathrooms,
      JSON.stringify(features || []),
      JSON.stringify(amenities || []),
      is_active !== false,
      sort_order || 0
    ]);

    res.json({
      success: true,
      message: 'Category created successfully',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

// Update apartment category
router.put('/categories/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(`${key} = $${paramCount}`);
        let value = updates[key];

        // Convert arrays to JSON
        if (key === 'features' || key === 'amenities') {
          value = JSON.stringify(value || []);
        }

        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    const query = `
      UPDATE apartment_categories
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// Delete apartment category
router.delete('/categories/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has apartments
    const checkResult = await pool.query(
      'SELECT COUNT(*) as count FROM apartments WHERE category_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing apartments'
      });
    }

    const result = await pool.query(
      'DELETE FROM apartment_categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

// ============================================
// APARTMENTS
// ============================================

// Get all apartments
router.get('/', async (req, res) => {
  try {
    const { category_id, status, available_only } = req.query;

    const result = await pool.query(`
      SELECT * FROM available_apartments_view
      WHERE 1=1
      ${category_id ? 'AND category_id = $1' : ''}
      ${status ? `AND status::text = $${category_id ? 2 : 1}` : ''}
      ORDER BY unit_number
    `, [category_id, status].filter(Boolean));

    res.json({
      success: true,
      apartments: result.rows
    });
  } catch (error) {
    console.error('Error fetching apartments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apartments',
      error: error.message
    });
  }
});

// Get single apartment with full details (public detail page and admin editor).
// media = this unit's own photos plus its category's, primary first.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        c.name as category_name,
        c.display_name as category_display_name,
        c.description as category_description,
        c.base_price,
        c.max_guests,
        c.size_sqm,
        c.bedrooms,
        c.bathrooms,
        c.features,
        c.amenities,
        COALESCE(a.custom_price, c.base_price) as effective_price,
        COALESCE((
          SELECT json_agg(jsonb_build_object(
            'id', m.id, 'media_type', m.media_type, 'file_url', m.file_url, 'thumbnail_url', m.thumbnail_url,
            'title', m.title, 'description', m.description, 'is_primary', m.is_primary, 'sort_order', m.sort_order,
            'width', m.width, 'height', m.height, 'duration', m.duration,
            'scope', CASE WHEN m.apartment_id IS NOT NULL THEN 'apartment' ELSE 'category' END
          ) ORDER BY m.apartment_id IS NULL, m.is_primary DESC, m.sort_order, m.id)
          FROM apartment_media m
          WHERE m.apartment_id = a.id OR m.category_id = a.category_id
        ), '[]') as media
      FROM apartments a
      JOIN apartment_categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Apartment not found'
      });
    }

    const apartment = result.rows[0];
    res.json({
      success: true,
      apartment: { ...apartment, price_per_night: parseFloat(apartment.effective_price) }
    });
  } catch (error) {
    console.error('Error fetching apartment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apartment'
    });
  }
});

// Create apartment
router.post('/', staffOnly, async (req, res) => {
  try {
    const {
      category_id,
      unit_number,
      floor,
      building,
      status,
      custom_price,
      notes,
      special_features
    } = req.body;

    const result = await pool.query(`
      INSERT INTO apartments (
        category_id, unit_number, floor, building, status,
        custom_price, notes, special_features
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      category_id,
      unit_number,
      floor,
      building,
      status || 'available',
      custom_price,
      notes,
      JSON.stringify(special_features || [])
    ]);

    res.json({
      success: true,
      message: 'Apartment created successfully',
      apartment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating apartment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create apartment',
      error: error.message
    });
  }
});

// Update apartment
router.put('/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(`${key} = $${paramCount}`);
        let value = updates[key];

        if (key === 'special_features') {
          value = JSON.stringify(value || []);
        }

        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    const query = `
      UPDATE apartments
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Apartment not found'
      });
    }

    res.json({
      success: true,
      message: 'Apartment updated successfully',
      apartment: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating apartment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update apartment',
      error: error.message
    });
  }
});

// Delete apartment
router.delete('/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if apartment has bookings
    const checkResult = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE apartment_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete apartment with existing bookings'
      });
    }

    const result = await pool.query(
      'DELETE FROM apartments WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Apartment not found'
      });
    }

    res.json({
      success: true,
      message: 'Apartment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete apartment',
      error: error.message
    });
  }
});

// ============================================
// MEDIA MANAGEMENT
// ============================================

// Upload media for apartment or category
router.post('/media/upload', staffOnly, upload.array('files', 20), async (req, res) => {
  try {
    const { apartment_id, category_id, media_type, titles, descriptions } = req.body;

    if (!apartment_id && !category_id) {
      return res.status(400).json({
        success: false,
        message: 'Either apartment_id or category_id is required'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const mediaRecords = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileUrl = `/uploads/apartments/${file.filename}`;

      const result = await pool.query(`
        INSERT INTO apartment_media (
          apartment_id, category_id, media_type, file_url,
          title, description, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        apartment_id || null,
        category_id || null,
        media_type || (file.mimetype.startsWith('video') ? 'video' : 'image'),
        fileUrl,
        titles ? (Array.isArray(titles) ? titles[i] : titles) : file.originalname,
        descriptions ? (Array.isArray(descriptions) ? descriptions[i] : descriptions) : null,
        i
      ]);

      mediaRecords.push(result.rows[0]);
    }

    res.json({
      success: true,
      message: `${mediaRecords.length} file(s) uploaded successfully`,
      media: mediaRecords
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message
    });
  }
});

// Set primary image
router.put('/media/:id/set-primary', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Get media details
    const media = await pool.query(
      'SELECT apartment_id, category_id FROM apartment_media WHERE id = $1',
      [id]
    );

    if (media.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    const { apartment_id, category_id } = media.rows[0];

    // Remove primary flag from other images
    if (apartment_id) {
      await pool.query(
        'UPDATE apartment_media SET is_primary = false WHERE apartment_id = $1',
        [apartment_id]
      );
    } else if (category_id) {
      await pool.query(
        'UPDATE apartment_media SET is_primary = false WHERE category_id = $1',
        [category_id]
      );
    }

    // Set this as primary
    const result = await pool.query(
      'UPDATE apartment_media SET is_primary = true WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      success: true,
      message: 'Primary image updated',
      media: result.rows[0]
    });
  } catch (error) {
    console.error('Error setting primary image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set primary image',
      error: error.message
    });
  }
});

// Delete media
router.delete('/media/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Get file path
    const result = await pool.query(
      'SELECT file_url FROM apartment_media WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Delete file
    const filePath = path.join(__dirname, '..', result.rows[0].file_url);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete database record
    await pool.query('DELETE FROM apartment_media WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
});

module.exports = router;
