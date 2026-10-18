// Wellness API Routes
// Handles wellness metrics, activities, bookings, concierge, and smart home controls

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const crypto = require('crypto');

/**
 * Concierge replies come from staff (admin / manager dashboards) or from the n8n AI workflow.
 * n8n authenticates with a staff JWT or, if N8N_CALLBACK_SECRET is set, the header
 * `x-fay-callback-secret: <secret>`.
 */
const staffOrConciergeBot = (req, res, next) => {
  const secret = process.env.N8N_CALLBACK_SECRET;
  const given = req.headers['x-fay-callback-secret'];
  if (secret && given && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return next();
  }
  return requireStaff[0](req, res, () => requireStaff[1](req, res, next));
};
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Send webhook to n8n for AI processing
async function sendToN8N(webhookData) {
  return new Promise((resolve, reject) => {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    const n8nEnabled = process.env.N8N_ENABLED === 'true';

    if (!n8nEnabled || !n8nWebhookUrl) {
      console.log('n8n webhook disabled or not configured');
      return resolve({ success: false, reason: 'disabled' });
    }

    try {
      const url = new URL(n8nWebhookUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(webhookData);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000 // 5 second timeout
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Webhook sent to n8n successfully');
            resolve({ success: true, data });
          } else {
            console.error(`❌ n8n webhook failed with status ${res.statusCode}`);
            resolve({ success: false, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Error sending webhook to n8n:', error.message);
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('❌ n8n webhook timeout');
        resolve({ success: false, error: 'timeout' });
      });

      req.write(postData);
      req.end();
    } catch (error) {
      console.error('❌ Error preparing n8n webhook:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
}

// ============================================
// WELLNESS METRICS
// ============================================

// Get user's wellness metrics
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    let query = `
      SELECT * FROM wellness_metrics
      WHERE user_id = $1
    `;
    const params = [userId];

    if (date) {
      query += ` AND date = $2`;
      params.push(date);
    } else {
      query += ` ORDER BY date DESC LIMIT 1`;
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      // Return default metrics if none exist
      return res.json({
        success: true,
        metrics: {
          sleep_score: 0,
          activity_score: 0,
          nutrition_score: 0,
          hydration_score: 0,
          mood_score: 0,
          mood_label: 'Neutral',
          overall_score: 0,
          date: new Date().toISOString().split('T')[0]
        }
      });
    }

    res.json({
      success: true,
      metrics: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching wellness metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wellness metrics'
    });
  }
});

// Update or create wellness metrics
router.post('/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sleep_score,
      activity_score,
      nutrition_score,
      hydration_score,
      mood_score,
      mood_label,
      date
    } = req.body;

    const metricsDate = date || new Date().toISOString().split('T')[0];

    // Calculate overall score (average of all metrics)
    const scores = [sleep_score, activity_score, nutrition_score, hydration_score, mood_score]
      .filter(score => score !== undefined && score !== null);
    const overall_score = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const query = `
      INSERT INTO wellness_metrics (
        user_id, sleep_score, activity_score, nutrition_score,
        hydration_score, mood_score, mood_label, overall_score, date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        sleep_score = COALESCE($2, wellness_metrics.sleep_score),
        activity_score = COALESCE($3, wellness_metrics.activity_score),
        nutrition_score = COALESCE($4, wellness_metrics.nutrition_score),
        hydration_score = COALESCE($5, wellness_metrics.hydration_score),
        mood_score = COALESCE($6, wellness_metrics.mood_score),
        mood_label = COALESCE($7, wellness_metrics.mood_label),
        overall_score = $8,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      sleep_score,
      activity_score,
      nutrition_score,
      hydration_score,
      mood_score,
      mood_label,
      overall_score,
      metricsDate
    ]);

    res.json({
      success: true,
      message: 'Wellness metrics updated successfully',
      metrics: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating wellness metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update wellness metrics'
    });
  }
});

// ============================================
// WELLNESS ACTIVITIES
// ============================================

// Get all activities or filter by mood category
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const { mood } = req.query;

    let query = `
      SELECT * FROM wellness_activities
      WHERE is_active = true
    `;
    const params = [];

    if (mood) {
      query += ` AND mood_category = $1`;
      params.push(mood);
    }

    query += ` ORDER BY mood_category, id`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      activities: result.rows
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

// Get single activity by ID
router.get('/activities/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM wellness_activities WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      activity: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
});

// Create new activity (admin only)
router.post('/activities', requireStaff, async (req, res) => {
  try {
    const { mood_category, name, description, duration, image_url, features } = req.body;

    if (!mood_category || !name) {
      return res.status(400).json({
        success: false,
        error: 'Mood category and name are required'
      });
    }

    const query = `
      INSERT INTO wellness_activities (
        mood_category, name, description, duration, image_url, features
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      mood_category,
      name,
      description || null,
      duration || null,
      image_url || null,
      JSON.stringify(features || [])
    ]);

    res.json({
      success: true,
      message: 'Activity created successfully',
      activity: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create activity'
    });
  }
});

