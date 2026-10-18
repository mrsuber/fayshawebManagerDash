const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

const CONTENT_ROLES = ['superadmin', 'content_manager', 'editor'];
const db = require('../config/database');

/**
 * GET /api/pages/:pageId/:language
 * Get all content for a specific page and language
 */
router.get('/:pageId/:language', async (req, res) => {
  try {
    const { pageId, language } = req.params;

    const query = `
      SELECT section, content_key, content_value, content_json
      FROM page_content
      WHERE page_id = $1 AND language = $2
      ORDER BY section, content_key
    `;

    const result = await db.query(query, [pageId, language]);

    // Organize content by section
    const content = {};
    result.rows.forEach(row => {
      if (!content[row.section]) {
        content[row.section] = {};
      }

      if (row.content_json) {
        if (row.content_key) {
          content[row.section][row.content_key] = row.content_json;
        } else {
          content[row.section] = row.content_json;
        }
      } else if (row.content_value) {
        content[row.section][row.content_key] = row.content_value;
      }
    });

    res.json({
      success: true,
      pageId,
      language,
      content
    });
  } catch (error) {
    console.error('Error fetching page content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch page content'
    });
  }
});

/**
 * POST /api/pages/:pageId/:language
 * Save/update content for a specific page and language
 */
router.post('/:pageId/:language', authenticateToken, requireRole(...CONTENT_ROLES), async (req, res) => {
  const client = await db.getClient();

  try {
    const { pageId, language } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid content format'
      });
    }

    await client.query('BEGIN');

    // Process each section
    for (const [section, sectionContent] of Object.entries(content)) {
      if (typeof sectionContent === 'object' && !Array.isArray(sectionContent)) {
        // Check if it's a simple key-value or complex object
        const hasSimpleValues = Object.values(sectionContent).every(
          val => typeof val === 'string' || typeof val === 'number'
        );

        if (hasSimpleValues) {
          // Store each key-value pair separately
          for (const [key, value] of Object.entries(sectionContent)) {
            await client.query(
              `INSERT INTO page_content (page_id, language, section, content_key, content_value)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (page_id, language, section, content_key)
               DO UPDATE SET content_value = $5, updated_at = CURRENT_TIMESTAMP`,
              [pageId, language, section, key, value]
            );
          }
        } else {
          // Store as JSON for complex objects
          await client.query(
            `INSERT INTO page_content (page_id, language, section, content_key, content_json)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (page_id, language, section, content_key)
             DO UPDATE SET content_json = $5, updated_at = CURRENT_TIMESTAMP`,
            [pageId, language, section, null, JSON.stringify(sectionContent)]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Content saved successfully',
      pageId,
      language
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving page content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save page content'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/pages
 * Get list of all pages with content
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT page_id, language,
             COUNT(*) as section_count,
             MAX(updated_at) as last_updated
      FROM page_content
      GROUP BY page_id, language
      ORDER BY page_id, language
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      pages: result.rows
    });
  } catch (error) {
    console.error('Error fetching pages list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pages list'
    });
  }
});

/**
 * DELETE /api/pages/:pageId/:language
 * Delete all content for a specific page and language
 */
router.delete('/:pageId/:language', authenticateToken, requireRole('superadmin', 'content_manager'), async (req, res) => {
  try {
    const { pageId, language } = req.params;

    const query = 'DELETE FROM page_content WHERE page_id = $1 AND language = $2';
    const result = await db.query(query, [pageId, language]);

    res.json({
      success: true,
      message: 'Content deleted successfully',
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error deleting page content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete page content'
    });
  }
});

module.exports = router;
