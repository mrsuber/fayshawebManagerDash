/**
 * WhatsApp Business (Meta WhatsApp Cloud API). Set up in HQ → Settings → WhatsApp; stored in app_settings
 * ('whatsapp'), the access token and app secret encrypted like the payment keys.
 *
 *   Settings: phoneNumberId, businessAccountId (optional), accessToken, appSecret, verifyToken (generated here, pasted in
 *             Meta), apiVersion, defaultCountryCode (for numbers saved without one), stay-pass template.
 *   Sending:  FAY OS → Communications with the WhatsApp channel (text and photos/documents), the stay pass PDF from a
 *             reservation (FAY OS and HQ), and — when switched on — the stay pass when a booking is confirmed.
 *   Receiving: the webhook (GET verify, POST messages and delivery statuses, signed with the app secret). A guest's
 *             message lands in their Communications thread (channel whatsapp); an unknown number raises an alert.
 *
 * Meta's 24-hour rule: free text reaches a guest only within 24 hours of their last WhatsApp message. Outside it, only an
 * approved template can start the conversation — the stay pass uses the template set here when there is one.
 */
const crypto = require('crypto');
const db = require('../config/database');
const { encrypt, decrypt, hint } = require('./payments/secretBox');

const KEY = 'whatsapp';
// WHATSAPP_GRAPH_URL only for tests (a local stand-in for Meta).
const GRAPH = (process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com').replace(/\/$/, '');
const CACHE_MS = 15000;
let cache = null;

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const clean = (v) => (typeof v === 'string' ? v.replace(/[​-‍﻿]/g, '').trim() : '');
const apiBase = () => (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || `${(process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '')}/api`).replace(/\/$/, '');
const siteBase = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');

async function readRow() {
  const { rows } = await db.query('SELECT value, updated_at FROM app_settings WHERE key = $1', [KEY]);
  return rows[0] || { value: {}, updated_at: null };
}

/** The settings in force (decrypted). */
async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const row = await readRow();
  const v = row.value || {};
  const value = {
    enabled: v.enabled !== false,
    phoneNumberId: v.phoneNumberId || null,
    businessAccountId: v.businessAccountId || null,
    accessToken: decrypt(v.accessToken),
    appSecret: decrypt(v.appSecret),
    verifyToken: v.verifyToken || null,
    apiVersion: v.apiVersion || 'v21.0',
    defaultCountryCode: v.defaultCountryCode || '237',
    stayPassTemplate: v.stayPassTemplate || null, // { name, language }
    autoSendStayPass: Boolean(v.autoSendStayPass),
    saved: v,
    updatedAt: row.updated_at,
  };
  cache = { at: Date.now(), value };
  return value;
}

const ready = (c) => Boolean(c.enabled && c.phoneNumberId && c.accessToken);
async function isReady() {
  return ready(await load());
}

async function writeRow(next, userId) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [KEY, JSON.stringify(next), userId],
  );
  cache = null;
}

/** Saves what is given (blank secrets keep the saved ones). Returns the names of the fields changed. */
async function save(body = {}, userId = null) {
  const row = await readRow();
  const next = { ...(row.value || {}) };
  const changed = [];
  const id = clean(body.phoneNumberId);
  const waba = clean(body.businessAccountId);
  const token = clean(body.accessToken);
  const secret = clean(body.appSecret);
  const version = clean(body.apiVersion);
  const cc = clean(body.defaultCountryCode).replace(/\D/g, '');
  if (id && !/^\d{6,20}$/.test(id)) throw httpError(400, 'The phone number ID is the long number shown under your number in Meta → WhatsApp → API setup (not the phone number itself)');
  if (waba && !/^\d{6,20}$/.test(waba)) throw httpError(400, 'The WhatsApp Business Account ID is a long number');
  if (token && token.length < 40) throw httpError(400, 'That does not look like an access token — use a permanent token from a System User in Meta Business settings');
  if (secret && !/^[a-f0-9]{32}$/i.test(secret)) throw httpError(400, 'The app secret is 32 letters and digits (Meta → your app → App settings → Basic → App secret)');
  if (version && !/^v\d{2}\.\d$/.test(version)) throw httpError(400, 'API version looks like v21.0');
  if (body.defaultCountryCode !== undefined && body.defaultCountryCode !== '' && !/^\d{1,4}$/.test(cc)) throw httpError(400, 'Country code: digits only, e.g. 237');
  if (id) { next.phoneNumberId = id; changed.push('phoneNumberId'); }
  if (waba) { next.businessAccountId = waba; changed.push('businessAccountId'); }
  if (token) { next.accessToken = encrypt(token); changed.push('accessToken'); }
  if (secret) { next.appSecret = encrypt(secret); changed.push('appSecret'); }
  if (version) { next.apiVersion = version; changed.push('apiVersion'); }
  if (cc) { next.defaultCountryCode = cc; changed.push('defaultCountryCode'); }
  if (body.stayPassTemplate !== undefined) {
    const name = clean(body.stayPassTemplate?.name);
    const language = clean(body.stayPassTemplate?.language) || 'en';
    if (name && !/^[a-z0-9_]{1,512}$/.test(name)) throw httpError(400, 'Template names are lowercase letters, digits and _ (as in WhatsApp Manager)');
    next.stayPassTemplate = name ? { name, language } : null;
    changed.push('stayPassTemplate');
  }
  if (body.autoSendStayPass !== undefined) { next.autoSendStayPass = Boolean(body.autoSendStayPass); changed.push('autoSendStayPass'); }
  if (body.enabled !== undefined) { next.enabled = Boolean(body.enabled); changed.push('enabled'); }
  if (!next.verifyToken) next.verifyToken = crypto.randomBytes(18).toString('base64url');
  if (!changed.length) throw httpError(400, 'Nothing to save');
  await writeRow(next, userId);
  return changed;
}

