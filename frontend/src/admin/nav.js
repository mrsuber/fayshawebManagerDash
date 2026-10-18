/**
 * HQ menu. `area` is the HQ area that opens the page (backend/middleware/hq.js); `legacy: true` pages are the
 * v1 administrator screens, open to super administrators only.
 */
export const NAV = [
  { group: 'Command', items: [{ to: '', label: 'Overview', icon: 'space_dashboard', area: 'overview', title: 'Overview', sub: 'The whole of Faysha at a glance' }] },
  {
    group: 'Money',
    items: [
      { to: 'finance', label: 'Finance', icon: 'monitoring', area: 'finance', title: 'Finance', sub: 'Revenue earned, money collected, payments to confirm' },
      { to: 'approvals', label: 'Approvals', icon: 'approval', area: 'approvals', badge: 'approvals', title: 'Approvals', sub: 'Refunds, discounts, spending and leave waiting on a decision' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: 'staff', label: 'Staff & departments', icon: 'badge', area: 'staff', title: 'Staff & departments', sub: 'Every team member, their role and their department' },
      { to: 'roles', label: 'Roles & permissions', icon: 'admin_panel_settings', area: 'roles', title: 'Roles & permissions', sub: 'Decide who can see and do what' },
      { to: 'hr', label: 'HR', icon: 'groups', area: 'hr', title: 'Human resources', sub: 'Employees, recruitment, attendance and leave' },
      { to: 'guests', label: 'Guest accounts', icon: 'person_search', legacy: true, title: 'Guest accounts', sub: 'Guest profiles and every account on the platform' },
    ],
  },
  {
    group: 'Property',
    items: [
      { to: 'properties', label: 'Properties', icon: 'domain', area: 'properties', title: 'Properties', sub: 'Faysha residences, today and tomorrow' },
      { to: 'residences', label: 'Residences', icon: 'villa', legacy: true, title: 'Residences', sub: 'Categories, units, photos, availability and deposit boxes' },
      { to: 'bookings', label: 'Bookings', icon: 'event_available', legacy: true, title: 'Bookings', sub: 'Every reservation, its keys and its payments' },
    ],
  },
  {
    group: 'Experience',
    items: [
      { to: 'wellness', label: 'Wellness catalogue', icon: 'spa', legacy: true, title: 'Wellness catalogue', sub: 'Activities, zones, availability and journeys' },
      { to: 'feedback', label: 'Feedback', icon: 'reviews', legacy: true, title: 'Feedback', sub: 'What guests say, and what the website shows' },
      { to: 'website', label: 'Website content', icon: 'web', area: 'website', title: 'Website content', sub: 'Edit the public site, page by page, in English and French' },
    ],
  },
  {
    group: 'Governance',
    items: [
      { to: 'audit', label: 'Audit log', icon: 'history', area: 'audit', title: 'Audit log', sub: 'Who changed what, and when' },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);

export function visibleNav(me) {
  if (!me) return [];
  const can = (item) => (item.legacy ? me.legacy : me.areas.includes(item.area));
  return NAV.map((g) => ({ ...g, items: g.items.filter(can) })).filter((g) => g.items.length);
}

export function itemFor(pathname) {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  return ALL_ITEMS.find((i) => i.to === seg) || null;
}
