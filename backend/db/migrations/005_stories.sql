-- Stories: the website's journal of events held at Faysha (weddings, retreats, celebrations) and news.
-- Written and published from FAY OS → Content → Stories.
CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(400),
  body TEXT NOT NULL DEFAULT '',                       -- Markdown
  category VARCHAR(30) NOT NULL DEFAULT 'event',       -- wedding, corporate, celebration, retreat, wellness, news
  cover_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]',                 -- ["/uploads/content/…", …]
  event_date DATE,
  guests INTEGER,
  status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stories_published ON stories(status, published_at DESC);