async function clear(userId = null) {
  const row = await readRow();
  // The verify token is kept so the webhook in Meta keeps working if the keys are pasted again.
  await writeRow({ verifyToken: row.value?.verifyToken || crypto.randomBytes(18).toString('base64url') }, userId);
}

/** What HQ shows: never the secrets, only their last characters. */
async function status() {
  let c = await load();
  if (!c.verifyToken) {
    await writeRow({ ...(c.saved || {}), verifyToken: crypto.randomBytes(18).toString('base64url') }, null);
    c = await load();
  }
  return {
    ready: ready(c),
    enabled: c.enabled,
    phoneNumberId: c.phoneNumberId,
    businessAccountId: c.businessAccountId,
    apiVersion: c.apiVersion,
    defaultCountryCode: c.defaultCountryCode,
    stayPassTemplate: c.stayPassTemplate,
    autoSendStayPass: c.autoSendStayPass,
    saved: {
      accessToken: c.saved.accessToken ? hint(c.accessToken) || 'unreadable' : null,
      appSecret: c.saved.appSecret ? hint(c.appSecret) || 'unreadable' : null,
    },
    verifiesWebhooks: Boolean(c.appSecret),
    webhookUrl: `${apiBase()}/whatsapp/webhook`,
    verifyToken: c.verifyToken,
    fields: ['messages'],
    updatedAt: c.updatedAt,
  };
}

// ---------------------------------------------------------------- Graph API
async function graph(path, { method = 'GET', body, c } = {}) {
  const cfg = c || (await load());
  if (!ready(cfg)) throw httpError(409, 'WhatsApp is not connected — HQ → Settings → WhatsApp');
  let res;
  try {
    res = await fetch(`${GRAPH}/${cfg.apiVersion}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw httpError(502, `WhatsApp did not answer (${e.message})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = data.error || {};
    const code = err.code;
    // The usual ones, in words a manager can act on.
    const known = {
      131047: 'More than 24 hours since the guest last wrote on WhatsApp: Meta only allows an approved template now. Set the stay-pass template in HQ → Settings → WhatsApp, or reach the guest another way.',
      131026: 'This number cannot receive WhatsApp messages (not on WhatsApp, or an old app).',
      190: 'The WhatsApp access token has expired or is wrong — paste a new one in HQ → Settings → WhatsApp.',
      132001: 'The template does not exist in this language — check its name and language in HQ → Settings → WhatsApp.',
      132000: 'The template’s variables do not match (it needs 3 body variables: guest name, booking number, dates).',
      100: err.message || 'WhatsApp refused the request (check the phone number ID).',
    };
    throw httpError(res.status >= 500 ? 502 : 409, known[code] || err.error_user_msg || err.message || `WhatsApp refused it (${res.status})`, { waCode: code });
  }
  return data;
}

/** A WhatsApp number from what is saved on a guest: digits with the country code. */
function toNumber(phone, cc = '237') {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  else if (String(phone).trim().startsWith('+')) {
    /* already international */
  } else if (d.length <= 9) d = `${cc}${d.replace(/^0+/, '')}`;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

async function send(to, payload) {
  const c = await load();
  const number = toNumber(to, c.defaultCountryCode);
  if (!number) throw httpError(400, 'No valid phone number for this guest');
  const data = await graph(`${c.phoneNumberId}/messages`, { method: 'POST', c, body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: number, ...payload } });
  return { id: data.messages?.[0]?.id || null, to: number };
}

const sendText = (to, text) => send(to, { type: 'text', text: { body: String(text).slice(0, 4096), preview_url: true } });
const sendDocument = (to, { link, filename, caption }) => send(to, { type: 'document', document: { link, filename, caption: caption ? String(caption).slice(0, 1024) : undefined } });
const sendImage = (to, { link, caption }) => send(to, { type: 'image', image: { link, caption: caption ? String(caption).slice(0, 1024) : undefined } });

/** An uploaded file (/uploads/...) as a public link WhatsApp can fetch. */
const publicLink = (url) => `${siteBase()}${url.startsWith('/') ? '' : '/'}${url}`;

/** Checks the connection: the number's name and quality. */
async function check() {
  const c = await load();
  if (!ready(c)) return { result: 'missing', message: 'Add the phone number ID and the access token' };
  try {
    const n = await graph(`${c.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`, { c });
    return { result: 'ok', message: `Connected: ${n.verified_name || 'your business'} · ${n.display_phone_number || ''}${n.quality_rating ? ` · quality ${n.quality_rating.toLowerCase()}` : ''}`, number: n.display_phone_number, name: n.verified_name };
  } catch (e) {
    return { result: e.status === 502 ? 'unreachable' : 'refused', message: e.message };
  }
}

/** Sends Meta's built-in hello_world template to a number: proves sending works end to end. */
async function test(to) {
  return send(to, { type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } });
}

