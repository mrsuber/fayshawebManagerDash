import moment from 'moment';
import api from './client';
import { withMock } from './mock';
import { getDb } from '../mocks/db';

/** Deterministic pseudo-random 0..1 from a string (so the mock is stable between reloads). */
const rand = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

const SERVICES = [
  ['FAY Thermal Recovery', 'bookings', 200],
  ['Riviera Tasting Menu', 'covers', 68],
  ['Sunset Yacht', 'charters', 1200],
  ['Signature Massage', 'bookings', 180],
  ['Private Chef', 'dinners', 680],
  ['Desert Dune Safari', 'trips', 420],
  ['Hammam Ritual', 'bookings', 160],
  ['Pool Club Lunch', 'covers', 42],
  ['Golf Experience', 'rounds', 350],
  ['Airport Chauffeur', 'transfers', 120],
];

function buildReport(from, to) {
  const start = moment(from);
  const end = moment(to);
  const days = Math.max(1, end.diff(start, 'days') + 1);
  // Bucket size: daily up to 2 weeks, weekly up to ~3 months, monthly beyond.
  const unit = days <= 14 ? 'day' : days <= 92 ? 'week' : 'month';
  const buckets = [];
  for (let m = start.clone().startOf(unit); m.isSameOrBefore(end); m.add(1, unit)) buckets.push(m.clone());
  const scale = unit === 'day' ? 1 : unit === 'week' ? 7 : 30;
  const series = buckets.map((m) => {
    const k = m.format('YYYY-MM-DD');
    const season = 0.75 + 0.25 * Math.sin((m.month() + 2) / 1.9);
    return {
      label: unit === 'day' ? m.format('ddd D') : unit === 'week' ? `W${m.format('w')}` : m.format('MMM'),
      stays: Math.round(scale * (11000 + 6000 * rand(`s${k}`)) * season),
      services: Math.round(scale * (3000 + 2000 * rand(`v${k}`)) * season),
    };
  });
  const stays = series.reduce((s, x) => s + x.stays, 0);
  const services = series.reduce((s, x) => s + x.services, 0);
  const total = stays + services;
  const occ = Math.round(62 + 18 * rand(`o${from}${to}`));
  const sat = (9.3 + 0.5 * rand(`q${from}${to}`)).toFixed(1);
  const d = getDb();
  const repeat = d.guests.length ? Math.round((d.guests.filter((g) => d.stays.filter((st) => st.guestId === g.id).length > 1).length / d.guests.length) * 100) : 24;
  const delta = (k) => `↑ ${Math.round(4 + 16 * rand(`${k}${from}`))}%`;
  const svcShare = services / total;
  return {
    from,
    to,
    unit,
    kpis: [
      { l: 'Total Revenue', n: total, format: 'money', d: delta('rev') },
      { l: 'Avg Occupancy', n: `${occ}%`, d: delta('occ') },
      { l: 'RevPAR', n: Math.round(total / days / 20), format: 'money', d: delta('revpar') },
      { l: 'Guest Satisfaction', n: `${sat} / 10`, d: '↑ 0.3' },
      { l: 'Repeat Guests', n: `${repeat}%`, d: delta('rep') },
    ],
    series,
    mix: [
      { l: 'Residences', v: Math.round((1 - svcShare) * 100), c: '#e8b84a' },
      { l: 'Wellness & Spa', v: Math.round(svcShare * 34), c: '#9b7bf0' },
      { l: 'Dining', v: Math.round(svcShare * 34), c: '#3fd283' },
      { l: 'Experiences', v: Math.round(svcShare * 21), c: '#4fc3f7' },
      { l: 'Other', v: Math.max(0, 100 - Math.round((1 - svcShare) * 100) - 2 * Math.round(svcShare * 34) - Math.round(svcShare * 21)), c: '#8f897d' },
    ],
    total,
    occupancy: ['Serenity Collection', 'Villa Spectra', 'Allure Penthouse', 'Riviera Collection'].map((n) => ({ l: n, v: Math.round(55 + 35 * rand(`${n}${from}${to}`)) })),
    satisfaction: [
      ['Residence', '#1f9d55'],
      ['Housekeeping', '#3fd283'],
      ['Dining', '#e8b84a'],
      ['Wellness', '#9b7bf0'],
      ['Experiences', '#4fc3f7'],
      ['Transportation', '#2f6fe8'],
    ].map(([l, c]) => ({ l, c, v: Math.round((9 + rand(`${l}${from}`)) * 10) / 10 })),
    topServices: SERVICES.map(([n, unitName, price]) => {
      const count = Math.max(1, Math.round((days / 2) * (0.3 + rand(`${n}${from}${to}`)) * (price > 500 ? 0.2 : 1)));
      return { n, count: `${count} ${unitName}`, revenue: count * price };
    }).sort((a, b) => b.revenue - a.revenue),
  };
}

/** GET /analytics?from=YYYY-MM-DD&to=YYYY-MM-DD → Report (kpis, series, mix, occupancy, satisfaction, topServices) */
export const report = (from, to) => withMock(() => api.get('/analytics', { params: { from, to } }), () => buildReport(from, to));
