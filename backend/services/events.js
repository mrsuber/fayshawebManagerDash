/**
 * Event requests and quotes, shared by the public API (routes/events.js: website and app) and FAY OS
 * (routes/manager/events.js). See db/migrations/006_events.sql for the flow.
 */
const crypto = require('crypto');
const db = require('../config/database');
const emailService = require('./email.service');
const { layout, panel, row, button, esc, C, sans } = require('./emailLayout');
const { formatMoney, decimalsOf } = require('../utils/money');

const TYPES = ['wedding', 'engagement', 'birthday', 'anniversary', 'corporate', 'conference', 'retreat', 'private_dinner', 'other'];
const TYPE_LABEL = {
  wedding: 'Wedding', engagement: 'Engagement', birthday: 'Birthday', anniversary: 'Anniversary', corporate: 'Corporate event',
  conference: 'Conference', retreat: 'Retreat', private_dinner: 'Private dinner', other: 'Event',
};
const SPACES = ['garden', 'pool_deck', 'restaurant', 'sky_deck', 'lounge', 'wellness_club', 'whole_estate'];
const SERVICES = ['decor', 'flowers', 'sound', 'lighting', 'photo', 'video', 'cake', 'officiant', 'transport', 'security', 'wellness', 'kids', 'accommodation'];
const CATERING = ['faysha', 'external', 'none'];
const STYLES = ['plated', 'buffet', 'cocktail', 'family', 'bbq'];
const STATUSES = ['new', 'assessing', 'quoted', 'accepted', 'confirmed', 'completed', 'declined', 'cancelled', 'lost'];

const httpError = (status, message) => Object.assign(new Error(message), { status });
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const time = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : null);
const pick = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).filter((x) => allowed.includes(x)))];
const appUrl = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');

/** Validates and normalises an event request from the website, the app or staff. */
function cleanRequest(b) {
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  if (!name || !email) throw httpError(400, 'Please give your name and email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address');
  if (!TYPES.includes(b.eventType)) throw httpError(400, 'Choose the kind of event');
  const guests = parseInt(b.guests, 10);
  if (!(guests > 0) || guests > 5000) throw httpError(400, 'How many guests are you expecting?');
  const eventDate = day(b.eventDate);
  if (!eventDate && !b.flexibleDates) throw httpError(400, 'Choose a date, or tell us your dates are flexible');
  if (eventDate && eventDate < new Date().toISOString().slice(0, 10)) throw httpError(400, 'The event date is in the past');
  const money = (v) => (v === undefined || v === null || v === '' ? null : Math.max(0, Number(v) || 0));
  const budgetMin = money(b.budgetMin);
  const budgetMax = money(b.budgetMax);
  if (budgetMin && budgetMax && budgetMax < budgetMin) throw httpError(400, 'The budget range is reversed');
  return {
    name: name.slice(0, 255),
    email,
    phone: b.phone ? String(b.phone).trim().slice(0, 50) : null,
    organisation: b.organisation ? String(b.organisation).trim().slice(0, 255) : null,
    event_type: b.eventType,
    title: b.title ? String(b.title).trim().slice(0, 200) : null,
    event_date: eventDate,
    flexible_dates: Boolean(b.flexibleDates),
    alt_date: day(b.altDate),
    start_time: time(b.startTime),
    end_time: time(b.endTime),
    guests,
    spaces: JSON.stringify(pick(b.spaces, SPACES)),
    catering: CATERING.includes(b.catering) ? b.catering : 'faysha',
    catering_style: STYLES.includes(b.cateringStyle) ? b.cateringStyle : null,
    dietary: b.dietary ? String(b.dietary).slice(0, 2000) : null,
    services: JSON.stringify(pick(b.services, SERVICES)),
    rooms_needed: Math.max(0, Math.min(200, parseInt(b.roomsNeeded, 10) || 0)),
    budget_min: budgetMin,
    budget_max: budgetMax,
    currency: /^[A-Z]{3}$/.test(String(b.currency || '')) ? b.currency : 'XAF',
    message: b.message ? String(b.message).slice(0, 5000) : null,
    heard_from: b.heardFrom ? String(b.heardFrom).slice(0, 80) : null,
  };
}