// Update activity (admin only)
router.put('/activities/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { mood_category, name, description, duration, image_url, features } = req.body;

    const query = `
      UPDATE wellness_activities
      SET
        mood_category = COALESCE($1, mood_category),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        duration = COALESCE($4, duration),
        image_url = COALESCE($5, image_url),
        features = COALESCE($6, features),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND is_active = true
      RETURNING *
    `;

    const result = await db.query(query, [
      mood_category,
      name,
      description,
      duration,
      image_url,
      features ? JSON.stringify(features) : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity updated successfully',
      activity: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
});

// Delete activity (soft delete by setting is_active = false)
router.delete('/activities/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE wellness_activities
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete activity'
    });
  }
});

// ============================================
// WELLNESS BOOKINGS
// ============================================

// Get user's bookings
router.get('/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT wb.*, wa.name as activity_name, wa.image_url
      FROM wellness_bookings wb
      LEFT JOIN wellness_activities wa ON wb.activity_id = wa.id
      WHERE wb.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND wb.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY wb.booking_date DESC, wb.booking_time DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Create a new booking
router.post('/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { activity_id, activity_name, booking_date, booking_time, notes } = req.body;

    if (!activity_name || !booking_date) {
      return res.status(400).json({
        success: false,
        error: 'Activity name and booking date are required'
      });
    }

    const query = `
      INSERT INTO wellness_bookings (
        user_id, activity_id, activity_name, booking_date, booking_time, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      activity_id || null,
      activity_name,
      booking_date,
      booking_time || null,
      notes || null
    ]);

    res.json({
      success: true,
      message: 'Booking created successfully',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// Update booking status
router.patch('/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const query = `
      UPDATE wellness_bookings
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `;

    const result = await db.query(query, [status, notes, id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking'
    });
  }
});

// ============================================
// CONCIERGE CHAT
// ============================================

// Get chat messages
router.get('/concierge/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const query = `
      SELECT * FROM concierge_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);

    // Parse metadata JSON for each message and fix missing URLs
    const messages = result.rows.map(msg => {
      let metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

      // Fix old messages: if attachment has name but no url, reconstruct it
      if (metadata?.attachment && metadata.attachment.name && !metadata.attachment.url && !metadata.attachment.uri) {
        const fileName = metadata.attachment.name;
        metadata.attachment.url = `/uploads/chat/${fileName}`;
        metadata.attachment.cdnUrl = `https://fayshaa.com/uploads/chat/${fileName}`;
        console.log(`Fixed missing URL for message ${msg.id}: ${metadata.attachment.url}`);
      }

      return {
        ...msg,
        metadata
      };
    });

    res.json({
      success: true,
      messages: messages.reverse() // Reverse to show oldest first
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Generate presigned URL for direct file upload
router.post('/concierge/upload-url', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileType are required'
      });
    }

    // Validate file size (max 10MB)
    if (fileSize && fileSize > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 10MB limit'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${userId}_${timestamp}.${extension}`;

    // Create upload directory if needed
    const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueFileName);
    const publicUrl = `/uploads/chat/${uniqueFileName}`;
    const cdnUrl = `https://fayshaa.com${publicUrl}`;

    // Return upload information
    // Note: For now, we'll use multipart/form-data upload
    // In future, can switch to S3 presigned URLs
    res.json({
      success: true,
      uploadEndpoint: '/api/wellness/concierge/upload',
      fileName: uniqueFileName,
      publicUrl,
      cdnUrl,
      maxSize: 10 * 1024 * 1024
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL'
    });
  }
});

