-- Enquiries from the website contact form (and later the app): kept in FAY OS for follow-up instead of only
-- being emailed. Each has a status, an owner and a thread of internal notes and replies sent to the enquirer.
CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(30) NOT NULL DEFAULT 'contact',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'website',
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'replied', 'closed', 'spam')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,          -- the guest account with this email, if any
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  first_response_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_email ON enquiries(lower(email));

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id SERIAL PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'reply', 'event')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enquiry_notes ON enquiry_notes(enquiry_id, created_at);
