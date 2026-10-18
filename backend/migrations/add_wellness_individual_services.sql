-- Add individual wellness services for booking
-- These are the individual activities that users can book separately

-- RECHARGE CATEGORY SERVICES
INSERT INTO wellness_activities (name, type, category, duration, description, is_active)
VALUES
  ('Personal Training', 'service', 'recharge', 60, 'One-on-one coaching built around your goals', true),
  ('Gym & Training', 'service', 'recharge', 60, 'Access to world-class gym equipment', true),
  ('Group Fitness Class', 'service', 'recharge', 45, 'High-energy group workout sessions', true)
ON CONFLICT (name, category) DO NOTHING;

-- RESTORE CATEGORY SERVICES
INSERT INTO wellness_activities (name, type, category, duration, description, is_active)
VALUES
  ('Massage Therapy', 'service', 'restore', 60, 'Restorative bodywork tailored to release tension', true),
  ('Steam Room', 'service', 'restore', 30, 'Cleansing steam therapy', true),
  ('Sauna Session', 'service', 'restore', 30, 'Traditional dry sauna relaxation', true)
ON CONFLICT (name, category) DO NOTHING;

-- REFLECT CATEGORY SERVICES
INSERT INTO wellness_activities (name, type, category, duration, description, is_active)
VALUES
  ('Meditation Session', 'service', 'reflect', 30, 'Guided mindfulness practice', true),
  ('Yoga Class', 'service', 'reflect', 60, 'Flow and balance practice', true),
  ('Sunset Ceremony', 'service', 'reflect', 45, 'Evening reflection and gratitude practice', true)
ON CONFLICT (name, category) DO NOTHING;

-- EXPLORE CATEGORY SERVICES
INSERT INTO wellness_activities (name, type, category, duration, description, is_active)
VALUES
  ('Nature Walk', 'service', 'explore', 60, 'Guided exploration of natural surroundings', true),
  ('Cultural Experience', 'service', 'explore', 90, 'Immersive local culture and traditions', true)
ON CONFLICT (name, category) DO NOTHING;

-- Verify the insertions
SELECT name, type, category, duration FROM wellness_activities WHERE type = 'service' ORDER BY category, name;
