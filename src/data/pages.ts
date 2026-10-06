export type PageId =
  | 'guest360' | 'journey' | 'comms' | 'requests' | 'reservations' | 'residences' | 'housekeeping'
  | 'maintenance' | 'wellness' | 'dining' | 'transport' | 'experiences' | 'analytics' | 'ai' | 'settings';

export type PageMeta = { label: string; icon: string; title: string; sub: string; tag: string };

export const PAGES: Record<PageId, PageMeta> = {
  guest360: { label: 'Guest 360', icon: 'person', title: 'Guest 360', sub: 'Complete guest profile. Every stay. Every preference. Every touchpoint.', tag: 'Know every guest. Anticipate every need.' },
  journey: { label: 'Guest Journey', icon: 'route', title: 'Guest Journey', sub: 'From booking to beyond — a seamless, personalized experience.', tag: 'Every stay, a personalized journey.' },
  comms: { label: 'Communications', icon: 'mail', title: 'Communications Center', sub: 'Unified guest communication across all channels.', tag: 'Connected stays. Exceptional experiences.' },
  requests: { label: 'Service Requests', icon: 'room_service', title: 'Service Requests & Operations', sub: 'Track and manage all guest requests across departments.', tag: 'Every request. Every service. On time.' },
  reservations: { label: 'Reservations', icon: 'calendar_month', title: 'Reservations Management', sub: 'Manage bookings, availability, rates and guest stays — all in one place.', tag: 'Seamless bookings. Exceptional stays.' },
  residences: { label: 'Residences', icon: 'villa', title: 'Residences & Smart Home', sub: 'Every residence, every room, every device — live.', tag: 'Intelligent homes. Effortless comfort.' },
  housekeeping: { label: 'Housekeeping', icon: 'cleaning_services', title: 'Housekeeping', sub: 'Room status, cleaning schedules, linen and amenities.', tag: 'Immaculate. Every room. Every day.' },
  maintenance: { label: 'Maintenance', icon: 'build', title: 'Maintenance', sub: 'Work orders, preventive care and system health.', tag: 'Flawless spaces. Quietly maintained.' },
  wellness: { label: 'Wellness & Spa', icon: 'self_improvement', title: 'Wellness & Spa', sub: 'Bookings, facilities, treatments and personalized wellness experiences.', tag: 'Wellness for a better you. Mind. Body. Balance.' },
  dining: { label: 'Dining', icon: 'restaurant', title: 'Dining Management', sub: 'Reservations, orders, menus and personalized dining experiences.', tag: 'Exceptional dining. Memorable moments.' },
  transport: { label: 'Transportation', icon: 'directions_car', title: 'Transportation', sub: 'Transfers, fleet, chauffeurs and guest movement.', tag: 'Arrive in comfort. Depart in style.' },
  experiences: { label: 'Experiences', icon: 'sailing', title: 'Experiences', sub: 'Curated activities, excursions and signature moments.', tag: 'Moments worth remembering.' },
  analytics: { label: 'Analytics', icon: 'monitoring', title: 'Analytics', sub: 'Performance across revenue, occupancy, service and satisfaction.', tag: 'Insight behind every decision.' },
  ai: { label: 'AI Command', icon: 'neurology', title: 'FAY AI Command Center', sub: 'Your intelligent partner for exceptional hospitality.', tag: 'Smarter operations. Happier guests.' },
  settings: { label: 'Settings', icon: 'settings', title: 'Settings', sub: 'Property, team, integrations and preferences.', tag: 'Configured for excellence.' },
};

/** Sidebar order. */
export const SIDE: PageId[] = ['guest360', 'journey', 'comms', 'requests', 'reservations', 'residences', 'housekeeping', 'maintenance', 'wellness', 'dining', 'transport', 'experiences', 'analytics', 'ai', 'settings'];

/** Top nav: label, landing page, pages that highlight the item. */
export const TOP: [string, PageId, PageId[]][] = [
  ['Guests', 'guest360', ['guest360', 'journey', 'comms']],
  ['Reservations', 'reservations', ['reservations']],
  ['Residences', 'residences', ['residences', 'housekeeping', 'maintenance']],
  ['Operations', 'requests', ['requests', 'transport']],
  ['Wellness', 'wellness', ['wellness']],
  ['Dining', 'dining', ['dining']],
  ['Experiences', 'experiences', ['experiences']],
  ['Analytics', 'analytics', ['analytics']],
  ['AI Command', 'ai', ['ai']],
];

export const isPageId = (s: string | undefined): s is PageId => !!s && s in PAGES;
