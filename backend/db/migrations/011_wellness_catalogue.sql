-- The wellness catalogue, fully managed from FAY OS → Wellness → Catalogue: where an experience happens and how a
-- guest gets in (some floors open with a PIN, golf and the pool are outdoors), photos for the experience and for each
-- stage of a journey, opening hours, booking notice, and equipment lent with it (golf → clubs and balls).
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS location_kind VARCHAR(12) NOT NULL DEFAULT 'indoor';   -- indoor, outdoor, residence, offsite
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS location VARCHAR(150);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS floor VARCHAR(20);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS access_mode VARCHAR(10) NOT NULL DEFAULT 'none';       -- none, pin, qr, staff
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]';
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(120);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS book_ahead_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS equipment_category VARCHAR(30);                       -- loans category lent with it
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'XAF';
UPDATE wellness_activities SET access_mode = 'pin' WHERE requires_access_pin AND access_mode = 'none';

ALTER TABLE wellness_activity_stages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE wellness_activity_stages ADD COLUMN IF NOT EXISTS floor VARCHAR(20);
ALTER TABLE wellness_activity_stages ADD COLUMN IF NOT EXISTS requires_pin BOOLEAN NOT NULL DEFAULT false;
