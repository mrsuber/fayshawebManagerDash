-- Fix service names to match UI display names exactly

-- Update "Personal Training" to "Personal Trainer"
UPDATE wellness_activities
SET name = 'Personal Trainer'
WHERE name = 'Personal Training' AND category = 'recharge' AND type = 'service';

-- Update "Meditation Session" to "Meditation"
UPDATE wellness_activities
SET name = 'Meditation'
WHERE name = 'Meditation Session' AND category = 'reflect' AND type = 'service';

-- Verify the updates
SELECT id, name, type, category, duration
FROM wellness_activities
WHERE type = 'service'
ORDER BY category, name;