// Direct file upload endpoint (multipart)
router.post('/concierge/upload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName, fileData, mimeType } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileData are required'
      });
    }

    // Handle base64 data
    let buffer;
    if (fileData.startsWith('data:')) {
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 data'
        });
      }
    } else {
      buffer = Buffer.from(fileData, 'base64');
    }

    // Create upload directory
    const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/chat/${fileName}`;
    const cdnUrl = `https://fayshaa.com${publicUrl}`;

    res.json({
      success: true,
      url: publicUrl,
      cdnUrl,
      fileName,
      size: buffer.length
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file'
    });
  }
});

// Send a message
router.post('/concierge/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, metadata } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Process metadata to save image/file attachments
    let processedMetadata = metadata || {};

    if (metadata && metadata.attachment) {
      const attachment = metadata.attachment;

      // If attachment has base64 data, save it as a file
      if (attachment.uri && attachment.uri.startsWith('data:')) {
        try {
          // Extract base64 data
          const matches = attachment.uri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Create uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
            await fs.mkdir(uploadDir, { recursive: true });

            // Generate unique filename
            const timestamp = Date.now();
            const extension = attachment.type === 'image'
              ? (mimeType.split('/')[1] || 'jpg')
              : path.extname(attachment.name || '.bin');
            const filename = `${userId}_${timestamp}.${extension}`;
            const filepath = path.join(uploadDir, filename);

            // Save file
            await fs.writeFile(filepath, buffer);

            // Update metadata with file path instead of base64
            processedMetadata = {
              ...metadata,
              attachment: {
                type: attachment.type,
                name: attachment.name,
                mimeType: mimeType,
                url: `/uploads/chat/${filename}`,
                size: buffer.length
              }
            };

            console.log(`Saved attachment: ${filename} (${buffer.length} bytes)`);
          }
        } catch (fileError) {
          console.error('Error saving attachment file:', fileError);
          // Continue with original metadata if file save fails
        }
      }
    }

    // Save user message
    const userMessageQuery = `
      INSERT INTO concierge_messages (user_id, message, sender_type, metadata)
      VALUES ($1, $2, 'user', $3)
      RETURNING *
    `;

    const userMessage = await db.query(userMessageQuery, [
      userId,
      message,
      JSON.stringify(processedMetadata)
    ]);

    // Emit Socket.IO event to notify admin of new message
    const io = req.app.get('io');
    if (io) {
      const messageData = {
        ...userMessage.rows[0],
        metadata: typeof userMessage.rows[0].metadata === 'string'
          ? JSON.parse(userMessage.rows[0].metadata)
          : userMessage.rows[0].metadata
      };
      // Notify admin of new message from user
      io.to('admin').emit('new_message', messageData);
    }

    // Send to n8n for AI processing (non-blocking)
    const userInfo = await db.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
    const userData = userInfo.rows[0] || {};

    sendToN8N({
      userId,
      userName: userData.full_name || 'Guest',
      userEmail: userData.email || '',
      message,
      messageId: userMessage.rows[0].id,
      timestamp: userMessage.rows[0].created_at,
      metadata: processedMetadata,
      callbackUrl: `${process.env.APP_URL}/api/wellness/admin/concierge/messages`
    }).catch(error => {
      console.error('n8n webhook error (non-blocking):', error);
    });

    res.json({
      success: true,
      message: userMessage.rows[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Simple auto-response helper
function generateAutoResponse(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('airport') || lowerMessage.includes('transfer')) {
    return 'Certainly. We will arrange your airport transfer. What time would you like us to pick you up?';
  }
  if (lowerMessage.includes('spa') || lowerMessage.includes('massage')) {
    return 'Of course — I can book a spa session for you. What time works best?';
  }
  if (lowerMessage.includes('dinner') || lowerMessage.includes('restaurant')) {
    return 'I\'d be happy to reserve a table for you. How many guests and what time?';
  }
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return 'Hello! Welcome to Faysha. How may I assist you today?';
  }

  return 'Thank you for your message. A member of our concierge team will respond shortly. How else may I assist you?';
}

// ============================================
// SMART HOME CONTROLS
// ============================================

// Get smart home status
router.get('/smart-home', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM smart_home_controls WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default controls if none exist
      const defaultQuery = `
        INSERT INTO smart_home_controls (user_id, villa_name)
        VALUES ($1, 'Serenity Villa')
        RETURNING *
      `;
      const defaultResult = await db.query(defaultQuery, [userId]);
      return res.json({
        success: true,
        controls: defaultResult.rows[0]
      });
    }

    res.json({
      success: true,
      controls: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching smart home controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch smart home controls'
    });
  }
});

