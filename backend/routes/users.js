/**
 * User Management Routes
 * For superadmin to create and manage admin accounts
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const db = require('../config/database');
const {
  authenticateToken,
  requireRole,
  checkPermission,
  checkPasswordChangeRequired
} = require('../middleware/auth');

// All user management routes require authentication and password to be changed
router.use(authenticateToken);
router.use(checkPasswordChangeRequired);

/**
 * GET /api/users
 * Get all users (paginated)
 * Requires: users.view permission
 */
router.get('/', checkPermission('users', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;

    const result = await userService.getAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      role,
      status
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching users'
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 * Requires: users.view permission
 */
router.get('/:id', checkPermission('users', 'view'), async (req, res) => {
  try {
    const user = await userService.getUserById(parseInt(req.params.id));

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching user'
    });
  }
});

/**
 * POST /api/users
 * Create new user (admin account)
 * Requires: users.create permission (superadmin only)
 */
router.post('/', checkPermission('users', 'create'), async (req, res) => {
  try {
    const { email, username, fullName, roleId } = req.body;

    // Validation
    if (!email || !username || !fullName || !roleId) {
      return res.status(400).json({
        success: false,
        error: 'Email, username, full name, and role are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Username validation (alphanumeric and underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username can only contain letters, numbers, and underscores'
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 20 characters'
      });
    }

    // Check if email already exists
    const existingUserByEmail = await userService.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }

    // Check if username already exists
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken'
      });
    }

    // Verify role exists
    const roleCheck = await db.query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    // Only superadmin can create other superadmins
    if (roleCheck.rows[0].name === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Only superadmin can create other superadmin accounts'
      });
    }

    // Create user
    const result = await userService.createUser({
      email,
      username,
      fullName,
      roleId,
      createdBy: req.user.id,
      sendEmail: false // Set to true when email service is configured
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.user,
      temporaryPassword: result.temporaryPassword,
      verificationToken: result.verificationToken
    });

  } catch (error) {
    console.error('Create user error:', error);

    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Email or username already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'An error occurred while creating user'
    });
  }
});

/**
 * PATCH /api/users/:id/status
 * Update user status
 * Requires: users.edit permission
 */
router.patch('/:id/status', checkPermission('users', 'edit'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended', 'pending_verification'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Cannot change own status
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own status'
      });
    }

    // Get user to check role
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only superadmin can modify other superadmins
    if (targetUser.role_name === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Only superadmin can modify other superadmin accounts'
      });
    }

    const result = await userService.updateUserStatus(userId, status);

    res.json({
      success: true,
      message: 'User status updated successfully',
      user: result
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while updating user status'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (soft delete)
 * Requires: users.delete permission
 */
router.delete('/:id', checkPermission('users', 'delete'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Cannot delete yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Get user to check role
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only superadmin can delete other superadmins
    if (targetUser.role_name === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Only superadmin can delete other superadmin accounts'
      });
    }

    const result = await userService.deleteUser(userId);

    res.json({
      success: true,
      message: 'User deleted successfully',
      user: result
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while deleting user'
    });
  }
});

/**
 * DELETE /api/users/:id/permanent
 * PERMANENTLY delete user and ALL associated data from the system
 * Requires: superadmin role only
 * WARNING: This action is irreversible and will delete:
 * - User account
 * - All bookings
 * - All wellness data
 * - All messages
 * - All rewards
 * - Login history
 * - FCM tokens
 * - All other user-related data
 */
