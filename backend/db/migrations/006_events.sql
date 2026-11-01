-- Events at Faysha (weddings, celebrations, corporate days, retreats). Prices depend on each brief, so the flow is:
--   enquiry (website, app or staff) → assessing → quoted (a tailored quote sent with a private link)
--   → accepted by the client → confirmed once the deposit arrives → completed (and told as a story),
--   or declined / cancelled / lost.
CREATE TABLE IF NOT EXISTS event_requests (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(10) NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'app', 'staff')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  organisation VARCHAR(255),
  event_type VARCHAR(30) NOT NULL,                     -- wedding, engagement, birthday, anniversary, corporate, conference, retreat, private_dinner, other
  title VARCHAR(200),
  event_date DATE,
  flexible_dates BOOLEAN NOT NULL DEFAULT false,
  alt_date DATE,
  start_time VARCHAR(5),
  end_time VARCHAR(5),
  guests INTEGER NOT NULL CHECK (guests > 0),
  spaces JSONB NOT NULL DEFAULT '[]',                  -- preferred spaces
  catering VARCHAR(20) NOT NULL DEFAULT 'faysha',      -- faysha (our restaurant), external, none
  catering_style VARCHAR(20),                          -- plated, buffet, cocktail, family, bbq
  dietary TEXT,
  services JSONB NOT NULL DEFAULT '[]',                -- decor, sound, photo, video, cake, transport, security, wellness, kids, officiant…
  rooms_needed INTEGER NOT NULL DEFAULT 0,             -- residences for guests staying over
  budget_min NUMERIC(14, 2),
  budget_max NUMERIC(14, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
  message TEXT,
  heard_from VARCHAR(80),
  status VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assessing', 'quoted', 'accepted', 'confirmed', 'completed', 'declined', 'cancelled', 'lost')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deposit_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  deposit_paid_at TIMESTAMPTZ,
  story_id INTEGER REFERENCES stories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_requests_status ON event_requests(status, event_date);
CREATE INDEX IF NOT EXISTS idx_event_requests_user ON event_requests(user_id);

-- Quotes: each revision is a new row; sending one supersedes the previous. The client opens it with `token`.
CREATE TABLE IF NOT EXISTS event_quotes (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
  items JSONB NOT NULL DEFAULT '[]',                   -- [{ label, detail, qty, unit, unitPrice }]
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,           -- percent
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  deposit_percent NUMERIC(5, 2) NOT NULL DEFAULT 30,
  deposit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,                                          -- what is included, payment terms (shown to the client)
  status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'superseded', 'expired')),
  token VARCHAR(64) UNIQUE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_name VARCHAR(255),
  response_note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, version)
);

CREATE TABLE IF NOT EXISTS event_notes (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'reply', 'event', 'client')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_notes ON event_notes(event_id, created_at);
