/**
 * Who can open HQ (/admin). Mirrors backend/middleware/hq.js: super administrators always; other roles
 * when their permissions grant any HQ area (HQ → Roles & permissions). The exact menu comes from
 * GET /api/admin/me; this is only for routing before that call.
 */
export const HQ_AREAS = ['overview', 'finance', 'approvals', 'staff', 'roles', 'audit', 'properties', 'hr', 'website'];

export function canOpenHq(user) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const p = user.permissions || {};
  const granted = (k) => Boolean(p[k] && (p[k].view || p[k].manage || p[k].approve || p[k].edit));
  return HQ_AREAS.some(granted) || granted('pages') || granted('content');
}

/** Where a signed-in user starts: managers in FAY OS, HQ roles in HQ, everyone else nowhere (the apps). */
export function homeFor(user) {
  if (!user) return null;
  if (user.role === 'manager') return '/manager';
  if (canOpenHq(user)) return '/admin';
  return null;
}