router.delete('/:id/permanent', async (req, res) => {
  const client = await db.pool.connect();

  try {
    const userId = parseInt(req.params.id);

    // ONLY superadmin can permanently delete users
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Only superadmin can permanently delete users'
      });
    }

    // Cannot delete yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Get user to verify existence and check role
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log(`[PERMANENT DELETE] Superadmin ${req.user.email} is permanently deleting user ${targetUser.email} (ID: ${userId})`);

    // Start transaction
    await client.query('BEGIN');

    // Delete from all related tables in the correct order (respecting foreign keys)
    // Tables are deleted in order from most dependent to least dependent

    // Delete wellness data (both OLD journey system and NEW unified system)
    console.log('[PERMANENT DELETE] Step 1: Deleting OLD journey booking stages...');
    const oldJourneyStages = await client.query('DELETE FROM wellness_journey_booking_stages WHERE booking_id IN (SELECT id FROM wellness_journey_bookings WHERE user_id = $1) RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${oldJourneyStages.rowCount} old journey booking stages`);

    console.log('[PERMANENT DELETE] Step 2: Deleting OLD journey bookings...');
    const journeyBookings = await client.query('DELETE FROM wellness_journey_bookings WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${journeyBookings.rowCount} old journey bookings`);

    console.log('[PERMANENT DELETE] Step 3: Deleting NEW unified booking stages...');
    const newBookingStages = await client.query('DELETE FROM wellness_booking_stages WHERE booking_id IN (SELECT id FROM wellness_bookings WHERE user_id = $1) RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${newBookingStages.rowCount} new unified booking stages`);

    console.log('[PERMANENT DELETE] Step 4: Deleting NEW unified wellness bookings...');
    const wellnessBookings = await client.query('DELETE FROM wellness_bookings WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${wellnessBookings.rowCount} new unified wellness bookings`);

    console.log('[PERMANENT DELETE] Step 5: Deleting wellness metrics...');
    const wellnessMetrics = await client.query('DELETE FROM wellness_metrics WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${wellnessMetrics.rowCount} wellness metrics`);

    console.log('[PERMANENT DELETE] Step 6: Deleting apartment bookings...');
    const bookings = await client.query('DELETE FROM bookings WHERE user_id = $1 RETURNING id, booking_number', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${bookings.rowCount} apartment bookings`);

    console.log('[PERMANENT DELETE] Step 7: Deleting concierge messages...');
    const messages = await client.query('DELETE FROM concierge_messages WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${messages.rowCount} concierge messages`);

    console.log('[PERMANENT DELETE] Step 8: Deleting deposit box history...');
    const depositBox = await client.query('DELETE FROM deposit_box_history WHERE user_id = $1 OR collected_by_user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${depositBox.rowCount} deposit box history records`);

    console.log('[PERMANENT DELETE] Step 9: Deleting smart home controls...');
    const smartHome = await client.query('DELETE FROM smart_home_controls WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${smartHome.rowCount} smart home control records`);

    console.log('[PERMANENT DELETE] Step 10: Deleting rewards redemptions...');
    const redemptions = await client.query('DELETE FROM rewards_redemptions WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${redemptions.rowCount} rewards redemptions`);

    console.log('[PERMANENT DELETE] Step 11: Deleting rewards transactions...');
    const rewardsTransactions = await client.query('DELETE FROM rewards_transactions WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${rewardsTransactions.rowCount} rewards transactions`);

    console.log('[PERMANENT DELETE] Step 12: Deleting user rewards...');
    const userRewards = await client.query('DELETE FROM user_rewards WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${userRewards.rowCount} user rewards`);

    console.log('[PERMANENT DELETE] Step 13: Deleting FCM tokens...');
    const fcmTokens = await client.query('DELETE FROM fcm_tokens WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${fcmTokens.rowCount} FCM tokens`);

    console.log('[PERMANENT DELETE] Step 14: Deleting login history...');
    const loginHistory = await client.query('DELETE FROM login_history WHERE user_id = $1 RETURNING id', [userId]);
    console.log(`[PERMANENT DELETE] Deleted ${loginHistory.rowCount} login history records`);

    console.log('[PERMANENT DELETE] Step 15: Updating feedback records (removing user references)...');
    await client.query('UPDATE feedback SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await client.query('UPDATE feedback SET approved_by = NULL WHERE approved_by = $1', [userId]);
    console.log('[PERMANENT DELETE] Updated feedback records');

    console.log('[PERMANENT DELETE] Step 16: Updating availability overrides (removing user references)...');
    await client.query('UPDATE availability_overrides SET created_by = NULL WHERE created_by = $1', [userId]);
    console.log('[PERMANENT DELETE] Updated availability overrides');

    console.log('[PERMANENT DELETE] Step 17: Updating users table (removing created_by references)...');
    await client.query('UPDATE users SET created_by = NULL WHERE created_by = $1', [userId]);
    console.log('[PERMANENT DELETE] Updated users created_by references');

    console.log('[PERMANENT DELETE] Step 18: DELETING USER ACCOUNT...');
    const deletedUser = await client.query(`
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email, username, full_name, role_id
    `, [userId]);
    console.log(`[PERMANENT DELETE] User account deleted: ${targetUser.email}`);

    // Commit transaction
    await client.query('COMMIT');

    // Prepare summary
    const summary = {
      user: {
        id: deletedUser.rows[0].id,
        email: targetUser.email,
        username: targetUser.username,
        full_name: targetUser.full_name
      },
      deleted_records: {
        old_journey_booking_stages: oldJourneyStages.rowCount,
        old_journey_bookings: journeyBookings.rowCount,
        new_unified_booking_stages: newBookingStages.rowCount,
        new_unified_wellness_bookings: wellnessBookings.rowCount,
        wellness_metrics: wellnessMetrics.rowCount,
        apartment_bookings: bookings.rowCount,
        concierge_messages: messages.rowCount,
        deposit_box_history: depositBox.rowCount,
        smart_home_controls: smartHome.rowCount,
        rewards_redemptions: redemptions.rowCount,
        rewards_transactions: rewardsTransactions.rowCount,
        user_rewards: userRewards.rowCount,
        fcm_tokens: fcmTokens.rowCount,
        login_history: loginHistory.rowCount
      },
      total_records_deleted:
        oldJourneyStages.rowCount +
        journeyBookings.rowCount +
        newBookingStages.rowCount +
        wellnessBookings.rowCount +
        wellnessMetrics.rowCount +
        bookings.rowCount +
        messages.rowCount +
        depositBox.rowCount +
        smartHome.rowCount +
        redemptions.rowCount +
        rewardsTransactions.rowCount +
        userRewards.rowCount +
        fcmTokens.rowCount +
        loginHistory.rowCount + 1 // +1 for user account
    };

    console.log(`[PERMANENT DELETE] SUCCESS! Total ${summary.total_records_deleted} records permanently deleted for user ${targetUser.email}`);

    res.json({
      success: true,
      message: `User ${targetUser.email} and all associated data have been permanently deleted from the system`,
      summary: summary
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PERMANENT DELETE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while permanently deleting user',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/users/roles/all
 * Get all available roles
 * Requires: authentication
 */
router.get('/roles/all', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, display_name, description, permissions
      FROM roles
      ORDER BY
        CASE name
          WHEN 'superadmin' THEN 1
          WHEN 'content_manager' THEN 2
          WHEN 'editor' THEN 3
          ELSE 4
        END
    `);

    res.json({
      success: true,
      roles: result.rows
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching roles'
    });
  }
});

/**
 * GET /api/users/:id/login-history
 * Get user login history
 * Requires: users.view permission
 */
router.get('/:id/login-history', checkPermission('users', 'view'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { limit = 20 } = req.query;

    const result = await db.query(`
      SELECT
        id,
        ip_address,
        user_agent,
        login_successful,
        failure_reason,
        created_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, parseInt(limit)]);

    res.json({
      success: true,
      history: result.rows
    });
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching login history'
    });
  }
});

/**
 * POST /api/users/:id/unlock
 * Unlock a locked user account
 * Requires: users.edit permission
 */
router.post('/:id/unlock', checkPermission('users', 'edit'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Cannot unlock yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot unlock your own account'
      });
    }

    // Get user to check if exists
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Unlock the account by resetting failed login attempts
    const result = await db.query(`
      UPDATE users
      SET
        login_attempts = 0,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, username, full_name, login_attempts, locked_until
    `, [userId]);

    res.json({
      success: true,
      message: 'Account unlocked successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while unlocking user account'
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user profile (admin)
 * Requires: users.edit permission
 */
router.put('/:id', checkPermission('users', 'edit'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const {
      fullName,
      phone,
      dateOfBirth,
      nationality,
      emergencyContact,
      emergencyPhone,
      dietaryPreferences,
      allergies,
      profileImageUrl
    } = req.body;

    // Get user to check if exists
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only superadmin can modify other superadmins
    if (targetUser.role_name === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Only superadmin can modify other superadmin accounts'
      });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone || null);
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount++}`);
      values.push(dateOfBirth || null);
    }
    if (nationality !== undefined) {
      updates.push(`nationality = $${paramCount++}`);
      values.push(nationality || null);
    }
    if (emergencyContact !== undefined) {
      updates.push(`emergency_contact = $${paramCount++}`);
      values.push(emergencyContact || null);
    }
    if (emergencyPhone !== undefined) {
      updates.push(`emergency_phone = $${paramCount++}`);
      values.push(emergencyPhone || null);
    }
    if (dietaryPreferences !== undefined) {
      updates.push(`dietary_preferences = $${paramCount++}`);
      values.push(dietaryPreferences || null);
    }
    if (allergies !== undefined) {
      updates.push(`allergies = $${paramCount++}`);
      values.push(allergies || null);
    }
    if (profileImageUrl !== undefined) {
      updates.push(`profile_image_url = $${paramCount++}`);
      values.push(profileImageUrl || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add user ID as last parameter
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING id, email, username, full_name, phone, date_of_birth, nationality,
                emergency_contact, emergency_phone, dietary_preferences, allergies,
                profile_image_url, updated_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'User profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        phone: updatedUser.phone,
        dateOfBirth: updatedUser.date_of_birth,
        nationality: updatedUser.nationality,
        emergencyContact: updatedUser.emergency_contact,
        emergencyPhone: updatedUser.emergency_phone,
        dietaryPreferences: updatedUser.dietary_preferences,
        allergies: updatedUser.allergies,
        profileImageUrl: updatedUser.profile_image_url,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while updating user profile'
    });
  }
});

module.exports = router;
