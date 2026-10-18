-- Migration: Create Users and Roles Tables
-- Description: Complete RBAC system with users, roles, and permissions
-- Created: 2026-02-28

-- ============================================
-- 1. Create ENUM types
-- ============================================

-- User status enum
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

-- ============================================
-- 2. Create roles table
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false, -- Cannot be deleted if true
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE roles IS 'System roles for role-based access control';
COMMENT ON COLUMN roles.permissions IS 'JSON object containing permissions: {"content": {"create": true, "edit": true}, "users": {"view": true}}';
COMMENT ON COLUMN roles.is_system_role IS 'System roles (superadmin, admin) cannot be deleted';

-- ============================================
-- 3. Create users table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,

  -- Role and status
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status user_status DEFAULT 'pending_verification',

  -- Password management
  is_password_temporary BOOLEAN DEFAULT false,
  must_change_password BOOLEAN DEFAULT false,
  password_changed_at TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,

  -- Email verification
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP,

  -- Login tracking
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,

  -- Audit fields
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP -- Soft delete
);

-- Add comments
COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON COLUMN users.is_password_temporary IS 'True if password was set by admin (one-time password)';
COMMENT ON COLUMN users.must_change_password IS 'Forces user to change password on next login';
COMMENT ON COLUMN users.login_attempts IS 'Failed login attempts counter (resets on successful login)';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this time after too many failed attempts';
COMMENT ON COLUMN users.created_by IS 'ID of the user who created this account (superadmin)';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp';

-- ============================================
-- 4. Create login history table (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS login_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  login_successful BOOLEAN NOT NULL,
  failure_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE login_history IS 'Audit log of all login attempts';

-- ============================================
-- 5. Create indexes for performance
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);

-- Login history indexes
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at);

-- Roles table indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ============================================
-- 6. Create triggers
-- ============================================

-- Update updated_at timestamp for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for roles
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Insert default roles
-- ============================================

INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
(
  'superadmin',
  'Super Administrator',
  'Full system access - can manage everything including creating admin accounts',
  '{
    "users": {"view": true, "create": true, "edit": true, "delete": true},
    "content": {"view": true, "create": true, "edit": true, "delete": true, "publish": true},
    "pages": {"view": true, "create": true, "edit": true, "delete": true, "publish": true},
    "media": {"view": true, "upload": true, "delete": true},
    "settings": {"view": true, "edit": true},
    "roles": {"view": true, "create": true, "edit": true, "delete": false},
    "analytics": {"view": true},
    "notifications": {"send": true, "manage": true}
  }',
  true
),
(
  'content_manager',
  'Content Manager',
  'Can create, edit, and publish website content',
  '{
    "users": {"view": false, "create": false, "edit": false, "delete": false},
    "content": {"view": true, "create": true, "edit": true, "delete": true, "publish": true},
    "pages": {"view": true, "create": true, "edit": true, "delete": false, "publish": true},
    "media": {"view": true, "upload": true, "delete": true},
    "settings": {"view": false, "edit": false},
    "roles": {"view": false, "create": false, "edit": false, "delete": false},
    "analytics": {"view": true},
    "notifications": {"send": false, "manage": false}
  }',
  true
),
(
  'editor',
  'Editor',
  'Can create and edit content but cannot publish',
  '{
    "users": {"view": false, "create": false, "edit": false, "delete": false},
    "content": {"view": true, "create": true, "edit": true, "delete": false, "publish": false},
    "pages": {"view": true, "create": true, "edit": true, "delete": false, "publish": false},
    "media": {"view": true, "upload": true, "delete": false},
    "settings": {"view": false, "edit": false},
    "roles": {"view": false, "create": false, "edit": false, "delete": false},
    "analytics": {"view": false},
    "notifications": {"send": false, "manage": false}
  }',
  true
);

-- ============================================
-- 8. Create default superadmin user
-- ============================================
-- Password: Admin@2024! (hashed with bcrypt)
-- IMPORTANT: Change this password immediately after first login!

INSERT INTO users (
  email,
  username,
  password_hash,
  full_name,
  role_id,
  status,
  email_verified,
  is_password_temporary,
  must_change_password
) VALUES (
  'admin@fayshaa.com',
  'superadmin',
  '$2b$10$rQZ5Z9Z5Z9Z5Z9Z5Z9Z5ZuDummy.Hash.Replace.In.Code',  -- This will be replaced by actual hash in code
  'Super Administrator',
  (SELECT id FROM roles WHERE name = 'superadmin'),
  'active',
  true,
  true,
  true
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 9. Update fcm_tokens table to reference users
-- ============================================

-- Add foreign key to users table if fcm_tokens exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fcm_tokens') THEN
    -- Add foreign key constraint
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_fcm_tokens_user_id'
    ) THEN
      ALTER TABLE fcm_tokens
        ADD CONSTRAINT fk_fcm_tokens_user_id
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================
-- 10. Create useful views
-- ============================================

-- View for active users with role info
CREATE OR REPLACE VIEW active_users_view AS
SELECT
  u.id,
  u.email,
  u.username,
  u.full_name,
  u.status,
  u.email_verified,
  u.last_login,
  r.name as role_name,
  r.display_name as role_display_name,
  r.permissions,
  u.created_at,
  u.updated_at
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.deleted_at IS NULL;

COMMENT ON VIEW active_users_view IS 'Active users with their role information';
