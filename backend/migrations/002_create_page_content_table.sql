-- Create page_content table for storing CMS content
CREATE TABLE IF NOT EXISTS page_content (
    id SERIAL PRIMARY KEY,
    page_id VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    section VARCHAR(100) NOT NULL,
    content_key VARCHAR(100),
    content_value TEXT,
    content_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(page_id, language, section, content_key)
);

-- Create indexes for faster queries
CREATE INDEX idx_page_content_page_id ON page_content(page_id);
CREATE INDEX idx_page_content_language ON page_content(language);
CREATE INDEX idx_page_content_page_lang ON page_content(page_id, language);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_page_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_page_content_updated_at ON page_content;
CREATE TRIGGER update_page_content_updated_at
    BEFORE UPDATE ON page_content
    FOR EACH ROW
    EXECUTE FUNCTION update_page_content_updated_at();

-- Add comments
COMMENT ON TABLE page_content IS 'Stores multilingual content for website pages';
COMMENT ON COLUMN page_content.page_id IS 'Page identifier (home, about, contact, etc.)';
COMMENT ON COLUMN page_content.language IS 'Language code (en, fr, etc.)';
COMMENT ON COLUMN page_content.section IS 'Section of the page (hero, features, etc.)';
COMMENT ON COLUMN page_content.content_key IS 'Specific content key within section';
COMMENT ON COLUMN page_content.content_value IS 'Simple text value';
COMMENT ON COLUMN page_content.content_json IS 'Complex JSON content';
