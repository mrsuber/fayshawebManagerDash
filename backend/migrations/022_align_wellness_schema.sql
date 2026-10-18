-- Migration 022: align the wellness tables with the unified wellness system.
--
-- 006 and 017 both create wellness_activities and wellness_bookings with CREATE TABLE IF NOT EXISTS. On a database
-- where 006 ran first, 017's columns were never added, so the guest app's wellness screens
-- (/api/wellness-unified) and FAY OS → Wellness fail with errors such as "column a.icon does not exist".
--
-- Everything here is additive and safe to re-run. On a database that already has 017's tables it changes nothing.

-- 1. wellness_activities -----------------------------------------------------------------------------------
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS type VARCHAR(20);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS requires_booking BOOLEAN DEFAULT true;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS requires_staff BOOLEAN DEFAULT false;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS requires_access_pin BOOLEAN DEFAULT false;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 1;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS has_stages BOOLEAN DEFAULT false;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS total_stages INTEGER;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS benefits TEXT[];
ALTER TABLE wellness_activities ADD COLUMN IF NOT EXISTS tags TEXT[];

DO $$
BEGIN
  -- 006 kept the mood in mood_category (required); the unified system uses category.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wellness_activities' AND column_name = 'mood_category') THEN
    ALTER TABLE wellness_activities ALTER COLUMN mood_category DROP NOT NULL;
    UPDATE wellness_activities SET category = mood_category WHERE category IS NULL;
  END IF;

  -- 006 stored the duration as text ("60 min", "2 hours"); the unified system counts minutes.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wellness_activities' AND column_name = 'duration'
             AND data_type IN ('character varying', 'text')) THEN
    ALTER TABLE wellness_activities ALTER COLUMN duration TYPE INTEGER USING (
      CASE
        WHEN substring(duration FROM '\d+') IS NULL THEN 60
        WHEN duration ~* 'h(ou)?r' THEN substring(duration FROM '\d+')::int * 60
        ELSE substring(duration FROM '\d+')::int
      END
    );
  END IF;
END $$;

UPDATE wellness_activities SET type = CASE WHEN COALESCE(has_stages, false) THEN 'journey' ELSE 'service' END WHERE type IS NULL;
UPDATE wellness_activities SET category = 'other' WHERE category IS NULL;
UPDATE wellness_activities SET display_name = name WHERE display_name IS NULL;
UPDATE wellness_activities SET duration = 60 WHERE duration IS NULL;

CREATE INDEX IF NOT EXISTS idx_wellness_activities_type ON wellness_activities(type);
CREATE INDEX IF NOT EXISTS idx_wellness_activities_category ON wellness_activities(category);

-- 2. wellness_bookings -------------------------------------------------------------------------------------
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS apartment_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS activity_type VARCHAR(20) DEFAULT 'service';
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS total_duration INTEGER;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS activity_pin VARCHAR(4);
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS keys_generated_at TIMESTAMP;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS special_requests TEXT;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;

DO $$
DECLARE c RECORD;
BEGIN
  -- 006's booking_time becomes start_time.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wellness_bookings' AND column_name = 'booking_time') THEN
    UPDATE wellness_bookings SET start_time = booking_time WHERE start_time IS NULL;
  END IF;

  -- 006 allowed upcoming / completed / cancelled; the unified system also uses in_progress and no_show.
  FOR c IN
    SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'wellness_bookings' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%status%'
       AND pg_get_constraintdef(con.oid) NOT ILIKE '%no_show%'
  LOOP
    EXECUTE format('ALTER TABLE wellness_bookings DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'wellness_bookings' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%no_show%'
  ) THEN
    ALTER TABLE wellness_bookings ADD CONSTRAINT wellness_bookings_status_check
      CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

UPDATE wellness_bookings SET activity_type = 'service' WHERE activity_type IS NULL;
UPDATE wellness_bookings SET end_time = start_time + make_interval(mins => COALESCE(total_duration, 60))
 WHERE end_time IS NULL AND start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wellness_bookings_apartment ON wellness_bookings(apartment_booking_id);
CREATE INDEX IF NOT EXISTS idx_wellness_bookings_user_date_time ON wellness_bookings(user_id, booking_date, start_time, end_time);