// Update smart home controls
router.post('/smart-home', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_locked, lights_status, climate_temp, curtains_status } = req.body;

    const query = `
      INSERT INTO smart_home_controls (
        user_id, is_locked, lights_status, climate_temp, curtains_status, last_action_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_locked = COALESCE($2, smart_home_controls.is_locked),
        lights_status = COALESCE($3, smart_home_controls.lights_status),
        climate_temp = COALESCE($4, smart_home_controls.climate_temp),
        curtains_status = COALESCE($5, smart_home_controls.curtains_status),
        last_action_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      is_locked,
      lights_status,
      climate_temp,
      curtains_status
    ]);

    res.json({
      success: true,
      message: 'Smart home controls updated successfully',
      controls: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating smart home controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update smart home controls'
    });
  }
});

// ============================================
// WELLNESS ZONES
// ============================================

// Get all wellness zones
router.get('/zones', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM wellness_zones WHERE is_active = true ORDER BY id'
    );

    res.json({
      success: true,
      zones: result.rows
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zones'
    });
  }
});

// Create new zone (admin only)
router.post('/zones', requireStaff, async (req, res) => {
  try {
    const { name, subtitle, description, image_url, features, glyph } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Zone name is required'
      });
    }

    const query = `
      INSERT INTO wellness_zones (
        name, subtitle, description, image_url, features, glyph
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      name,
      subtitle || null,
      description || null,
      image_url || null,
      JSON.stringify(features || []),
      glyph || null
    ]);

    res.json({
      success: true,
      message: 'Zone created successfully',
      zone: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create zone'
    });
  }
});

// Update zone (admin only)
router.put('/zones/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subtitle, description, image_url, features, glyph } = req.body;

    const query = `
      UPDATE wellness_zones
      SET
        name = COALESCE($1, name),
        subtitle = COALESCE($2, subtitle),
        description = COALESCE($3, description),
        image_url = COALESCE($4, image_url),
        features = COALESCE($5, features),
        glyph = COALESCE($6, glyph),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND is_active = true
      RETURNING *
    `;

    const result = await db.query(query, [
      name,
      subtitle,
      description,
      image_url,
      features ? JSON.stringify(features) : null,
      glyph,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    res.json({
      success: true,
      message: 'Zone updated successfully',
      zone: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update zone'
    });
  }
});

