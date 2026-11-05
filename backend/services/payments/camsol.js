/**
 * PayWithCAMSOL (SuberPay) — MTN Mobile Money and Orange Money collections in XAF.
 *
 *   start   POST {base}/api/v1/balance/refill            X-API-Key: sk_…   { amount, accountNumber: "2376XXXXXXXX" }
 *   status  GET  {base}/api/v1/balance/refill/{id}/status
 *   webhook POST /api/payments/webhook/camsol — HMAC-SHA256 of the raw body with the webhook secret (hex,
 *           optionally "sha256="), in x-paywithcamsol-signature / x-webhook-signature / x-suberpay-signature.
 *           The body is never trusted: the payment's status is fetched from PayWithCAMSOL again.
 *
 * Without keys and outside production the gateway is simulated: a payment succeeds after CAMSOL_FAKE_CONFIRM_SECONDS
 * (default 5). Numbers ending 600000001 fail, as with PayWithCAMSOL test keys.
 */
const crypto = require('crypto');
const settings = require('./settings');

const TIMEOUT_MS = 30000;
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

/** "+237 6 70 12 34 56" → "237670123456"; local 9-digit numbers get the 237 prefix. */
function accountNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('6')) d = `237${d}`;
  if (!/^2376\d{8}$/.test(d)) throw httpError(400, 'Enter a Cameroon mobile money number, e.g. 6 70 12 34 56');
  return d;
}

/** PayWithCAMSOL states → succeeded | failed | pending. */
function stateOf(raw) {
  const s = String(raw || '').toUpperCase();
  if (['PROCESSING', 'COMPLETED', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED'].includes(s)) return 'succeeded';
  if (['FAILED', 'FAILURE', 'CANCELED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(s)) return 'failed';
  return 'pending';
}

async function call(cfg, method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: { 'X-API-Key': cfg.secretKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw httpError(503, 'PayWithCAMSOL could not be reached', { unavailable: true });
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status >= 500 || res.status === 408 || res.status === 429) throw httpError(503, 'PayWithCAMSOL is busy, please try again', { unavailable: true, httpStatus: res.status });
  if (!res.ok || json.success === false) {
    throw httpError(402, json.message || json.error || 'The mobile money payment was refused', { httpStatus: res.status });
  }
  return json.data || json;
}

// ------------------------------------------------------------------ simulated gateway (development)
const fake = new Map();
const fakeSeconds = () => parseInt(process.env.CAMSOL_FAKE_CONFIRM_SECONDS, 10) || 5;

function fakeStart(amount, number) {
  const id = `sim_${crypto.randomBytes(6).toString('hex')}`;
  fake.set(id, { at: Date.now(), fail: number.endsWith('600000001'), amount });
  return { id, state: 'pending' };
}
function fakeStatus(id) {
  const f = fake.get(id);
  if (!f) return { state: 'failed', reason: 'Unknown payment' };
  if (Date.now() - f.at < fakeSeconds() * 1000) return { state: 'pending' };
  return f.fail ? { state: 'failed', reason: 'Payment declined (simulated)' } : { state: 'succeeded' };
}

// ------------------------------------------------------------------ public API
/** Asks the guest's phone to approve a payment. Returns { id, state, simulated }. */
async function startCollection({ amount, phone }) {
  const { camsol } = await settings.load();
  const number = accountNumber(phone);
  const value = Math.round(Number(amount));
  if (!(value > 0)) throw httpError(400, 'Nothing to pay');
  if (camsol.source === 'simulated') return { ...fakeStart(value, number), simulated: true };
  if (!camsol.secretKey) throw httpError(503, 'Automatic mobile money is not set up', { notConfigured: true });
  const data = await call(camsol, 'POST', '/api/v1/balance/refill', { amount: value, accountNumber: number });
  const id = data.refillId || data.id || data.reference;
  if (!id) throw httpError(502, 'PayWithCAMSOL did not return a payment reference');
  return { id: String(id), state: stateOf(data.status || data.refillState), reason: data.failureReason || null, simulated: false };
}

/** Current state of a collection: { state: succeeded|failed|pending, reason }. */
async function getCollection(id) {
  if (String(id).startsWith('sim_')) return fakeStatus(id);
  const { camsol } = await settings.load();
  if (!camsol.secretKey) throw httpError(503, 'Automatic mobile money is not set up', { notConfigured: true });
  const data = await call(camsol, 'GET', `/api/v1/balance/refill/${encodeURIComponent(id)}/status`);
  return { state: stateOf(data.status || data.refillState), reason: data.failureReason || null };
}

/** Checks the keys by asking for a payment that doesn't exist: nothing is charged. */
async function checkKeys() {
  const { camsol } = await settings.load();
  if (camsol.source === 'simulated') return { result: 'simulated', message: 'No keys: payments are simulated (no money moves)' };
  if (!camsol.secretKey) return { result: 'missing', message: 'No PayWithCAMSOL secret key is set' };
  try {
    const res = await fetch(`${camsol.baseUrl}/api/v1/balance/refill/faysha-key-check-${Date.now()}/status`, { headers: { 'X-API-Key': camsol.secretKey } });
    if ([400, 404, 422].includes(res.status) || res.ok) return { result: 'ok', message: 'Connected' };
    if ([401, 403].includes(res.status)) return { result: 'refused', message: 'PayWithCAMSOL refused this key' };
    return { result: 'unreachable', message: `PayWithCAMSOL answered ${res.status}` };
  } catch {
    return { result: 'unreachable', message: 'PayWithCAMSOL could not be reached' };
  }
}

/** Python json.dumps(obj, sort_keys=True) — some senders sign that form instead of the raw bytes. */
function pythonJson(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(pythonJson).join(', ')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${pythonJson(k)}: ${pythonJson(v[k])}`).join(', ')}}`;
  if (typeof v === 'string') return JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** True when the webhook was signed with our secret. */
async function verifyWebhook(rawBody, headers) {
  const { camsol } = await settings.load();
  if (!camsol.webhookSecret) return false;
  const sent = String(headers['x-paywithcamsol-signature'] || headers['x-webhook-signature'] || headers['x-suberpay-signature'] || '').replace(/^sha256=/, '').trim().toLowerCase();
  if (!sent) return false;
  const sign = (s) => crypto.createHmac('sha256', camsol.webhookSecret).update(s).digest('hex');
  if (safeEqual(sign(rawBody), sent)) return true;
  try {
    return safeEqual(sign(pythonJson(JSON.parse(rawBody.toString('utf8')))), sent);
  } catch {
    return false;
  }
}

module.exports = { startCollection, getCollection, checkKeys, verifyWebhook, accountNumber, stateOf, pythonJson };
