-- Work is given to a named person: service requests (assigned_to already exists), wellness sessions, work orders.
-- The person sees it in "My work" (/work), is notified, and the guest's rating is credited to them.
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_service_requests_assignee ON service_requests(assigned_to, status);

ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wellness_bookings ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_wellness_bookings_staff ON wellness_bookings(staff_id, booking_date);

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cost NUMERIC(12, 2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_work_orders_assignee ON work_orders(assigned_to, status);