// Delete zone (soft delete)
router.delete('/zones/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE wellness_zones
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete zone'
    });
  }
});

//  ============================================
// ADMIN - Get all wellness bookings (admin view)
// ============================================
router.get('/admin/bookings', requireStaff, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        wb.*,
        u.email as user_email,
        u.full_name as user_name,
        wa.name as activity_name,
        wa.image_url
      FROM wellness_bookings wb
      LEFT JOIN users u ON wb.user_id = u.id
      LEFT JOIN wellness_activities wa ON wb.activity_id = wa.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND wb.status = $${params.length}`;
    }

    query += ` ORDER BY wb.booking_date DESC, wb.booking_time DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// ============================================
// ADMIN - Get all concierge messages
// ============================================
router.get('/admin/concierge/messages', requireStaff, async (req, res) => {
  try {
    const { user_id, limit = 100 } = req.query;

    let query = `
      SELECT
        cm.*,
        u.email as user_email,
        u.full_name as user_name
      FROM concierge_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      params.push(user_id);
      query += ` AND cm.user_id = $${params.length}`;
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    // Parse JSON metadata for each message
    const messages = result.rows.map(msg => ({
      ...msg,
      metadata: typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
    }));

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Admin send message to user
router.post('/admin/concierge/messages', staffOrConciergeBot, async (req, res) => {
  try {
    const { user_id, message, metadata } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'User ID and message are required'
      });
    }

    // Process metadata to save image/file attachments
    let processedMetadata = metadata || { auto: false };

    if (metadata && metadata.attachment) {
      const attachment = metadata.attachment;

      // If attachment has base64 data, save it as a file
      if (attachment.uri && attachment.uri.startsWith('data:')) {
        try {
          // Extract base64 data
          const matches = attachment.uri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Create uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
            await fs.mkdir(uploadDir, { recursive: true });

            // Generate unique filename
            const timestamp = Date.now();
            const extension = attachment.type === 'image'
              ? (mimeType.split('/')[1] || 'jpg')
              : path.extname(attachment.name || '.bin');
            const filename = `admin_${user_id}_${timestamp}.${extension}`;
            const filepath = path.join(uploadDir, filename);

            // Save file
            await fs.writeFile(filepath, buffer);

            // Update metadata with file path instead of base64
            processedMetadata = {
              ...metadata,
              attachment: {
                type: attachment.type,
                name: attachment.name,
                mimeType: mimeType,
                url: `/uploads/chat/${filename}`,
                size: buffer.length
              }
            };

            console.log(`Saved admin attachment: ${filename} (${buffer.length} bytes)`);
          }
        } catch (fileError) {
          console.error('Error saving admin attachment file:', fileError);
          // Continue with original metadata if file save fails
        }
      }
    }

    // Save admin message
    const conciergeMessageQuery = `
      INSERT INTO concierge_messages (user_id, message, sender_type, metadata)
      VALUES ($1, $2, 'concierge', $3)
      RETURNING *
    `;

    const conciergeMessage = await db.query(conciergeMessageQuery, [
      user_id,
      message,
      JSON.stringify(processedMetadata)
    ]);

    // Emit Socket.IO event for real-time delivery
    const io = req.app.get('io');
    if (io) {
      const messageData = {
        ...conciergeMessage.rows[0],
        metadata: typeof conciergeMessage.rows[0].metadata === 'string'
          ? JSON.parse(conciergeMessage.rows[0].metadata)
          : conciergeMessage.rows[0].metadata
      };

      // Send to specific user
      io.to(`user_${user_id}`).emit('new_message', messageData);

      // Also broadcast to all admin listeners
      io.to('admin').emit('new_message', messageData);
    }

    res.json({
      success: true,
      message: conciergeMessage.rows[0]
    });
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// ============================================
// WELLNESS JOURNEYS (Restore, Recharge, Reflect)
// ============================================

// Get journey templates
router.get('/journey-templates', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM journey_templates ORDER BY id'
    );

    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    console.error('Error fetching journey templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey templates'
    });
  }
});

// Create new journey booking
router.post('/journeys', authenticateToken, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { journey_type, booking_date, booking_time, stages } = req.body;

    if (!journey_type || !booking_date || !stages) {
      return res.status(400).json({
        success: false,
        error: 'Journey type, booking date, and stages are required'
      });
    }

    // Generate unique journey PIN
    const pinResult = await client.query('SELECT generate_journey_pin()');
    const journeyPin = pinResult.rows[0].generate_journey_pin;

    // Create journey booking
    const query = `
      INSERT INTO wellness_bookings (
        user_id, activity_name, booking_date, booking_time,
        journey_type, journey_stages, current_stage, journey_pin, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 'pending')
      RETURNING *
    `;

    const result = await client.query(query, [
      userId,
      `${journey_type.charAt(0).toUpperCase() + journey_type.slice(1)} Journey`,
      booking_date,
      booking_time || '10:00',
      journey_type,
      JSON.stringify(stages),
      journeyPin
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Journey booking created successfully',
      booking: result.rows[0],
      pin: journeyPin
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create journey booking'
    });
  } finally {
    client.release();
  }
});

// Get active journey for user
router.get('/journeys/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT * FROM wellness_bookings
      WHERE user_id = $1
        AND journey_type IS NOT NULL
        AND status IN ('pending', 'confirmed', 'in_progress')
        AND booking_date >= CURRENT_DATE
      ORDER BY booking_date ASC, booking_time ASC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasActiveJourney: false,
        journey: null
      });
    }

    const journey = result.rows[0];

    // Get stage tracking history
    const stagesResult = await db.query(
      `SELECT * FROM journey_stage_tracking
       WHERE booking_id = $1
       ORDER BY stage_number ASC`,
      [journey.id]
    );

    res.json({
      success: true,
      hasActiveJourney: true,
      journey: {
        ...journey,
        stageHistory: stagesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching active journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active journey'
    });
  }
});

// Get journey by ID
router.get('/journeys/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM wellness_bookings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Journey not found'
      });
    }

    const journey = result.rows[0];

    // Get stage tracking history
    const stagesResult = await db.query(
      `SELECT * FROM journey_stage_tracking
       WHERE booking_id = $1
       ORDER BY stage_number ASC`,
      [id]
    );

    res.json({
      success: true,
      journey: {
        ...journey,
        stageHistory: stagesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey'
    });
  }
});

// Start journey (verify PIN)
router.post('/journeys/:id/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required'
      });
    }

    // Verify PIN and get journey
    const result = await db.query(
      `SELECT * FROM wellness_bookings
       WHERE id = $1 AND user_id = $2 AND journey_pin = $3`,
      [id, userId, pin]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid PIN or journey not found'
      });
    }

    // Update journey status and set start time
    await db.query(
      `UPDATE wellness_bookings
       SET status = 'in_progress', journey_started_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Journey started successfully'
    });
  } catch (error) {
    console.error('Error starting journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start journey'
    });
  }
});

