-- Visitors who come on their own, and visitors who end up staying the night.
-- The pass can be emailed to the visitor (QR + code) instead of the resident forwarding it.
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS visitor_email VARCHAR(200);
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- An overnight guest can be discreet like a pass ("Private guest" in staff lists; the gate still sees the name),
-- and can come from a visitor pass ("staying the night"), whose QR then stays valid for the registered nights.
ALTER TABLE stay_guests ADD COLUMN IF NOT EXISTS discreet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stay_guests ADD COLUMN IF NOT EXISTS pass_id INTEGER REFERENCES visitor_passes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stay_guests_pass ON stay_guests(pass_id) WHERE pass_id IS NOT NULL;
