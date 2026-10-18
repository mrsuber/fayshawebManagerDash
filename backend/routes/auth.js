/**
 * Authentication Routes
 * Handles login, logout, password management, and email verification
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const { authenticateToken, checkPasswordChangeRequired } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/login
 * Login with email/username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email/username and password are required'
      });
    }

    // Get user by email or username
    let user = await userService.getUserByEmail(emailOrUsername);

    if (!user) {
      // Try by username
      user = await userService.getUserByUsername(emailOrUsername);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Record failed login
      await userService.recordFailedLogin(
        user.id,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact administrator.`,
        status: user.status
      });
    }

    // Record successful login
    await userService.recordSuccessfulLogin(
      user.id,
      req.ip,
      req.headers['user-agent']
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role_name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return user data and token
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role_name,
        roleDisplayName: user.role_display_name,
        permissions: user.permissions,
        emailVerified: user.email_verified,
        mustChangePassword: user.must_change_password,
        isPasswordTemporary: user.is_password_temporary
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, but we can add token blacklist later)
 */
router.post('/logout', authenticateToken, (req, res) => {
  // In a more advanced setup, you could blacklist the token here
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        nationality: user.nationality,
        emergencyContact: user.emergency_contact,
        emergencyPhone: user.emergency_phone,
        dietaryPreferences: user.dietary_preferences,
        allergies: user.allergies,
        profileImageUrl: user.profile_image_url,
        role: user.role_name,
        roleDisplayName: user.role_display_name,
        permissions: user.permissions,
        emailVerified: user.email_verified,
        mustChangePassword: user.must_change_password,
        isPasswordTemporary: user.is_password_temporary,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching user data'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile information
 */
router.put('/profile', authenticateToken, checkPasswordChangeRequired, async (req, res) => {
  try {
    const {
      fullName,
      phone,
      dateOfBirth,
      nationality,
      emergencyContact,
      emergencyPhone,
      dietaryPreferences,
      allergies
    } = req.body;

    const userId = req.user.id;

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
      values.push(phone);
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount++}`);
      values.push(dateOfBirth || null);
    }
    if (nationality !== undefined) {
      updates.push(`nationality = $${paramCount++}`);
      values.push(nationality);
    }
    if (emergencyContact !== undefined) {
      updates.push(`emergency_contact = $${paramCount++}`);
      values.push(emergencyContact);
    }
    if (emergencyPhone !== undefined) {
      updates.push(`emergency_phone = $${paramCount++}`);
      values.push(emergencyPhone);
    }
    if (dietaryPreferences !== undefined) {
      updates.push(`dietary_preferences = $${paramCount++}`);
      values.push(dietaryPreferences);
    }
    if (allergies !== undefined) {
      updates.push(`allergies = $${paramCount++}`);
      values.push(allergies);
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
                emergency_contact, emergency_phone, dietary_preferences, allergies, updated_at
    `;

    const db = require('../config/database');
    const result = await db.pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
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
        updatedAt: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while updating profile'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (for logged in users)
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All password fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match'
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain uppercase, lowercase, numbers, and special characters'
      });
    }

    // Change password
    await userService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);

    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'An error occurred while changing password'
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    const user = await userService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);

    if (error.message === 'Invalid or expired verification token') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'An error occurred during email verification'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await userService.requestPasswordReset(email);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while processing password reset request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and password fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const user = await userService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);

    if (error.message === 'Invalid or expired reset token') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'An error occurred while resetting password'
    });
  }
});

/**
 * GET /api/auth/check-password-requirements
 * Check if user needs to change password
 */
router.get('/check-password-requirements', authenticateToken, (req, res) => {
  res.json({
    success: true,
    mustChangePassword: req.user.mustChangePassword,
    isPasswordTemporary: req.user.isPasswordTemporary,
    emailVerified: req.user.emailVerified
  });
});

module.exports = router;
