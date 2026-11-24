-- The staff desk: each team member has one conversation with the managers (My work → Messages, FAY OS → Team desk),
-- optionally about a task, with photos.
CREATE TABLE IF NOT EXISTS staff_messages (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,     -- whose conversation
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  from_staff BOOLEAN NOT NULL,                                          -- true: the team member wrote it
  body TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]',
  about JSONB,                                                          -- { kind: request | work_order, id, title }
  read_at TIMESTAMPTZ,                                                  -- read by the other side
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_messages_staff ON staff_messages(staff_id, created_at DESC);

-- Warnings a manager gives a team member: they see it in My work and acknowledge it (with their side, if they want).
CREATE TABLE IF NOT EXISTS staff_warnings (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level VARCHAR(10) NOT NULL CHECK (level IN ('verbal', 'written', 'final')),
  reason TEXT NOT NULL,
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_warnings_staff ON staff_warnings(staff_id, created_at DESC);

-- Photos of the finished work (requests already have resolution_attachments).
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
