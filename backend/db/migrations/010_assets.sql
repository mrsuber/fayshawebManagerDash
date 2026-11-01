-- Asset lifecycle: a register of what the property owns, preventive schedules, a monthly replacement reserve per
-- asset, and spare parts / standby units for critical equipment.
--
--   order_by date   = purchase date + expected life − supplier lead time − 30 days   (order before it fails)
--   monthly reserve = (replacement cost − reserve already set aside) ÷ months of life left
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,                 -- AC-E401-01, GEN-01, POOL-PUMP-1
  name VARCHAR(160) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'equipment',-- hvac, electrical, plumbing, kitchen, laundry, pool, gym, spa, furniture, electronics, vehicle, building, outdoor, security, other
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  location VARCHAR(150),
  criticality VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (criticality IN ('critical', 'high', 'normal', 'low')),
  status VARCHAR(16) NOT NULL DEFAULT 'in_service' CHECK (status IN ('in_service', 'needs_attention', 'out_of_service', 'retired')),
  brand VARCHAR(100),
  model VARCHAR(100),
  serial VARCHAR(100),
  supplier VARCHAR(150),
  supplier_contact VARCHAR(150),
  purchase_date DATE,
  purchase_cost NUMERIC(14, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
  warranty_until DATE,
  expected_life_months INTEGER CHECK (expected_life_months > 0),
  replacement_cost NUMERIC(14, 2),                  -- today's estimate to replace it (incl. shipping and fitting)
  lead_time_days INTEGER NOT NULL DEFAULT 0,        -- order to installed
  reserve_override NUMERIC(14, 2),                  -- monthly amount set by hand instead of the computed one
  spares_min INTEGER NOT NULL DEFAULT 0,            -- standby units / spare parts to keep (2 for equipment that takes long to ship)
  spares_on_hand INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category, status);

-- Recurring care: for an asset, or for an area (repainting, deep cleaning the estate…).
CREATE TABLE IF NOT EXISTS asset_tasks (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  area VARCHAR(150),                                -- when not tied to one asset: "Lobby", "All residences", "Facade"
  title VARCHAR(200) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'service',      -- service, inspection, deep_clean, repaint, calibration, replace, other
  every_n INTEGER NOT NULL DEFAULT 3 CHECK (every_n > 0),
  every_unit VARCHAR(6) NOT NULL DEFAULT 'month' CHECK (every_unit IN ('day', 'week', 'month', 'year')),
  last_done DATE,
  next_due DATE NOT NULL,
  team VARCHAR(80),
  vendor VARCHAR(150),
  est_cost NUMERIC(14, 2),
  instructions TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_tasks_due ON asset_tasks(next_due) WHERE active;

-- Everything that happened to an asset: services, repairs, inspections, replacement, status changes.
CREATE TABLE IF NOT EXISTS asset_logs (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES asset_tasks(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL,                        -- service, repair, inspection, replacement, status, note
  done_on DATE NOT NULL DEFAULT CURRENT_DATE,
  cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  by_name VARCHAR(150),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_logs_asset ON asset_logs(asset_id, done_on DESC);

-- The replacement reserve: one contribution per asset per month (posted by the monitor), and spending from it.
CREATE TABLE IF NOT EXISTS asset_reserve (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  month DATE NOT NULL,                              -- first day of the month
  kind VARCHAR(12) NOT NULL DEFAULT 'contribution' CHECK (kind IN ('contribution', 'spend', 'adjustment')),
  amount NUMERIC(14, 2) NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_reserve_monthly ON asset_reserve(asset_id, month) WHERE kind = 'contribution';
