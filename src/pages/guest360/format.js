import moment from 'moment';

/** Status → [background, text] for pills across Guest 360. */
const STATUS = {
  Ready: ['#1f9d55', '#fff'],
  Completed: ['#1f9d55', '#fff'],
  Delivered: ['#3a3f48', '#e6e0d4'],
  'In Progress': ['#2f6fe8', '#fff'],
  Confirmed: ['#7c4ddb', '#fff'],
  Pending: ['#2f6fe8', '#fff'],
  Scheduled: ['#2f6fe8', '#fff'],
  New: ['#b8862e', '#fff'],
  Escalated: ['#c43a3a', '#fff'],
  'On Hold': ['#6b5a3a', '#fff'],
  Cancelled: ['#3a3f48', '#a9a294'],
  'In House': ['#1f9d55', '#fff'],
  Arriving: ['#2f6fe8', '#fff'],
  Upcoming: ['#7c4ddb', '#fff'],
  'Checked Out': ['#3a3f48', '#e6e0d4'],
  Current: ['#1f9d55', '#fff'],
  '—': ['transparent', '#8f897d'],
};
export const statusColors = (s) => STATUS[s] ?? STATUS['—'];
export const GUEST_STATUS_COLOR = { 'In House': '#3fd283', Arriving: '#5b8ff0', Upcoming: '#9b7bf0', 'Checked Out': '#8f897d' };

export const DEPARTMENTS = ['Housekeeping', 'Maintenance', 'Dining', 'Wellness', 'Transportation', 'Experiences', 'Concierge'];
export const DEPARTMENT_ICON = {
  Housekeeping: ['bed', '#4fc3f7'],
  Maintenance: ['build', '#9b7bf0'],
  Dining: ['room_service', '#e8b84a'],
  Wellness: ['spa', '#9b7bf0'],
  Transportation: ['directions_car', '#e6e0d4'],
  Experiences: ['sailing', '#4fc3f7'],
  Concierge: ['deployed_code', '#3fd283'],
};
export const BOOKING_TYPES = {
  wellness: { label: 'Wellness', icon: 'spa', color: '#9b7bf0', options: ['FAY Thermal Recovery', 'Deep Tissue Massage', 'Signature Facial', 'Hammam Ritual', 'FAY FLOAT Session', 'Yoga at Sunrise', 'Personal Training'] },
  dining: { label: 'Dining', icon: 'restaurant', color: '#e8b84a', options: ['Dinner at Riviera', 'Private Dining – Riviera', 'Pool Club Lunch', 'Chef’s Table', 'In-Residence Breakfast', 'Beach Dinner'] },
  experience: { label: 'Experience', icon: 'sailing', color: '#4fc3f7', options: ['Sunset Yacht Experience', 'Snorkeling Trip', 'Desert Safari', 'Private Island Picnic', 'Golf Tee Time', 'Heritage Tour'] },
  transport: { label: 'Transport', icon: 'directions_car', color: '#e6e0d4', options: ['Airport transfer – arrival', 'Airport transfer – departure', 'Chauffeur (half day)', 'Golf cart pickup'] },
};
export const CHANNELS = [
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['sms', 'SMS'],
  ['in_app', 'In-App'],
];

export const money = (n, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(n);
export const fmtDate = (d) => moment(d).format('MMM D, YYYY');
/** Time today, otherwise the date. */
export const when = (iso) => (moment(iso).isSame(moment(), 'day') ? moment(iso).format('HH:mm') : moment(iso).format('MMM D'));
const dayName = (m) => (m.isSame(moment(), 'day') ? 'Today' : m.isSame(moment().add(1, 'day'), 'day') ? 'Tomorrow' : m.isSame(moment().subtract(1, 'day'), 'day') ? 'Yesterday' : m.format('MMM D'));
/** "Tomorrow, 10:00 AM – 11:30 AM" */
export const slot = (startsAt, endsAt) => `${dayName(moment(startsAt))}, ${moment(startsAt).format('h:mm A')}${endsAt ? ` – ${moment(endsAt).format('h:mm A')}` : ''}`;
export const nights = (g) => moment(g.checkOut).diff(moment(g.checkIn), 'days');
/** Value for a datetime-local input, `days` from now at `hhmm`. */
export const localInput = (days = 1, hhmm = '10:00') => `${moment().add(days, 'days').format('YYYY-MM-DD')}T${hhmm}`;
/** ISO timestamp → datetime-local input value. */
export const toLocalInput = (iso) => moment(iso).format('YYYY-MM-DDTHH:mm');
