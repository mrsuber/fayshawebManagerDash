-- Migration: Create FCM Tokens Table
-- Description: Table to store Firebase Cloud Messaging tokens for push notifications
-- Created: 2026-02-22

-- Create fcm_tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) DEFAULT 'web' CHECK (platform IN ('web', 'ios', 'android')),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_platform ON fcm_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_active ON fcm_tokens(user_id, is_active);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER update_fcm_tokens_updated_at
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE fcm_tokens IS 'Stores Firebase Cloud Messaging tokens for push notifications';
COMMENT ON COLUMN fcm_tokens.id IS 'Primary key';
COMMENT ON COLUMN fcm_tokens.user_id IS 'Reference to user ID (foreign key to users table if it exists)';
COMMENT ON COLUMN fcm_tokens.token IS 'FCM registration token (unique)';
COMMENT ON COLUMN fcm_tokens.platform IS 'Device platform: web, ios, or android';
COMMENT ON COLUMN fcm_tokens.device_info IS 'JSON data about the device (user agent, browser, etc.)';
COMMENT ON COLUMN fcm_tokens.is_active IS 'Whether the token is currently active';
COMMENT ON COLUMN fcm_tokens.created_at IS 'When the token was first registered';
COMMENT ON COLUMN fcm_tokens.updated_at IS 'When the token was last updated';

-- Optional: If you have a users table, add foreign key constraint
-- ALTER TABLE fcm_tokens
--   ADD CONSTRAINT fk_fcm_tokens_user_id
--   FOREIGN KEY (user_id)
--   REFERENCES users(id)
--   ON DELETE CASCADE;
