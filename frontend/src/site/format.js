/** Formatting helpers for the public site. Prices are XAF (no decimals). */
export const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' in local time. */
export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

export const today = () => isoDate(new Date());

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [a, b] = [checkIn, checkOut].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** 'YYYY-MM-DD' → 'Fri, 24 Oct' (or with year). */
export function prettyDate(iso, { year = false, lang = 'en' } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  });
}

/** Default stay: three nights starting in a week. */
export function defaultStay() {
  const checkIn = addDays(today(), 7);
  return { checkIn, checkOut: addDays(checkIn, 3), guests: 2 };
}

/** Reads ?checkIn=&checkOut=&guests= with sane fallbacks. */
export function stayFromParams(params) {
  const d = defaultStay();
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  let checkIn = valid(params.get('checkIn')) ? params.get('checkIn') : d.checkIn;
  if (checkIn < today()) checkIn = today();
  let checkOut = valid(params.get('checkOut')) ? params.get('checkOut') : addDays(checkIn, 3);
  if (checkOut <= checkIn) checkOut = addDays(checkIn, 1);
  const guests = Math.min(12, Math.max(1, parseInt(params.get('guests'), 10) || d.guests));
  return { checkIn, checkOut, guests };
}

export const stayQuery = ({ checkIn, checkOut, guests }) =>
  new URLSearchParams({ checkIn, checkOut, guests: String(guests) }).toString();
