-- Keys in the guest's Digital key are for experiences whose rooms open with a PIN (a journey like Restore).
-- Other experiences (gym, yoga, Recharge / Reflect / Explore) are bookings with a code, without a key.
-- The rule is the catalogue's Access setting (FAY OS → Wellness → Catalogue): "pin" gives a key.
UPDATE wellness_activities SET access_mode = 'pin', requires_access_pin = true
 WHERE type = 'journey' AND category = 'restore' AND access_mode = 'none';
UPDATE wellness_activities SET requires_access_pin = false
 WHERE access_mode <> 'pin' AND requires_access_pin = true;

-- Every booking has a code, whatever creates it (older screens, imports): the database fills it in.
ALTER TABLE wellness_bookings ALTER COLUMN booking_code SET DEFAULT ('W' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)));
UPDATE wellness_bookings SET booking_code = 'W' || upper(substr(md5(id::text || random()::text), 1, 6)) WHERE booking_code IS NULL;
