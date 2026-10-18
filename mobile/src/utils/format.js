/** Money and dates the way the property shows them (XAF, day month year). */
export const xaf = (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US').replace(/,/g, ' ')} XAF`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-18" → Date at local midnight (no timezone shift). */
export const parseDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Date → "2026-10-18" in local time. */
export const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** "18 Oct 2026" (or "Sat 18 Oct" with { weekday: true, year: false }). */
export const dayLabel = (value, { weekday = false, year = true } = {}) => {
  const d = value instanceof Date ? value : parseDay(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${weekday ? `${DAYS[d.getDay()]} ` : ''}${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
};

export const stayRange = (checkIn, checkOut) => `${dayLabel(checkIn, { year: false })} – ${dayLabel(checkOut)}`;

/** "Just now", "12 min ago", "3 h ago", or the date. */
export const ago = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)} min ago`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)} h ago`;
  return dayLabel(new Date(iso));
};

export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const nightsBetween = (a, b) => Math.max(0, Math.round((parseDay(isoDay(b)) - parseDay(isoDay(a))) / 86400000));

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
};
