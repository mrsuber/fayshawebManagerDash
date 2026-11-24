/**
 * The stay pass: everything in the confirmation email, as one PDF the team can download or send on WhatsApp —
 * the stay (residence, dates and times, nights, amount and what is paid), the digital key (gate QR code, door PIN),
 * the deposit box (number and PIN), the guest's app sign-in email, how to reach us and the house rules in short.
 *
 *   data(bookingId)      → the pass as JSON (FAY OS and HQ show it), with a private link to the PDF
 *   pdf(bookingId)       → Buffer
 *   link(booking)        → /api/stay-pass/<id>/<token>: opens the PDF without signing in, for the guest (WhatsApp)
 *
 * The private link is an HMAC of the booking and its key: it stops working if the key is reissued, and once the
 * stay is over or cancelled. The temporary password is never in the pass (it is only ever sent by email).
 */
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const db = require('../config/database');
const money = require('../utils/money');

// The PDF's standard fonts cover Western European text: no narrow/no-break spaces or arrows.
const pdfText = (t) => String(t ?? '').replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/[\u2190-\u21ff]/g, '-');
const formatMoney = (n, c) => pdfText(money.formatMoney(n, c));

const LIVE = ['pending', 'confirmed', 'checked_in'];
const secret = () => process.env.JWT_SECRET || 'faysha';
const apiBase = () => (process.env.API_PUBLIC_URL || `${(process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '')}/api`).replace(/\/$/, '');

const token = (b) => crypto.createHmac('sha256', secret()).update(`stay-pass:${b.id}:${b.gate_qr_code || ''}:${b.booking_number}`).digest('base64url').slice(0, 32);
const link = (b) => `${apiBase()}/stay-pass/${b.id}/${token(b)}`;

const longDay = (d) =>
  new Date(`${d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

async function load(bookingId) {
  const { rows } = await db.query(
    `SELECT b.*, a.unit_number, a.floor, a.building, c.display_name AS category,
            u.email AS account_email, u.username, u.last_login,
            COALESCE((SELECT SUM(amount - COALESCE(refund_amount, 0)) FROM payments p WHERE p.booking_id = b.id AND p.status IN ('completed', 'refunded')), 0) AS paid
       FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN apartment_categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [bookingId],
  );
  if (!rows[0]) throw Object.assign(new Error('Booking not found'), { status: 404 });
  return rows[0];
}

async function settings() {
  const { rows } = await db.query(`SELECT key, value FROM app_settings WHERE key IN ('property', 'visitors')`);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value || {}]));
  const p = s.property || {};
  return {
    name: p.name || 'Faysha Wellness Residence',
    phone: p.phone || process.env.CONTACT_PHONE || '',
    email: p.email || process.env.CONTACT_EMAIL || '',
    checkIn: p.standardCheckIn || '14:00',
    checkOut: p.standardCheckOut || '11:00',
    directions: s.visitors?.directions || '',
    gatePhone: s.visitors?.gatePhone || '',
  };
}

/** The pass as JSON for FAY OS and HQ. */
async function data(bookingId) {
  const b = await load(bookingId);
  const s = await settings();
  const total = Number(b.final_price);
  const paid = Number(b.paid);
  return {
    id: b.id,
    number: b.booking_number,
    status: b.status,
    guest: { name: b.guest_name, email: b.guest_email, phone: b.guest_phone, guests: b.number_of_guests },
    residence: { unit: b.unit_number, category: b.category, building: b.building || null, floor: b.floor ?? null },
    checkIn: { date: String(b.check_in_date instanceof Date ? b.check_in_date.toISOString() : b.check_in_date).slice(0, 10), time: s.checkIn },
    checkOut: { date: String(b.check_out_date instanceof Date ? b.check_out_date.toISOString() : b.check_out_date).slice(0, 10), time: s.checkOut },
    nights: b.number_of_nights,
    total,
    paid,
    balance: Math.max(0, total - paid),
    currency: b.currency || 'XAF',
    key: b.gate_qr_code
      ? { gateCode: b.gate_qr_code, qr: await QRCode.toDataURL(b.gate_qr_code, { width: 320, margin: 1 }), doorPin: b.door_pin || null, issuedAt: b.keys_generated_at }
      : null,
    depositBox: b.deposit_box_number ? { number: b.deposit_box_number, pin: b.deposit_box_pin || null } : null,
    account: b.user_id ? { email: b.account_email || b.guest_email, username: b.username, signedIn: Boolean(b.last_login) } : null,
    email: { sent: Boolean(b.email_sent), sentAt: b.email_sent_at, error: b.confirmation_error || null },
    // The guest's own copy, for WhatsApp: only while the stay is live and its key is issued.
    pdfLink: b.gate_qr_code && LIVE.includes(b.status) ? link(b) : null,
    whatsappText: `Hello ${b.guest_name}, here is your Faysha stay pass for ${b.booking_number}: ${b.category} · ${b.unit_number}, ${longDay(b.check_in_date)} to ${longDay(b.check_out_date)}. It has your gate QR code, door PIN and deposit box. Please keep it private.`,
    contact: { phone: s.phone, email: s.email },
    // HQ → Settings → WhatsApp connected: the PDF can be sent from the business number.
    whatsappConnected: await require('./whatsapp').isReady().catch(() => false),
  };
}

