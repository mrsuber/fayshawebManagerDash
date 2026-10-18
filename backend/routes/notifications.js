// Notification API Routes
const express = require('express');
const router = express.Router();
const { requireStaff } = require('../middleware/auth');
const db = require('../config/database');
const {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendDataMessage
} = require('../services/notificationService');

/**
 * Register FCM token
 * POST /api/notifications/register
 */
router.post('/register', async (req, res) => {
  try {
    const { token, userId, platform = 'web', deviceInfo = {} } = req.body;

    // Validate required fields
    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Token and userId are required'
      });
    }

    // Check if token already exists
    const existingToken = await db.query(
      'SELECT * FROM fcm_tokens WHERE token = $1',
      [token]
    );

    if (existingToken.rows.length > 0) {
      // Update existing token
      await db.query(
        `UPDATE fcm_tokens
         SET user_id = $1, platform = $2, device_info = $3, is_active = true, updated_at = NOW()
         WHERE token = $4`,
        [userId, platform, JSON.stringify(deviceInfo), token]
      );

      return res.json({
        success: true,
        message: 'Token updated successfully',
        action: 'updated'
      });
    } else {
      // Insert new token
      await db.query(
        `INSERT INTO fcm_tokens (user_id, token, platform, device_info)
         VALUES ($1, $2, $3, $4)`,
        [userId, token, platform, JSON.stringify(deviceInfo)]
      );

      return res.json({
        success: true,
        message: 'Token registered successfully',
        action: 'created'
      });
    }
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register token'
    });
  }
});

/**
 * Unregister FCM token
 * POST /api/notifications/unregister
 */
router.post('/unregister', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    await db.query(
      'UPDATE fcm_tokens SET is_active = false WHERE token = $1',
      [token]
    );

    res.json({
      success: true,
      message: 'Token unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unregister token'
    });
  }
});

/**
 * Send notification to specific user
 * POST /api/notifications/send
 */
router.post('/send', requireStaff, async (req, res) => {
  try {
    const { userId, title, body, data = {}, icon, image } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'userId, title, and body are required'
      });
    }

    // Get active tokens for the user
    const result = await db.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active tokens found for user'
      });
    }

    const tokens = result.rows.map(row => row.token);

    // Send notification
    const response = await sendNotificationToMultipleDevices(
      tokens,
      { title, body, icon, image },
      data
    );

    // Remove invalid tokens from database
    if (response.responses) {
      const invalidTokens = response.responses
        .filter(r => !r.success && r.error?.includes('not-registered'))
        .map(r => r.token);

      if (invalidTokens.length > 0) {
        await db.query(
          'UPDATE fcm_tokens SET is_active = false WHERE token = ANY($1)',
          [invalidTokens]
        );
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

/**
 * Send notification to multiple users
 * POST /api/notifications/send-bulk
 */
router.post('/send-bulk', requireStaff, async (req, res) => {
  try {
    const { userIds, title, body, data = {}, icon, image } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'userIds (array), title, and body are required'
      });
    }

    // Get active tokens for the users
    const result = await db.query(
      'SELECT token FROM fcm_tokens WHERE user_id = ANY($1) AND is_active = true',
      [userIds]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active tokens found for users'
      });
    }

    const tokens = result.rows.map(row => row.token);

    // Send notification
    const response = await sendNotificationToMultipleDevices(
      tokens,
      { title, body, icon, image },
      data
    );

    res.json(response);
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

/**
 * Broadcast notification to all users
 * POST /api/notifications/broadcast
 */
router.post('/broadcast', requireStaff, async (req, res) => {
  try {
    const { title, body, data = {}, icon, image } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: 'title and body are required'
      });
    }

    // Send to topic (all users should subscribe to 'all_users' topic)
    const response = await sendNotificationToTopic(
      'all_users',
      { title, body, icon, image },
      data
    );

    res.json(response);
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast notification'
    });
  }
});

/**
 * Subscribe user to topic
 * POST /api/notifications/subscribe
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, topic } = req.body;

    if (!userId || !topic) {
      return res.status(400).json({
        success: false,
        error: 'userId and topic are required'
      });
    }

    // Get active tokens for the user
    const result = await db.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active tokens found for user'
      });
    }

    const tokens = result.rows.map(row => row.token);
    const response = await subscribeToTopic(tokens, topic);

    res.json(response);
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to topic'
    });
  }
});

/**
 * Unsubscribe user from topic
 * POST /api/notifications/unsubscribe
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { userId, topic } = req.body;

    if (!userId || !topic) {
      return res.status(400).json({
        success: false,
        error: 'userId and topic are required'
      });
    }

    // Get active tokens for the user
    const result = await db.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active tokens found for user'
      });
    }

    const tokens = result.rows.map(row => row.token);
    const response = await unsubscribeFromTopic(tokens, topic);

    res.json(response);
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from topic'
    });
  }
});

/**
 * Get user's registered tokens
 * GET /api/notifications/tokens/:userId
 */
router.get('/tokens/:userId', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      'SELECT id, token, platform, device_info, is_active, created_at, updated_at FROM fcm_tokens WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      tokens: result.rows
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens'
    });
  }
});

module.exports = router;