// ---------------------------------------------------------------- the stay pass
/**
 * Sends a booking's stay pass PDF. Within the 24-hour window: the document with a caption. Otherwise (or if that is
 * refused for the window) the stay-pass template, when one is set: a template with a DOCUMENT header and 3 body
 * variables {{1}} guest name, {{2}} booking number, {{3}} dates.
 */
async function sendStayPass(bookingId) {
  const stayPass = require('./stayPass');
  const p = await stayPass.data(bookingId);
  if (!p.pdfLink) throw httpError(409, 'The stay pass is sent once the stay is confirmed and its key issued');
  if (!p.guest.phone) throw httpError(400, 'No phone number on this booking');
  const c = await load();
  const filename = `Faysha-${p.number}.pdf`;
  const dates = `${p.checkIn.date} to ${p.checkOut.date}`;
  const viaTemplate = () => {
    if (!c.stayPassTemplate?.name) {
      throw httpError(409, 'More than 24 hours since the guest last wrote on WhatsApp: Meta only allows an approved template. Add the stay-pass template in HQ → Settings → WhatsApp, or use “Download PDF” / the email.');
    }
    return send(p.guest.phone, {
      type: 'template',
      template: {
        name: c.stayPassTemplate.name,
        language: { code: c.stayPassTemplate.language || 'en' },
        components: [
          { type: 'header', parameters: [{ type: 'document', document: { link: p.pdfLink, filename } }] },
          { type: 'body', parameters: [p.guest.name, p.number, dates].map((text) => ({ type: 'text', text: String(text) })) },
        ],
      },
    });
  };
  let sent;
  let mode = 'document';
  if (!(await withinWindow(p.guest.phone))) {
    sent = await viaTemplate();
    mode = 'template';
  } else {
    try {
      sent = await sendDocument(p.guest.phone, { link: p.pdfLink, filename, caption: p.whatsappText });
    } catch (e) {
      if (e.waCode !== 131047) throw e;
      sent = await viaTemplate();
      mode = 'template';
    }
  }
  await recordOutgoing(p, sent, mode);
  return { ...sent, mode };
}

/** Did the guest write on WhatsApp in the last 24 hours (so free text and documents can reach them)? */
async function withinWindow(phone) {
  const d = String(phone || '').replace(/\D/g, '').slice(-9);
  if (!d) return false;
  const { rows } = await db.query(
    `SELECT 1 FROM concierge_messages m JOIN users u ON u.id = m.user_id
      WHERE m.channel = 'whatsapp' AND m.sender_type = 'user' AND m.created_at > NOW() - INTERVAL '24 hours'
        AND right(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 9) = $1 LIMIT 1`,
    [d],
  );
  return rows.length > 0;
}

/** Keeps the stay pass in the guest's Communications thread. */
async function recordOutgoing(p, sent, mode) {
  const b = (await db.query('SELECT user_id FROM bookings WHERE id = $1', [p.id])).rows[0];
  if (!b?.user_id) return;
  await db.query(
    `INSERT INTO concierge_messages (user_id, message, sender_type, metadata, channel, is_read) VALUES ($1, $2, 'concierge', $3, 'whatsapp', true)`,
    [b.user_id, `📎 Stay pass ${p.number} (PDF)${mode === 'template' ? ' — template' : ''}`, JSON.stringify({ auto: true, waMessageId: sent.id, waStatus: 'sent' })],
  ).catch((e) => console.error('Recording the WhatsApp stay pass failed:', e.message));
}

