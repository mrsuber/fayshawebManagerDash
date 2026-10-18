-- =====================================================
-- 021 — Faysha HQ (super administrator dashboard)
-- Properties, audit trail, approvals, and HQ access areas on roles.
-- Idempotent and additive: safe to run more than once.
-- Run: node migrations/run.js 021_create_hq.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. Properties (one today; the platform is ready for more)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Cameroon',
  address TEXT,
  timezone VARCHAR(60) DEFAULT 'Africa/Douala',
  currency VARCHAR(3) DEFAULT 'XAF',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'opening', 'inactive')),
  opened_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO properties (code, name, country, status)
VALUES ('FWR', 'Faysha Wellness Residence', 'Cameroon', 'active')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id);
UPDATE apartments SET property_id = (SELECT id FROM properties WHERE code = 'FWR') WHERE property_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_apartments_property ON apartments(property_id);
-- New residences belong to the first property unless another is chosen.
DO $$
BEGIN
  EXECUTE format('ALTER TABLE apartments ALTER COLUMN property_id SET DEFAULT %s', (SELECT id FROM properties WHERE code = 'FWR'));
END $$;

-- A staff member's home property (NULL = every property).
ALTER TABLE users ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id);

-- -----------------------------------------------------
-- 2. Audit trail: every change made by a signed-in user (written by middleware/hq.js)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  actor_role VARCHAR(50),
  impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  area VARCHAR(50),
  entity VARCHAR(80),
  entity_id VARCHAR(80),
  action VARCHAR(80),
  summary TEXT,
  status_code INTEGER,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_area ON audit_log(area);

-- -----------------------------------------------------
-- 3. Approvals: refunds, discounts, expenses and purchases waiting on a decision.
--    (Leave requests stay in leave_requests; HQ shows them in the same queue.)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('refund', 'discount', 'expense', 'purchase', 'other')),
  title VARCHAR(200) NOT NULL,
  detail TEXT,
  amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'XAF',
  reference_type VARCHAR(30),
  reference_id INTEGER,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMP,
  decision_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);

-- -----------------------------------------------------
-- 4. Roles: HQ areas in the permissions JSON, and the HR manager role
--    Areas: overview, finance, approvals, staff, roles, audit, properties, hr, website
--    Actions: view, manage, approve
-- -----------------------------------------------------
INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
(
  'hr_manager',
  'HR Manager',
  'People team: employees, recruitment, attendance and leave. Sees only the HR section of HQ.',
  '{"hr": {"view": true, "manage": true, "approve": true}}',
  true
),
(
  'guest',
  'Guest',
  'Guest user with booking and wellness app access',
  '{"bookings": {"view": true, "edit": true}, "wellness": {"view": true, "book": true}}',
  true
)
ON CONFLICT (name) DO NOTHING;

-- Content roles keep their access to the website area of HQ.
UPDATE roles SET permissions = permissions || '{"website": {"view": true, "manage": true}}'::jsonb
 WHERE name IN ('content_manager', 'editor') AND NOT (permissions ? 'website');

COMMIT;
