/**
 * Emails a visitor their pass: the QR code (attached inline), the 6-digit gate code, the day and hours, and the
 * directions from FAY OS → Visitors. Sent when a pass with an email becomes active, or when the resident asks again.
 * The visitor sees their own name and the host's first name only; the email says nothing about a discreet flag.
 */
const QRCode = require('qrcode');
const db = require('../config/database');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const appUrl = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');

/** A tidy email address, or null. Throws a 400 when something was typed that is not one. */
function cleanEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (!EMAIL.test(s) || s.length > 200) throw Object.assign(new Error('That email address does not look right'), { status: 400 });
  return s;
}

/** Sends the pass. → true when sent; false when there is nothing to send. Throws when email is not configured or fails. */
async function emailPass(passId) {
  const { rows } = await db.query(
    `SELECT p.*, a.unit_number, u.full_name AS host
       FROM visitor_passes p LEFT JOIN apartments a ON a.id = p.apartment_id JOIN users u ON u.id = p.user_id
      WHERE p.id = $1`,
    [passId],
  );
  const p = rows[0];
  if (!p || !p.visitor_email || !['approved', 'arrived'].includes(p.status)) return false;
  const { layout, panel, row, code, button, esc, C, sans } = require('./emailLayout');
  const settings = (await db.query(`SELECT value FROM app_settings WHERE key = 'visitors'`)).rows[0]?.value || {};
  const link = `${appUrl()}/visit/${p.token}`;
  const png = await QRCode.toBuffer(link, { width: 520, margin: 2 });
  const host = String(p.host || '').split(' ')[0] || 'your host';
  const day = new Date(p.visit_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const hours = `${p.arrive_from ? `from ${p.arrive_from} ` : ''}until ${p.arrive_until || settings.visitUntil || '22:00'}`;
  const directions = settings.directions || 'Show this pass at the main gate with your ID. Security will guide you to the residence.';

  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row('Day', esc(day))}
    ${row('Hours', esc(hours))}
    ${p.unit_number ? row('Residence', esc(p.unit_number)) : ''}
    ${row('People', esc(p.people))}
  </table>`;
  const pass = panel('Your pass', `
    <div style="text-align:center;margin:4px 0 16px"><img src="cid:visit-qr" width="200" height="200" alt="Visitor pass QR code" style="background:#fff;padding:10px;border-radius:12px"></div>
    ${code(p.code, 'Gate code (valid on the day of your visit)')}
    <p style="margin:16px 0 0;text-align:center;font:13px/1.6 ${sans};color:${C.muted}">Show the QR code or give the code at the gate, with your ID.</p>`);
  const getting = panel('Getting here', `
    <p style="margin:0;font:14px/1.65 ${sans};color:${C.text}">${esc(directions)}</p>
    ${settings.mapsUrl ? `<p style="margin:12px 0 0"><a href="${esc(settings.mapsUrl)}" style="color:${C.gold}">Open the map</a></p>` : ''}
    ${settings.gatePhone ? `<p style="margin:8px 0 0;font:13px ${sans};color:${C.muted}">Gate: ${esc(settings.gatePhone)}</p>` : ''}`);

  await require('./email.service').sendEmail({
    to: p.visitor_email,
    subject: `Your visit to Faysha · ${day}`,
    html: layout({
      preheader: `${host} has invited you · ${day}`,
      title: 'You are expected',
      intro: `Dear ${esc(p.visitor_name)}, ${esc(host)} has invited you to Faysha Wellness Residence. Your pass is below.`,
      body: `${panel('Your visit', details)}${pass}${getting}<div style="text-align:center;margin-top:24px">${button(link, 'Open my pass')}</div>`,
    }),
    text: [
      `Dear ${p.visitor_name},`,
      '',
      `${host} has invited you to Faysha Wellness Residence on ${day}, ${hours}.`,
      `Your pass: ${link}`,
      `Gate code: ${p.code} (with your ID)`,
      '',
      directions,
      settings.mapsUrl ? `Map: ${settings.mapsUrl}` : '',
      settings.gatePhone ? `Gate: ${settings.gatePhone}` : '',
    ].filter((l, i, a) => l || a[i - 1]).join('\n'),
    attachments: [{ filename: 'visitor-pass.png', content: png, cid: 'visit-qr' }],
  });
  await db.query(`UPDATE visitor_passes SET emailed_at = NOW() WHERE id = $1`, [p.id]);
  return true;
}

/** Fire-and-forget form for status changes: a mail problem never blocks approving a pass. */
const emailPassQuietly = (passId) =>
  emailPass(passId).catch((e) => console.warn(`Visitor pass ${passId} not emailed: ${e.message}`));

module.exports = { emailPass, emailPassQuietly, cleanEmail };
