-- Standard check-in / check-out times as HH:MM (FAY OS → Settings), replacing the free-text display values.
-- The website and emails already said 14:00 / 11:00; the dashboard said 3:00 PM. 14:00 is kept unless already set.
UPDATE app_settings
   SET value = value
     || jsonb_build_object('standardCheckIn', COALESCE(value->>'standardCheckIn', '14:00'))
     || jsonb_build_object('standardCheckOut', COALESCE(value->>'standardCheckOut', '11:00'))
     || jsonb_build_object('lateCheckoutGraceMinutes', COALESCE((value->>'lateCheckoutGraceMinutes')::int, 30))
     || jsonb_build_object('noShowAfterHours', COALESCE((value->>'noShowAfterHours')::int, 6))
     || jsonb_build_object('checkInTime', '2:00 PM', 'checkOutTime', '11:00 AM')
 WHERE key = 'property' AND value->>'standardCheckIn' IS NULL;
