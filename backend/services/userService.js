/**
 * User Service
 * Handles all user-related business logic
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');

/**
 * Generate a secure random password
 */
const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Generate email verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new user (called by superadmin)
 */
const createUser = async ({
  email,
  username,
  fullName,
  roleId,
  createdBy,
  sendEmail = false
}) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Generate temporary password
    const temporaryPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Generate email verification token
    const emailVerificationToken = generateVerificationToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert user
    const result = await client.query(`
      INSERT INTO users (
        email,
        username,
        password_hash,
        full_name,
        role_id,
        status,
        is_password_temporary,
        must_change_password,
        email_verification_token,
        email_verification_expires,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, username, full_name, status, created_at
    `, [
      email,
      username,
      passwordHash,
      fullName,
      roleId,
      'pending_verification',
      true, // is_password_temporary
      true, // must_change_password
      emailVerificationToken,
      emailVerificationExpires,
      createdBy
    ]);

    await client.query('COMMIT');

    const user = result.rows[0];

    // TODO: Send email with temporary password and verification link
    if (sendEmail) {
      // This would integrate with your email service
      console.log('📧 Email would be sent to:', email);
      console.log('Temporary password:', temporaryPassword);
      console.log('Verification token:', emailVerificationToken);
    }

    return {
      user,
      temporaryPassword, // Return this so admin can share it
      verificationToken: emailVerificationToken
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Verify email with token
 */
const verifyEmail = async (token) => {
  const result = await db.query(`
    UPDATE users
    SET
      email_verified = true,
      email_verification_token = NULL,
      email_verification_expires = NULL,
      status = CASE
        WHEN status = 'pending_verification' THEN 'active'::user_status
        ELSE status
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      email_verification_token = $1
      AND email_verification_expires > NOW()
      AND deleted_at IS NULL
    RETURNING id, email, username
  `, [token]);

  if (result.rows.length === 0) {
    throw new Error('Invalid or expired verification token');
  }

  return result.rows[0];
};

/**
 * Change password
 */
const changePassword = async (userId, oldPassword, newPassword) => {
  const client = await db.getClient();

  try {
    // Get current password hash
    const userResult = await client.query(
      'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await client.query(`
      UPDATE users
      SET
        password_hash = $1,
        is_password_temporary = false,
        must_change_password = false,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newPasswordHash, userId]);

    return { success: true };
  } finally {
    client.release();
  }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (email) => {
  const emailService = require('./email.service');
  const resetToken = generateVerificationToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const result = await db.query(`
    UPDATE users
    SET
      password_reset_token = $1,
      password_reset_expires = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      email = $3
      AND deleted_at IS NULL
      AND status = 'active'
    RETURNING id, email, full_name
  `, [resetToken, resetExpires, email]);

  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return { success: true, message: 'If the email exists, a reset link will be sent.' };
  }

  const user = result.rows[0];

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      userName: user.full_name,
      resetToken: resetToken
    });

    console.log(`✅ Password reset email sent to: ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }

  return {
    success: true,
    message: 'Password reset email sent successfully.'
  };
};

/**
 * Reset password with token
 */
const resetPassword = async (token, newPassword) => {
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  const result = await db.query(`
    UPDATE users
    SET
      password_hash = $1,
      password_reset_token = NULL,
      password_reset_expires = NULL,
      is_password_temporary = false,
      must_change_password = false,
      password_changed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      password_reset_token = $2
      AND password_reset_expires > NOW()
      AND deleted_at IS NULL
    RETURNING id, email, username
  `, [newPasswordHash, token]);

  if (result.rows.length === 0) {
    throw new Error('Invalid or expired reset token');
  }

  return result.rows[0];
};

/**
 * Get user by email
 */
const getUserByEmail = async (email) => {
  const result = await db.query(`
    SELECT
      u.id,
      u.email,
      u.username,
      u.password_hash,
      u.full_name,
      u.status,
      u.email_verified,
      u.must_change_password,
      u.is_password_temporary,
      u.login_attempts,
      u.locked_until,
      r.id as role_id,
      r.name as role_name,
      r.display_name as role_display_name,
      r.permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.email = $1 AND u.deleted_at IS NULL
  `, [email]);

  return result.rows[0] || null;
};

/**
 * Get user by username (for authentication)
 */
const getUserByUsername = async (username) => {
  const result = await db.query(`
    SELECT
      u.id,
      u.email,
      u.username,
      u.password_hash,
      u.full_name,
      u.status,
      u.email_verified,
      u.must_change_password,
      u.is_password_temporary,
      u.login_attempts,
      u.locked_until,
      r.id as role_id,
      r.name as role_name,
      r.display_name as role_display_name,
      r.permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.username = $1 AND u.deleted_at IS NULL
  `, [username]);

  return result.rows[0] || null;
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
  const result = await db.query(`
    SELECT
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.status,
      u.email_verified,
      u.must_change_password,
      u.is_password_temporary,
      u.last_login,
      u.created_at,
      u.updated_at,
      r.id as role_id,
      r.name as role_name,
      r.display_name as role_display_name,
      r.permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1 AND u.deleted_at IS NULL
  `, [userId]);

  return result.rows[0] || null;
};

/**
 * Update login attempts and lock account if needed
 */
const recordFailedLogin = async (userId, ipAddress, userAgent) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Increment login attempts
    const result = await client.query(`
      UPDATE users
      SET login_attempts = login_attempts + 1
      WHERE id = $1
      RETURNING login_attempts
    `, [userId]);

    const attempts = result.rows[0].login_attempts;

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      const lockDuration = 30 * 60 * 1000; // 30 minutes
      await client.query(`
        UPDATE users
        SET locked_until = $1
        WHERE id = $2
      `, [new Date(Date.now() + lockDuration), userId]);
    }

    // Record in login history
    await client.query(`
      INSERT INTO login_history (user_id, ip_address, user_agent, login_successful, failure_reason)
      VALUES ($1, $2, $3, false, $4)
    `, [userId, ipAddress, userAgent, 'Invalid password']);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Record successful login
 */
const recordSuccessfulLogin = async (userId, ipAddress, userAgent) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Reset login attempts and update last login
    await client.query(`
      UPDATE users
      SET
        login_attempts = 0,
        locked_until = NULL,
        last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    // Record in login history
    await client.query(`
      INSERT INTO login_history (user_id, ip_address, user_agent, login_successful)
      VALUES ($1, $2, $3, true)
    `, [userId, ipAddress, userAgent]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get all users (with filtering and pagination)
 */
const getAllUsers = async ({ page = 1, limit = 10, role = null, status = null }) => {
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.status,
      u.email_verified,
      u.last_login,
      u.login_attempts as failed_login_attempts,
      u.locked_until as account_locked_until,
      u.created_at,
      r.name as role_name,
      r.display_name as role_display_name,
      CASE
        WHEN u.locked_until IS NOT NULL AND u.locked_until > NOW() THEN true
        ELSE false
      END as is_locked
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.deleted_at IS NULL
  `;

  const params = [];
  let paramCount = 0;

  if (role) {
    paramCount++;
    query += ` AND r.name = $${paramCount}`;
    params.push(role);
  }

  if (status) {
    paramCount++;
    query += ` AND u.status = $${paramCount}`;
    params.push(status);
  }

  query += ` ORDER BY u.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE u.deleted_at IS NULL';
  const countParams = [];

  if (role) {
    countQuery += ' AND r.name = $1';
    countParams.push(role);
  }

  if (status) {
    countQuery += role ? ' AND u.status = $2' : ' AND u.status = $1';
    countParams.push(status);
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  return {
    users: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Update user status
 */
const updateUserStatus = async (userId, status) => {
  const result = await db.query(`
    UPDATE users
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND deleted_at IS NULL
    RETURNING id, email, status
  `, [status, userId]);

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

/**
 * Delete user (soft delete)
 */
const deleteUser = async (userId) => {
  const result = await db.query(`
    UPDATE users
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, email
  `, [userId]);

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  verifyEmail,
  changePassword,
  requestPasswordReset,
  resetPassword,
  recordFailedLogin,
  recordSuccessfulLogin,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  generateRandomPassword
};
