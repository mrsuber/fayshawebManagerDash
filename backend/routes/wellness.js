// Wellness API Routes
// Handles wellness metrics, activities, bookings, concierge, and smart home controls

const express = require('express');
const { notifyGuest } = require('../services/guestPush');
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
// WELLNESS ACTIVITIES (one catalogue: journeys and services; the app books them via /api/wellness-unified)
// ============================================

const CATEGORIES = ['restore', 'recharge', 'reflect', 'explore', 'fitness', 'spa', 'dining', 'other'];

/** Validated activity fields from a request body; `partial` for updates. Returns { values } or { error }. */
function activityInput(body, partial = false) {
  const v = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) {
    if (!String(body.name || '').trim()) return { error: 'Name is required' };
    v.name = String(body.name).trim();
  }
  if (!partial || has('category')) {
    if (!CATEGORIES.includes(body.category)) return { error: `Category must be one of: ${CATEGORIES.join(', ')}` };
    v.category = body.category;
  }
  if (has('type')) {
    if (!['journey', 'service'].includes(body.type)) return { error: 'Type must be journey or service' };
    v.type = body.type;
  }
  if (!partial || has('duration')) {
    const d = parseInt(body.duration, 10);
    if (!Number.isInteger(d) || d < 5 || d > 24 * 60) return { error: 'Duration must be between 5 and 1440 minutes' };
    v.duration = d;
  }
  if (has('max_capacity')) {
    const c = parseInt(body.max_capacity, 10);
    if (!Number.isInteger(c) || c < 1) return { error: 'Capacity must be at least 1' };
    v.max_capacity = c;
  }
  if (has('base_price')) {
    const p = Number(body.base_price);
    if (!Number.isFinite(p) || p < 0) return { error: 'Price cannot be negative' };
    v.base_price = p;
  }
  for (const k of ['display_name', 'description', 'icon', 'image_url']) if (has(k)) v[k] = body[k] ? String(body[k]) : null;
  for (const k of ['requires_staff', 'is_active']) if (has(k)) v[k] = Boolean(body[k]);
  if (has('benefits')) v.benefits = (Array.isArray(body.benefits) ? body.benefits : String(body.benefits).split(',')).map((b) => String(b).trim()).filter(Boolean);
  if (has('display_order')) v.display_order = parseInt(body.display_order, 10) || 0;
  return { values: v };
}

// List the catalogue. Staff can include inactive activities with ?all=true.
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const category = req.query.category || req.query.mood;
    const conditions = [];
    const params = [];
    const staff = ['superadmin', 'manager'].includes(req.user.role);
    if (!(staff && req.query.all === 'true')) conditions.push('is_active = true');
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (req.query.type) {
      params.push(req.query.type);
      conditions.push(`type = $${params.length}`);
    }
    const result = await db.query(
      `SELECT * FROM wellness_activities ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY type DESC, category, display_order, name`,
      params
    );
    res.json({ success: true, activities: result.rows });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activities' });
  }
});

router.get('/activities/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM wellness_activities WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Activity not found' });
    const stages = await db.query('SELECT * FROM wellness_activity_stages WHERE activity_id = $1 ORDER BY stage_number', [req.params.id]);
    res.json({ success: true, activity: { ...result.rows[0], stages: stages.rows } });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

router.post('/activities', requireStaff, async (req, res) => {
  const { values, error } = activityInput(req.body);
  if (error) return res.status(400).json({ success: false, error });
  try {
    values.display_name = values.display_name || values.name;
    const cols = Object.keys(values);
    const result = await db.query(
      `INSERT INTO wellness_activities (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      cols.map((c) => values[c])
    );
    res.status(201).json({ success: true, message: 'Activity created', activity: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'An activity with this name already exists in this category' });
    console.error('Error creating activity:', err);
    res.status(500).json({ success: false, error: 'Failed to create activity' });
  }
});

router.put('/activities/:id', requireStaff, async (req, res) => {
  const { values, error } = activityInput(req.body, true);
  if (error) return res.status(400).json({ success: false, error });
  const cols = Object.keys(values);
  if (!cols.length) return res.status(400).json({ success: false, error: 'Nothing to update' });
  try {
    const result = await db.query(
      `UPDATE wellness_activities SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((c) => values[c]), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Activity not found' });
    res.json({ success: true, message: 'Activity updated', activity: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'An activity with this name already exists in this category' });
    console.error('Error updating activity:', err);
    res.status(500).json({ success: false, error: 'Failed to update activity' });
  }
});

// Retire an activity (kept for the bookings that reference it)
router.delete('/activities/:id', requireStaff, async (req, res) => {
  try {
    const result = await db.query('UPDATE wellness_activities SET is_active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Activity not found' });
    res.json({ success: true, message: 'Activity removed from the catalogue' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ success: false, error: 'Failed to delete activity' });
  }
});

// ============================================
// WELLNESS BOOKINGS — guests book through /api/wellness-unified; staff move a booking through its states
// here (HQ → Wellness → Bookings).
// ============================================
const BOOKING_MOVES = {
  upcoming: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
};

router.patch('/admin/bookings/:id', requireStaff, async (req, res) => {
  try {
    const { status, reason } = req.body;
    const current = await db.query('SELECT id, status, user_id, activity_name FROM wellness_bookings WHERE id = $1', [req.params.id]);
    const booking = current.rows[0];
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    if (!(BOOKING_MOVES[booking.status] || []).includes(status)) {
      return res.status(400).json({ success: false, error: `A ${booking.status.replace('_', ' ')} booking cannot become ${String(status).replace('_', ' ')}` });
    }
    const result = await db.query(
      `UPDATE wellness_bookings
          SET status = $1::varchar,
              cancelled_at = CASE WHEN $1::varchar = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
              cancellation_reason = CASE WHEN $1::varchar = 'cancelled' THEN $2 ELSE cancellation_reason END
        WHERE id = $3 RETURNING *`,
      [status, reason || null, booking.id]
    );
    if (status === 'cancelled' && booking.user_id) {
      notifyGuest(req.app, booking.user_id, { title: 'Wellness booking cancelled', body: `${booking.activity_name} was cancelled by the team.`, event: 'wellness:update' });
    }
    res.json({ success: true, booking: result.rows[0] });
  } catch (error) {
    console.error('Error updating wellness booking:', error);
    res.status(500).json({ success: false, error: 'Failed to update booking' });
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

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds 10MB limit' });
    }

    // The stored name is ours: the client's name only contributes a safe extension.
    const extension = (path.extname(String(fileName)).replace(/[^a-zA-Z0-9.]/g, '') || '.bin').slice(0, 10);
    const storedName = `${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
    await fs.writeFile(path.join(uploadDir, storedName), buffer);

    const publicUrl = `/uploads/chat/${storedName}`;
    const cdnUrl = `https://fayshaa.com${publicUrl}`;

    res.json({
      success: true,
      url: publicUrl,
      cdnUrl,
      fileName: storedName,
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

    query += ` ORDER BY wb.booking_date DESC, wb.start_time DESC`;
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
      notifyGuest(req.app, user_id, { title: 'Faysha concierge', body: String(messageData.message || '').slice(0, 160), event: 'message:push', data: { screen: 'Concierge' } });

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

module.exports = router;
