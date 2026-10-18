-- Migration: Add User Profile Fields
-- Description: Add personal information fields for guest users
-- Created: 2026-09-17

-- ============================================
-- Add profile fields to users table
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS dietary_preferences TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);

-- Add comments
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth';
COMMENT ON COLUMN users.nationality IS 'User nationality';
COMMENT ON COLUMN users.emergency_contact IS 'Emergency contact person name';
COMMENT ON COLUMN users.emergency_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN users.dietary_preferences IS 'User dietary preferences (vegetarian, vegan, etc.)';
COMMENT ON COLUMN users.allergies IS 'User allergies';
COMMENT ON COLUMN users.profile_image_url IS 'URL to user profile image';

-- ============================================
-- Create index for phone lookup
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
