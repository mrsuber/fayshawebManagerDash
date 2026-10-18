/**
 * Authentication Middleware
 * Handles JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user still exists and is active
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
        r.name as role_name,
        r.display_name as role_display_name,
        r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact administrator.`
      });
    }

    // Check if account is locked
    const lockCheck = await db.query(
      'SELECT locked_until FROM users WHERE id = $1',
      [user.id]
    );

    if (lockCheck.rows[0].locked_until && new Date(lockCheck.rows[0].locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts.'
      });
    }

    // "View as" tokens (HQ → Staff → View as) let a super administrator see what someone else sees.
    // They are strictly read-only: anything that would change data is refused here, for every route.
    if (decoded.imp) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return res.status(403).json({
          success: false,
          error: 'View-as mode is read-only.',
          message: 'View-as mode is read-only. Return to HQ to make changes.'
        });
      }
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      role: user.role_name,
      roleDisplayName: user.role_display_name,
      permissions: user.permissions,
      emailVerified: user.email_verified,
      mustChangePassword: user.must_change_password,
      isPasswordTemporary: user.is_password_temporary,
      impersonatedBy: decoded.imp || null
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.'
    });
  }
};

/**
 * Check if user has specific permission
 * @param {string} resource - Resource name (e.g., 'users', 'content')
 * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
 */
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    try {
      const { permissions } = req.user;

      // SuperAdmin has all permissions
      if (req.user.role === 'superadmin') {
        return next();
      }

      // Check if user has the specific permission
      if (
        permissions &&
        permissions[resource] &&
        permissions[resource][action] === true
      ) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
        required: { resource, action }
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions.'
      });
    }
  };
};

/**
 * Check if user has one of the specified roles
 * @param {string[]} allowedRoles - Array of role names
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied. Insufficient role privileges.',
      required: allowedRoles,
      current: req.user.role
    });
  };
};

/**
 * Check if password change is required
 * Allows only password change endpoint if mustChangePassword is true
 */
const checkPasswordChangeRequired = (req, res, next) => {
  // Skip check for password change endpoint
  if (req.path === '/auth/change-password' || req.path === '/auth/logout') {
    return next();
  }

  if (req.user && req.user.mustChangePassword) {
    return res.status(403).json({
      success: false,
      error: 'Password change required.',
      mustChangePassword: true,
      message: 'You must change your password before accessing other resources.'
    });
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    await authenticateToken(req, res, next);
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Signed-in user from the Authorization header, or null — never responds or throws.
 * For routes that are public but do more for staff (e.g. confirming a booking without payment).
 */
const userFromRequest = async (req) => {
  try {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return null;
    const { userId, imp } = jwt.verify(token, JWT_SECRET);
    // View-as tokens never unlock staff-only behaviour on public routes.
    if (imp) return null;
    const result = await db.query(
      `SELECT u.id, u.email, u.full_name, r.name AS role
         FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status = 'active'`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    return null;
  }
};

/** Roles that run the property: the superadmin (/admin) and managers (/manager). */
const STAFF_ROLES = ['superadmin', 'manager'];

/** Middleware chain for operational endpoints used by /admin and /manager. */
const requireStaff = [authenticateToken, requireRole(...STAFF_ROLES)];

module.exports = {
  authenticateToken,
  userFromRequest,
  STAFF_ROLES,
  requireStaff,
  checkPermission,
  requireRole,
  checkPasswordChangeRequired,
  optionalAuth
};