-- 3. Activities ----------------------------------------------------------------------------------------------
-- 017's seed failed on databases with 006's tables, leaving the wellness screens empty. Same seed, only where missing.
DO $seed$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wellness_journeys')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wellness_journey_stages') THEN
    EXECUTE $journeys$
-- Insert Multi-Stage Journeys (from old wellness_journeys)
INSERT INTO wellness_activities
  (type, category, name, display_name, description, duration, requires_booking, requires_access_pin, has_stages, total_stages, display_order, is_active, icon)
SELECT
  'journey' as type,
  category,
  name,
  name as display_name,
  description,
  total_duration as duration,
  true as requires_booking,
  true as requires_access_pin,
  true as has_stages,
  (SELECT COUNT(*) FROM wellness_journey_stages wjs WHERE wjs.journey_id = wj.id) as total_stages,
  display_order,
  is_active,
  icon
FROM wellness_journeys wj
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_activities wa
  WHERE wa.name = wj.name AND wa.type = 'journey'
);

    $journeys$;
    EXECUTE $stages$
INSERT INTO wellness_activity_stages
  (activity_id, stage_number, name, description, duration, icon, activity_type, location, is_required, display_order)
SELECT
  wa.id as activity_id,
  wjs.stage_number,
  wjs.name,
  wjs.description,
  wjs.duration,
  wjs.icon,
  wjs.activity_type,
  wjs.location,
  wjs.is_required,
  wjs.stage_number as display_order
FROM wellness_journey_stages wjs
JOIN wellness_journeys wj ON wjs.journey_id = wj.id
JOIN wellness_activities wa ON wa.name = wj.name AND wa.type = 'journey'
WHERE NOT EXISTS (
  SELECT 1 FROM wellness_activity_stages was
  WHERE was.activity_id = wa.id AND was.stage_number = wjs.stage_number
)
    $stages$;
  END IF;
END $seed$;

-- Insert Common Wellness Services
INSERT INTO wellness_activities
  (type, category, name, display_name, description, duration, requires_booking, requires_staff, requires_access_pin, has_stages, max_capacity, display_order, is_active, icon)
SELECT * FROM (VALUES
  -- Fitness Services
  ('service', 'fitness', 'Gym Access', 'Gym Access', 'Access to fully equipped fitness center with cardio and strength training equipment', 60, true, false, false, false, 20, 100, true, '💪'),
  ('service', 'fitness', 'Personal Training', 'Personal Training Session', 'One-on-one training session with certified fitness instructor', 60, true, true, false, false, 1, 101, true, '🏋️'),
  ('service', 'fitness', 'Group Yoga', 'Group Yoga Class', 'Guided yoga session suitable for all levels', 45, true, true, false, false, 10, 102, true, '🧘'),
  ('service', 'fitness', 'Pilates', 'Pilates Class', 'Core strengthening and flexibility training', 45, true, true, false, false, 8, 103, true, '🤸'),

  -- Spa Services
  ('service', 'spa', 'Massage', 'Therapeutic Massage', 'Professional massage therapy for relaxation and muscle relief', 60, true, true, false, false, 1, 200, true, '💆'),
  ('service', 'spa', 'Facial', 'Facial Treatment', 'Rejuvenating facial treatment with premium products', 60, true, true, false, false, 1, 201, true, '✨'),
  ('service', 'spa', 'Sauna', 'Sauna Session', 'Traditional sauna experience for detoxification', 30, true, false, false, false, 6, 202, true, '♨️'),
  ('service', 'spa', 'Steam Room', 'Steam Room Session', 'Eucalyptus-infused steam room experience', 20, true, false, false, false, 8, 203, true, '💨'),

  -- Dining Services
  ('service', 'dining', 'Restaurant', 'Restaurant Reservation', 'Fine dining experience at our signature restaurant', 120, true, false, false, false, 40, 300, true, '🍽️'),
  ('service', 'dining', 'Private Chef', 'Private Chef Experience', 'Personal chef prepares meal in your apartment', 180, true, true, false, false, 1, 301, true, '👨‍🍳')
) AS v(type, category, name, display_name, description, duration, requires_booking, requires_staff, requires_access_pin, has_stages, max_capacity, display_order, is_active, icon)
WHERE NOT EXISTS (SELECT 1 FROM wellness_activities WHERE type = 'service');
