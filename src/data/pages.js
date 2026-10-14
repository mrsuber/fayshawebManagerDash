/**
 * Page registry. Labels, titles, subtitles and taglines live in the i18n catalogues
 * under `pages.<id>.{label,title,sub,tag}` (src/i18n/locales).
 */
export const PAGES = {
  guest360: { icon: 'person' },
  journey: { icon: 'route' },
  comms: { icon: 'mail' },
  requests: { icon: 'room_service' },
  reservations: { icon: 'calendar_month' },
  residences: { icon: 'villa' },
  housekeeping: { icon: 'cleaning_services' },
  maintenance: { icon: 'build' },
  wellness: { icon: 'self_improvement' },
  dining: { icon: 'restaurant' },
  transport: { icon: 'directions_car' },
  experiences: { icon: 'sailing' },
  analytics: { icon: 'monitoring' },
  ai: { icon: 'neurology' },
  settings: { icon: 'settings' },
};

/** Sidebar order. */
export const SIDE = Object.keys(PAGES);

/** Top nav: i18n key under `nav.`, landing page, pages that highlight the item. */
export const TOP = [
  ['guests', 'guest360', ['guest360', 'journey', 'comms']],
  ['reservations', 'reservations', ['reservations']],
  ['residences', 'residences', ['residences', 'housekeeping', 'maintenance']],
  ['operations', 'requests', ['requests', 'transport']],
  ['wellness', 'wellness', ['wellness']],
  ['dining', 'dining', ['dining']],
  ['experiences', 'experiences', ['experiences']],
  ['analytics', 'analytics', ['analytics']],
  ['ai', 'ai', ['ai']],
];

export const isPageId = (s) => !!s && s in PAGES;
