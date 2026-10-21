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

    // The schema's foreign keys remove what belongs to the person (tokens, chat, wellness, notes, sign-ins)
    // and keep shared records (audit, approvals, reviews) with the reference cleared. Stays go too.
    await client.query('BEGIN');
    const wellness = await client.query('DELETE FROM wellness_bookings WHERE user_id = $1', [userId]);
    const stays = await client.query('DELETE FROM bookings WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');

    console.log(`[PERMANENT DELETE] ${req.user.email} deleted ${targetUser.email} (${stays.rowCount} stays, ${wellness.rowCount} wellness bookings)`);

    res.json({
      success: true,
      message: `User ${targetUser.email} and all associated data have been permanently deleted from the system`,
      summary: {
        user: { id: userId, email: targetUser.email, username: targetUser.username, full_name: targetUser.full_name },
        deleted_records: { apartment_bookings: stays.rowCount, wellness_bookings: wellness.rowCount }
      }
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