/** After a confirmation (stayKeys.finalizeStay): sends the stay pass when "send automatically" is on. Never throws. */
async function autoStayPass(bookingId) {
  try {
    const c = await load();
    if (!ready(c) || !c.autoSendStayPass) return null;
    return await sendStayPass(bookingId);
  } catch (e) {
    console.error(`WhatsApp stay pass for booking ${bookingId} not sent: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- webhook (receiving)
function verifySignature(raw, header, appSecret) {
  if (!appSecret) return true; // without the app secret saved, Meta's signature cannot be checked (HQ warns)
  if (!header || !/^sha256=/.test(header)) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(raw).digest('hex')}`;
  return header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Downloads an incoming photo or document into uploads/chat. */
async function fetchMedia(c, mediaId, fallbackName) {
  try {
    const meta = await graph(mediaId, { c });
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${c.accessToken}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await require('./attachments').store(buf, fallbackName, 0);
  } catch (e) {
    console.error('WhatsApp media download failed:', e.message);
    return null;
  }
}

/** Handles one webhook delivery (already signature-checked). */
async function receive(app, body) {
  const c = await load();
  const io = app && app.get && app.get('io');
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      if (c.phoneNumberId && v.metadata?.phone_number_id && v.metadata.phone_number_id !== c.phoneNumberId) continue;
      // Delivery receipts for what we sent.
      for (const s of v.statuses || []) {
        await db.query(
          `UPDATE concierge_messages SET metadata = metadata || jsonb_build_object('waStatus', $2::text, 'waError', $3::text) WHERE metadata->>'waMessageId' = $1`,
          [s.id, s.status, s.errors?.[0]?.title || null],
        ).catch(() => {});
      }
      const names = Object.fromEntries((v.contacts || []).map((x) => [x.wa_id, x.profile?.name]));
      for (const m of v.messages || []) {
        const from = String(m.from || '');
        const last9 = from.slice(-9);
        const guest = (await db.query(
          `SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
            WHERE u.deleted_at IS NULL AND right(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 9) = $1
            ORDER BY r.name = 'guest' DESC, u.last_login DESC NULLS LAST LIMIT 1`,
          [last9],
        )).rows[0];
        let text = '';
        let attachment = null;
        if (m.type === 'text') text = m.text?.body || '';
        else if (m.type === 'image') {
          attachment = await fetchMedia(c, m.image?.id, 'whatsapp.jpg');
          text = m.image?.caption || '📷 Photo';
        } else if (m.type === 'document') {
          attachment = await fetchMedia(c, m.document?.id, m.document?.filename || 'document.pdf');
          text = m.document?.caption || `📎 ${m.document?.filename || 'Document'}`;
        } else if (m.type === 'button') text = m.button?.text || '';
        else if (m.type === 'interactive') text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
        else if (m.type === 'location') text = `📍 Location: ${m.location?.latitude},${m.location?.longitude}${m.location?.name ? ` (${m.location.name})` : ''}`;
        else text = `[${m.type} message — open WhatsApp to see it]`;
        if (!guest) {
          await require('./notify').staffAlert(app, {
            title: `WhatsApp from +${from}${names[from] ? ` (${names[from]})` : ''}`,
            body: `${text.slice(0, 200)} — not matched to a guest: add this number to their profile in Guest 360, then reply from Communications.`,
            link: '/comms',
            level: 'action',
            category: 'messages',
            dedupeKey: `wa-unknown:${m.id}`,
          });
          continue;
        }
        const exists = await db.query(`SELECT 1 FROM concierge_messages WHERE metadata->>'waMessageId' = $1 LIMIT 1`, [m.id]);
        if (exists.rows.length) continue; // Meta retries deliveries
        const { rows } = await db.query(
          `INSERT INTO concierge_messages (user_id, message, sender_type, metadata, channel, is_read) VALUES ($1, $2, 'user', $3, 'whatsapp', false) RETURNING *`,
          [guest.id, text.slice(0, 4000) || '…', JSON.stringify({ waMessageId: m.id, waFrom: from, ...(attachment ? { attachment } : {}) })],
        );
        if (io) {
          io.to('admin').emit('new_message', rows[0]);
          io.to('staff').emit('message:new', { id: rows[0].id, guestId: guest.id, guestName: guest.full_name, body: rows[0].message, channel: 'whatsapp', from: 'guest', at: rows[0].created_at });
        }
        await require('./notify').staffAlert(app, {
          title: `WhatsApp from ${guest.full_name}`,
          body: text.slice(0, 200),
          link: `/comms?conversation=${guest.id}`,
          level: 'action',
          category: 'messages',
        });
      }
    }
  }
}

module.exports = {
  load, isReady, save, clear, status, check, test, toNumber, sendText, sendDocument, sendImage, publicLink,
  sendStayPass, autoStayPass, withinWindow, verifySignature, receive,
};
