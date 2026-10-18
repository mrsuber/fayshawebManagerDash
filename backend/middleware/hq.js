/**
 * Faysha HQ access and audit.
 *
 * Access is by area: a role's permissions JSON grants { view, manage, approve } per HQ area, e.g.
 * { "finance": { "view": true }, "approvals": { "view": true, "approve": true } }. Super administrators
 * have every area. Roles are edited in HQ → Roles & permissions, so a new role (say "Finance Director")
 * works in HQ without code changes.
 */
const db = require('../config/database');
const { authenticateToken, checkPasswordChangeRequired } = require('./auth');

const HQ_AREAS = ['overview', 'finance', 'approvals', 'staff', 'roles', 'audit', 'properties', 'hr', 'website'];
const HQ_ACTIONS = ['view', 'manage', 'approve'];

/** Older role JSON used other keys for the same things. */
const LEGACY = {
  website: ['pages', 'content'],
  staff: ['users'],
};

function hasArea(user, area, action = 'view') {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const p = user.permissions || {};
  if (p[area]?.[action] === true) return true;
  // A role that can manage or approve can also see.
  if (action === 'view' && (p[area]?.manage === true || p[area]?.approve === true)) return true;
  const legacyAction = action === 'manage' ? 'edit' : action;
  return (LEGACY[area] || []).some((key) => p[key]?.[legacyAction] === true);
}

/** Areas a user can open, for the HQ menu. */
const areasOf = (user) => HQ_AREAS.filter((a) => hasArea(user, a));

/** Express middleware: signed in, password changed, and allowed in `area` for `action`. */
function requireArea(area, action = 'view') {
  return [
    authenticateToken,
    checkPasswordChangeRequired,
    (req, res, next) => {
      if (hasArea(req.user, area, action)) return next();
      return res.status(403).json({ message: `You don't have ${action} access to ${area}` });
    },
  ];
}

/** Like requireArea, but the action follows the HTTP method: reads need view, writes need manage. */
function requireAreaByMethod(area) {
  return [
    authenticateToken,
    checkPasswordChangeRequired,
    (req, res, next) => {
      const action = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'view' : 'manage';
      if (hasArea(req.user, area, action) || ['superadmin', 'manager'].includes(req.user.role)) return next();
      return res.status(403).json({ success: false, message: `You don't have ${action} access to ${area}` });
    },
  ];
}

// ---------------- Audit trail ----------------

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Noise that is not a decision: notification reads, device tokens, password checks, AI questions.
const SKIP = [/\/notifications(\/|$)/, /\/device-token$/, /\/auth\/(login|logout|verify-email|forgot-password|reset-password)$/, /\/ai\/ask$/, /\/check-availability$/];

const VERBS = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' };

/** /api/manager/reservations/12/check-in → { area: 'manager', entity: 'reservations', entityId: '12', action: 'check-in' } */
function describe(method, path) {
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const area = parts[0] || '';
  const rest = ['manager', 'admin'].includes(area) ? parts.slice(1) : parts;
  let entity = '';
  let entityId = null;
  let action = '';
  for (const seg of rest) {
    if (/^\d+$/.test(seg) || /^[a-z]+-\d+$/.test(seg)) entityId = seg;
    else if (!entity) entity = seg;
    else if (entityId) action = seg;
    else entity = `${entity}/${seg}`;
  }
  const label = entity.replace(/[-_/]/g, ' ').trim() || area;
  const verb = action ? action.replace(/-/g, ' ') : VERBS[method].toLowerCase();
  const summary = `${action ? verb.charAt(0).toUpperCase() + verb.slice(1) : VERBS[method]} ${label}${entityId ? ` #${entityId}` : ''}`;
  return { area, entity: entity || null, entityId, action: action || method.toLowerCase(), summary };
}

/**
 * Records every successful change made by a signed-in user. Runs after the response, so it never
 * slows down or breaks a request; failures are logged and ignored.
 */
function auditTrail(req, res, next) {
  if (!MUTATING.has(req.method)) return next();
  const path = req.originalUrl.split('?')[0];
  if (SKIP.some((re) => re.test(path))) return next();
  res.on('finish', () => {
    const user = req.user;
    if (!user || res.statusCode >= 400) return;
    const d = describe(req.method, path);
    db.query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, impersonated_by, method, path, area, entity, entity_id, action, summary, status_code, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        user.id, user.fullName || user.email, user.role, user.impersonatedBy || null, req.method, path.slice(0, 500), d.area, d.entity,
        d.entityId, d.action, d.summary, res.statusCode, (req.ip || '').slice(0, 64), (req.get('user-agent') || '').slice(0, 300),
      ],
    ).catch((e) => console.error('Audit log write failed:', e.message));
  });
  return next();
}

module.exports = { HQ_AREAS, HQ_ACTIONS, hasArea, areasOf, requireArea, requireAreaByMethod, auditTrail, describe };