/** The PDF (A4), in the Faysha colours. */
async function pdf(bookingId) {
  const b = await load(bookingId);
  const s = await settings();
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Stay pass ${b.booking_number}`, Author: s.name } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const GOLD = '#b8862e';
  const INK = '#1b1d22';
  const MUTED = '#6b6558';
  const LINE = '#e3dccd';
  const W = doc.page.width - 96;

  // Header band
  doc.rect(0, 0, doc.page.width, 110).fill('#0a0c0f');
  doc.fillColor('#e8b84a').font('Times-Roman').fontSize(26).text('F A Y S H A', 48, 34, { characterSpacing: 2 });
  doc.fillColor('#ece6da').font('Helvetica').fontSize(10).text(s.name.toUpperCase(), 48, 68, { characterSpacing: 1.5 });
  doc.fillColor('#ece6da').fontSize(10).text(`Stay pass · ${b.booking_number}`, 48, 68, { width: W, align: 'right' });

  let y = 136;
  doc.fillColor(INK).font('Times-Roman').fontSize(24).text(`Welcome, ${b.guest_name}`, 48, y);
  y = doc.y + 4;
  doc.fillColor(MUTED).font('Helvetica').fontSize(10.5).text('Everything you need for your arrival. Keep this document private: it opens your residence.', 48, y, { width: W });
  y = doc.y + 18;

  const label = (t, x, yy, w) => doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(t.toUpperCase(), x, yy, { width: w, characterSpacing: 0.8 });
  const value = (t, x, yy, w, size = 12) => doc.fillColor(INK).font('Helvetica-Bold').fontSize(size).text(t, x, yy, { width: w });

  // Stay
  const col = W / 2;
  const rows = [
    ['Residence', `${b.category} · ${b.unit_number}${b.building ? ` · ${b.building}` : ''}${b.floor !== null && b.floor !== undefined ? ` · floor ${b.floor}` : ''}`],
    ['Guests', String(b.number_of_guests)],
    ['Arrival', `${longDay(b.check_in_date)}, from ${s.checkIn}`],
    ['Departure', `${longDay(b.check_out_date)}, by ${s.checkOut}`],
    ['Nights', String(b.number_of_nights)],
    ['Amount', `${formatMoney(b.final_price, b.currency || 'XAF')}${Number(b.paid) >= Number(b.final_price) ? ' · paid' : Number(b.paid) > 0 ? ` · ${formatMoney(b.paid, b.currency || 'XAF')} paid` : ' · to pay on arrival'}`],
  ];
  doc.roundedRect(48, y, W, 150, 8).strokeColor(LINE).lineWidth(1).stroke();
  let ry = y + 14;
  rows.forEach(([k, v], i) => {
    const x = 64 + (i % 2) * col;
    if (i % 2 === 0 && i) ry += 44;
    label(k, x, ry, col - 24);
    value(v, x, ry + 12, col - 24, 11);
  });
  y += 168;

  // Digital key
  doc.fillColor(INK).font('Times-Roman').fontSize(18).text('Your digital key', 48, y);
  y = doc.y + 8;
  const boxH = 210;
  doc.roundedRect(48, y, W, boxH, 8).fillAndStroke('#faf7f0', LINE);
  if (b.gate_qr_code) {
    const png = await QRCode.toBuffer(b.gate_qr_code, { width: 360, margin: 1 });
    doc.image(png, 64, y + 16, { width: 178, height: 178 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Show at the gate', 64, y + 194, { width: 178, align: 'center' });
    const x = 268;
    const w = W - (x - 48) - 16;
    label('Residence door PIN', x, y + 22, w);
    doc.fillColor(GOLD).font('Courier-Bold').fontSize(34).text(b.door_pin || '—', x, y + 36, { width: w, characterSpacing: 6 });
    label('Deposit box', x, y + 92, w);
    value(b.deposit_box_number ? `Box ${b.deposit_box_number}` : 'Ask the concierge', x, y + 105, w, 13);
    label('Deposit box PIN', x, y + 132, w);
    if (b.deposit_box_pin) doc.fillColor(INK).font('Courier-Bold').fontSize(20).text(b.deposit_box_pin, x, y + 145, { width: w, characterSpacing: 3 });
    else doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Appears in the app when your stay begins', x, y + 147, { width: w });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Deliveries go to your deposit box; its PIN changes after each delivery and the app always shows the current one.', x, y + 176, { width: w });
  } else {
    doc.fillColor(MUTED).font('Helvetica').fontSize(11).text('Your digital key (gate QR code and door PIN) is issued when the stay is confirmed. It will be in the Faysha app and in your confirmation email.', 64, y + 24, { width: W - 32 });
  }
  y += boxH + 22;

  // Account + contact
  const half = (W - 16) / 2;
  doc.fillColor(INK).font('Times-Roman').fontSize(15).text('The Faysha app', 48, y, { width: half });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(
    b.user_id
      ? `Sign in with ${b.account_email || b.guest_email}${b.last_login ? '' : ' and the temporary password from your confirmation email (you choose your own the first time)'}. Your key, dining, wellness, rides, visitors and the concierge are all there.`
      : 'Download the Faysha app and sign in with your email to open your key and every service.',
    48, doc.y + 4, { width: half },
  );
  const cy = y;
  doc.fillColor(INK).font('Times-Roman').fontSize(15).text('Reach us', 48 + half + 16, cy, { width: half });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(
    [s.phone ? `Reception ${s.phone}` : null, s.gatePhone ? `Gate ${s.gatePhone}` : null, s.email || null, 'or the concierge chat in the app'].filter(Boolean).join('\n'),
    48 + half + 16, cy + 22, { width: half },
  );
  y = Math.max(doc.y, cy + 90) + 14;
  if (s.directions) {
    doc.fillColor(INK).font('Times-Roman').fontSize(15).text('Getting here', 48, y);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(s.directions.slice(0, 600), 48, doc.y + 4, { width: W });
    y = doc.y + 14;
  }

  // House rules in short
  doc.moveTo(48, y).lineTo(48 + W, y).strokeColor(LINE).stroke();
  y += 10;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text('House rules in short', 48, y);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(
    'Respect the maximum occupancy and quiet hours. Visitors come within visiting hours; anyone staying the night is registered on your stay in the app. ' +
      'You are responsible for your children, your visitors and any damage they cause. No smoking indoors. The full terms of service are on our website and in the app.',
    48, doc.y + 3, { width: W },
  );
  doc.fillColor(MUTED).fontSize(7.5).text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${b.booking_number}`, 48, doc.page.height - 40, { width: W, align: 'center' });

  doc.end();
  return done;
}

/** For the public link: the booking when the token is right and the stay is live; null otherwise. */
async function byToken(id, t) {
  const b = (await db.query(`SELECT id, booking_number, gate_qr_code, status, check_out_date FROM bookings WHERE id = $1`, [Number(id) || 0])).rows[0];
  if (!b || !b.gate_qr_code) return null;
  const expected = token(b);
  if (typeof t !== 'string' || t.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected))) return null;
  if (!LIVE.includes(b.status)) return null;
  return b;
}

module.exports = { data, pdf, link, byToken };
