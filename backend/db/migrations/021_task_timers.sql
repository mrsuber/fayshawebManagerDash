-- Task timers: each request and work order carries the time allowed for it. The clock starts when it is assigned
-- (assigned_at) and stops when it is done (completed_at); past the time allowed it keeps counting as late.
-- Tasks created before this migration have no time allowed, so they are not measured.
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS time_allowed_minutes INTEGER CHECK (time_allowed_minutes BETWEEN 5 AND 10080);
-- Where the request came from: the guest (the app), a manager (FAY OS), or the system (e.g. the clean after a departure).
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'guest' CHECK (source IN ('guest', 'manager', 'system'));
UPDATE service_requests SET source = 'manager' WHERE metadata ? 'createdBy' AND source = 'guest';
CREATE INDEX IF NOT EXISTS idx_service_requests_timing ON service_requests(assigned_to, completed_at) WHERE time_allowed_minutes IS NOT NULL;

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS time_allowed_minutes INTEGER CHECK (time_allowed_minutes BETWEEN 5 AND 10080);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
UPDATE work_orders SET assigned_at = COALESCE(updated_at::timestamptz, created_at) WHERE assigned_to IS NOT NULL AND assigned_at IS NULL;