/** Creates the request, sends the client an acknowledgement and alerts managers. Returns the row. */
async function createRequest(fields, { source, userId = null, app = null }) {
  const cols = Object.keys(fields);
  const { rows } = await db.query(
    `INSERT INTO event_requests (${cols.join(', ')}, source, user_id)
     VALUES (${cols.map((c, i) => `$${i + 1}${c === 'spaces' || c === 'services' ? '::jsonb' : c === 'email' ? '::text' : ''}`).join(', ')}, $${cols.length + 1},
             COALESCE($${cols.length + 2}::int, (SELECT id FROM users WHERE lower(email) = $${cols.indexOf('email') + 1}::text AND deleted_at IS NULL LIMIT 1)))
     RETURNING *`,
    [...cols.map((c) => fields[c]), source, userId],
  );
  const ev = (await db.query(`UPDATE event_requests SET reference = 'EVT-' || to_char(NOW(), 'YYYY') || '-' || LPAD(id::text, 4, '0') WHERE id = $1 RETURNING *`, [rows[0].id])).rows[0];
  await db.query(`INSERT INTO event_notes (event_id, kind, body) VALUES ($1, 'event', $2)`, [ev.id, `Request received from the ${source}`]);

  const { alertManagers } = require('./stayKeys');
  await alertManagers(app, `New event request · ${TYPE_LABEL[ev.event_type]}`, `${ev.name} · ${ev.guests} guests${ev.event_date ? ` · ${iso(ev.event_date)}` : ''}`, `/events?id=${ev.id}`);
  const io = app && app.get && app.get('io');
  if (io) io.to('staff').emit('event:created', { id: ev.id });

  if (emailService.configured) {
    emailService
      .sendEmail({
        to: ev.email,
        subject: `We have your ${TYPE_LABEL[ev.event_type].toLowerCase()} request · ${ev.reference}`,
        html: layout({
          preheader: 'Our events team will be in touch within one working day.',
          title: 'Thank you — let’s plan it together',
          intro: `Dear ${esc(ev.name)}, we have received your request. Every event at Faysha is tailored, so our events team will study your brief and come back to you within one working day, usually with a few questions and then a personalised proposal.`,
          body: panel('Your request', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${row('Reference', esc(ev.reference))}
              ${row('Event', esc(TYPE_LABEL[ev.event_type]))}
              ${row('Date', ev.event_date ? esc(iso(ev.event_date)) : 'Flexible')}
              ${row('Guests', esc(ev.guests))}
            </table>`),
        }),
        text: `Dear ${ev.name},\n\nWe have received your ${TYPE_LABEL[ev.event_type].toLowerCase()} request (${ev.reference}). Our events team will come back to you within one working day.\n\nFaysha Wellness Residence`,
      })
      .catch((e) => console.error('Event acknowledgement email failed:', e.message));
  }
  return ev;
}

/** Computes a quote's totals from its lines. Amounts are rounded to the currency's precision. */
function priceQuote({ items, discount = 0, taxRate = 0, depositPercent = 30, currency = 'XAF' }) {
  const dp = decimalsOf(currency);
  const round = (n) => Number((Math.round(n * 10 ** dp) / 10 ** dp).toFixed(dp));
  const lines = (Array.isArray(items) ? items : [])
    .map((it) => ({
      label: String(it.label || '').trim().slice(0, 160),
      detail: String(it.detail || '').trim().slice(0, 300),
      qty: Math.max(0, Number(it.qty) || 0),
      unit: String(it.unit || '').trim().slice(0, 30),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
    }))
    .filter((it) => it.label);
  if (!lines.length) throw httpError(400, 'Add at least one line to the quote');
  const subtotal = round(lines.reduce((s, it) => s + it.qty * it.unitPrice, 0));
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const rate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const tax = round(((subtotal - disc) * rate) / 100);
  const total = round(subtotal - disc + tax);
  const dpct = Math.max(0, Math.min(100, Number(depositPercent) || 0));
  return { items: lines, subtotal, discount: disc, taxRate: rate, tax, total, depositPercent: dpct, depositAmount: round((total * dpct) / 100) };
}

const toQuote = (q, { includeToken = false } = {}) =>
  q && {
    id: q.id,
    version: q.version,
    currency: q.currency,
    items: q.items,
    subtotal: Number(q.subtotal),
    discount: Number(q.discount),
    taxRate: Number(q.tax_rate),
    tax: Number(q.tax),
    total: Number(q.total),
    depositPercent: Number(q.deposit_percent),
    depositAmount: Number(q.deposit_amount),
    validUntil: iso(q.valid_until),
    notes: q.notes || '',
    status: q.status,
    sentAt: q.sent_at,
    viewedAt: q.viewed_at,
    respondedAt: q.responded_at,
    responseName: q.response_name,
    responseNote: q.response_note,
    ...(includeToken ? { link: q.token ? `${appUrl()}/events/quote/${q.token}` : null } : {}),
  };

const toEvent = (r) => ({
  id: r.id,
  reference: r.reference,
  source: r.source,
  guestId: r.user_id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  organisation: r.organisation,
  eventType: r.event_type,
  typeLabel: TYPE_LABEL[r.event_type] || r.event_type,
  title: r.title,
  eventDate: iso(r.event_date),
  flexibleDates: r.flexible_dates,
  altDate: iso(r.alt_date),
  startTime: r.start_time,
  endTime: r.end_time,
  guests: r.guests,
  spaces: r.spaces || [],
  catering: r.catering,
  cateringStyle: r.catering_style,
  dietary: r.dietary,
  services: r.services || [],
  roomsNeeded: r.rooms_needed,
  budgetMin: r.budget_min === null ? null : Number(r.budget_min),
  budgetMax: r.budget_max === null ? null : Number(r.budget_max),
  currency: r.currency,
  message: r.message,
  heardFrom: r.heard_from,
  status: r.status,
  assignedTo: r.assigned_to,
  assignedName: r.assigned_name || null,
  depositPaid: Number(r.deposit_paid || 0),
  depositPaidAt: r.deposit_paid_at,
  storyId: r.story_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Emails the client their quote with the private link. */
async function emailQuote(ev, quote) {
  const link = `${appUrl()}/events/quote/${quote.token}`;
  const money = (n) => formatMoney(n, quote.currency);
  const lines = (quote.items || [])
    .map((it) => row(`${it.label}${it.qty !== 1 ? ` × ${it.qty}${it.unit ? ` ${it.unit}` : ''}` : ''}`, esc(money(it.qty * it.unitPrice))))
    .join('');
  await emailService.sendEmail({
    to: ev.email,
    subject: `Your proposal for ${ev.title || TYPE_LABEL[ev.event_type].toLowerCase()} · ${ev.reference}`,
    html: layout({
      preheader: `Total ${money(quote.total)} · deposit ${money(quote.deposit_amount)} to reserve the date`,
      title: 'Your proposal is ready',
      intro: `Dear ${esc(ev.name)}, thank you for considering Faysha. Here is the proposal we have prepared for your ${esc(TYPE_LABEL[ev.event_type].toLowerCase())}${ev.event_date ? ` on ${esc(iso(ev.event_date))}` : ''} for ${esc(ev.guests)} guests.`,
      body: `${panel('Proposal', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}
          ${Number(quote.discount) ? row('Discount', `− ${esc(money(quote.discount))}`) : ''}
          ${Number(quote.tax) ? row(`Tax (${Number(quote.tax_rate)}%)`, esc(money(quote.tax))) : ''}
          ${row('Total', `<strong style="color:${C.gold}">${esc(money(quote.total))}</strong>`)}
          ${row(`Deposit to reserve the date (${Number(quote.deposit_percent)}%)`, esc(money(quote.deposit_amount)))}
        </table>
        ${quote.valid_until ? `<p style="margin:14px 0 0;font:13px ${sans};color:${C.muted}">Valid until ${esc(iso(quote.valid_until))}.</p>` : ''}`)}
        <div style="text-align:center;margin-top:24px">${button(link, 'View and accept')}</div>
        <p style="font:13px/1.6 ${sans};color:${C.muted};text-align:center;margin-top:16px">Questions or changes? Simply reply to this email.</p>`,
    }),
    text: `Dear ${ev.name},\n\nYour proposal (${ev.reference}) is ready: total ${money(quote.total)}, deposit ${money(quote.deposit_amount)}.\nView and accept it here: ${link}\n\nFaysha Wellness Residence`,
    replyTo: process.env.CONTACT_EMAIL || undefined,
  });
}

const newToken = () => crypto.randomBytes(24).toString('base64url');

module.exports = {
  TYPES, TYPE_LABEL, SPACES, SERVICES, CATERING, STYLES, STATUSES,
  cleanRequest, createRequest, priceQuote, toQuote, toEvent, emailQuote, newToken, httpError,
};