// Enter journey stage
router.post('/journeys/:id/stage/:stageNumber/enter', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, stageNumber } = req.params;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required'
      });
    }

    // Verify PIN and get journey
    const journeyResult = await db.query(
      `SELECT * FROM wellness_bookings
       WHERE id = $1 AND user_id = $2 AND journey_pin = $3`,
      [id, userId, pin]
    );

    if (journeyResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid PIN or journey not found'
      });
    }

    const journey = journeyResult.rows[0];
    const stages = journey.journey_stages;
    const stage = stages.find(s => s.stage === parseInt(stageNumber));

    if (!stage) {
      return res.status(404).json({
        success: false,
        error: 'Stage not found'
      });
    }

    // Check if already entered
    const existingEntry = await db.query(
      `SELECT * FROM journey_stage_tracking
       WHERE booking_id = $1 AND stage_number = $2 AND exited_at IS NULL`,
      [id, stageNumber]
    );

    if (existingEntry.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Already in this stage'
      });
    }

    // Record stage entry
    await db.query(
      `INSERT INTO journey_stage_tracking (booking_id, stage_number, stage_name, entered_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [id, stageNumber, stage.name]
    );

    res.json({
      success: true,
      message: `Entered ${stage.name}`,
      stage: stage
    });
  } catch (error) {
    console.error('Error entering stage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enter stage'
    });
  }
});

// Exit journey stage (with auto-points award on completion)
router.post('/journeys/:id/stage/:stageNumber/exit', authenticateToken, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { id, stageNumber } = req.params;

    // Get journey
    const journeyResult = await client.query(
      `SELECT * FROM wellness_bookings WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (journeyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Journey not found'
      });
    }

    const journey = journeyResult.rows[0];
    const stages = journey.journey_stages;
    const totalStages = stages.length;

    // Get current stage entry
    const stageResult = await client.query(
      `SELECT * FROM journey_stage_tracking
       WHERE booking_id = $1 AND stage_number = $2 AND exited_at IS NULL
       ORDER BY entered_at DESC LIMIT 1`,
      [id, stageNumber]
    );

    if (stageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Not currently in this stage'
      });
    }

    const stageEntry = stageResult.rows[0];
    const enteredAt = new Date(stageEntry.entered_at);
    const exitedAt = new Date();
    const durationMinutes = Math.round((exitedAt - enteredAt) / (1000 * 60));

    // Update stage tracking with exit time
    await client.query(
      `UPDATE journey_stage_tracking
       SET exited_at = CURRENT_TIMESTAMP, duration_minutes = $1
       WHERE id = $2`,
      [durationMinutes, stageEntry.id]
    );

    // Check if this is the final stage
    const isLastStage = parseInt(stageNumber) === totalStages;
    let journeyCompleted = false;
    let pointsAwarded = 0;

    if (isLastStage) {
      // Mark journey as completed
      await client.query(
        `UPDATE wellness_bookings
         SET status = 'completed', journey_completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      journeyCompleted = true;

      // AUTO-AWARD POINTS FOR JOURNEY COMPLETION
      const pointsMap = {
        'restore': 150,
        'recharge': 175,
        'reflect': 125
      };
      pointsAwarded = pointsMap[journey.journey_type] || 100;

      // Ensure user_rewards record exists
      await client.query(
        `INSERT INTO user_rewards (user_id, total_points, lifetime_points)
         VALUES ($1, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      // Award points
      await client.query(
        `UPDATE user_rewards
         SET total_points = total_points + $1,
             lifetime_points = lifetime_points + $1
         WHERE user_id = $2`,
        [pointsAwarded, userId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO rewards_transactions
         (user_id, points_change, transaction_type, description, reference_type, reference_id)
         VALUES ($1, $2, 'journey_completed', $3, 'wellness_booking', $4)`,
        [
          userId,
          pointsAwarded,
          `Completed ${journey.journey_type.charAt(0).toUpperCase() + journey.journey_type.slice(1)} Journey`,
          id
        ]
      );
    } else {
      // Update current stage to next stage
      await client.query(
        `UPDATE wellness_bookings
         SET current_stage = $1
         WHERE id = $2`,
        [parseInt(stageNumber) + 1, id]
      );
    }

    await client.query('COMMIT');

    const response = {
      success: true,
      message: `Exited stage ${stageNumber}`,
      duration_minutes: durationMinutes,
      journeyCompleted
    };

    if (journeyCompleted) {
      response.pointsAwarded = pointsAwarded;
      response.message = `Journey completed! You earned ${pointsAwarded} points!`;
    } else {
      response.nextStage = parseInt(stageNumber) + 1;
    }

    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error exiting stage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to exit stage'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
