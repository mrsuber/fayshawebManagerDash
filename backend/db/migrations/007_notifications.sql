-- Notifications that work as an operations monitor.
-- Staff: each alert has a level (info, action, urgent) and a category; alerts raised by the monitor carry a dedupe_key
-- so a condition is announced once, and are resolved automatically when the condition clears (resolved_at).
ALTER TABLE staff_notifications ADD COLUMN IF NOT EXISTS level VARCHAR(10) NOT NULL DEFAULT 'info';
ALTER TABLE staff_notifications ADD COLUMN IF NOT EXISTS category VARCHAR(30);
ALTER TABLE staff_notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(120);
ALTER TABLE staff_notifications ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_notifications_dedupe ON staff_notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_notifications_open ON staff_notifications(level, created_at DESC) WHERE resolved_at IS NULL;

-- Guests: everything the app tells a guest is kept, so the app has an inbox (push notifications can be missed).
CREATE TABLE IF NOT EXISTS guest_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  event VARCHAR(60),
  data JSONB NOT NULL DEFAULT '{}',
  dedupe_key VARCHAR(120),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guest_notifications_user ON guest_notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_notifications_dedupe ON guest_notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
