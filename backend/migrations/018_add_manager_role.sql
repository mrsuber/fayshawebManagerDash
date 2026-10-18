-- Migration: Add Manager Role
-- Description: Adds the Manager role for Fayshaa property managers
-- Created: 2026-10-05

-- ============================================
-- Insert Manager role
-- ============================================

INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
(
  'manager',
  'Manager',
  'Property Manager - Full access to reservations, bookings, and guest management',
  '{
    "reservations": {"view": true, "create": true, "edit": true, "delete": true, "manage": true},
    "bookings": {"view": true, "create": true, "edit": true, "delete": true, "manage": true},
    "guests": {"view": true, "create": true, "edit": true, "delete": false, "manage": true},
    "residences": {"view": true, "create": true, "edit": true, "delete": false},
    "calendar": {"view": true, "manage": true},
    "analytics": {"view": true},
    "concierge": {"view": true, "respond": true, "manage": true},
    "services": {"view": true, "manage": true},
    "wellness": {"view": true, "manage": true},
    "housekeeping": {"view": true, "assign": true, "manage": true},
    "maintenance": {"view": true, "assign": true, "manage": true},
    "dining": {"view": true, "manage": true},
    "transportation": {"view": true, "manage": true},
    "experiences": {"view": true, "manage": true}
  }',
  false
)
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON COLUMN roles.permissions IS 'JSON object containing permissions for property management operations';
