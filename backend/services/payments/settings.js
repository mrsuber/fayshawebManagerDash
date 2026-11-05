/**
 * Payment keys, set in HQ → Settings → Payments and stored encrypted in app_settings ('payments').
 *
 *   stripe  cards:        secretKey (sk_/rk_), publishableKey (pk_, public), webhookSecret (whsec_)
 *   camsol  mobile money: secretKey (sk_), webhookSecret, baseUrl — PayWithCAMSOL (SuberPay), MTN and Orange in XAF
 *
 * Keys saved in Settings win; otherwise the server environment is used (STRIPE_*, CAMSOL_*). Without keys, and
 * outside production, mobile money runs simulated so the whole flow can be tried (no money moves).
 * New keys apply at once, without a restart (15-second cache, cleared on save).
 */
const db = require('../../config/database');
const { encrypt, decrypt, hint } = require('./secretBox');

const KEY = 'payments';
const CACHE_MS = 15000;
const DEFAULT_CAMSOL_URL = 'https://paywithcamsol.com';
let cache = null;

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function readRow() {
  const { rows } = await db.query('SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [KEY]);
  return rows[0] || { value: {}, updated_at: null, updated_by: null };
}

const modeOf = (key) => (/_live_/.test(key || '') ? 'live' : /_test_/.test(key || '') ? 'test' : null);

/** The keys in force: { stripe: {...}, camsol: {...} } with each provider's source. */
async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const row = await readRow();
  const saved = row.value || {};
  const s = saved.stripe || {};
  const c = saved.camsol || {};

  const stripeSaved = decrypt(s.secretKey);
  const stripe = stripeSaved
    ? { source: 'settings', secretKey: stripeSaved, publishableKey: s.publishableKey || null, webhookSecret: decrypt(s.webhookSecret) }
    : process.env.STRIPE_SECRET_KEY
      ? { source: 'environment', secretKey: process.env.STRIPE_SECRET_KEY, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null }
      : { source: null, secretKey: null, publishableKey: null, webhookSecret: null };

  const camsolSaved = decrypt(c.secretKey);
  const simulate = process.env.NODE_ENV !== 'production' && process.env.CAMSOL_MODE !== 'live';
  const camsol = camsolSaved
    ? { source: 'settings', secretKey: camsolSaved, webhookSecret: decrypt(c.webhookSecret), baseUrl: c.baseUrl || process.env.CAMSOL_BASE_URL || DEFAULT_CAMSOL_URL }
    : process.env.CAMSOL_SECRET_KEY
      ? { source: 'environment', secretKey: process.env.CAMSOL_SECRET_KEY, webhookSecret: process.env.CAMSOL_WEBHOOK_SECRET || null, baseUrl: process.env.CAMSOL_BASE_URL || DEFAULT_CAMSOL_URL }
      : { source: simulate ? 'simulated' : null, secretKey: null, webhookSecret: null, baseUrl: null };

  const value = { stripe, camsol, saved, updatedAt: row.updated_at, updatedBy: row.updated_by };
  cache = { at: Date.now(), value };
  return value;
}

const clean = (v) => (typeof v === 'string' ? v.replace(/[​-‍﻿]/g, '').trim().replace(/^['"]|['"]$/g, '') : '');

/**
 * Saves the keys given (blank fields keep what is saved). Body: { stripe: {secretKey, publishableKey, webhookSecret},
 * camsol: {secretKey, webhookSecret, baseUrl} }. Returns the names of the fields changed (for the audit log).
 */
async function save(body = {}, userId = null) {
  const row = await readRow();
  const next = { stripe: { ...(row.value?.stripe || {}) }, camsol: { ...(row.value?.camsol || {}) } };
  const changed = [];

  const st = body.stripe || {};
  const sk = clean(st.secretKey);
  const pk = clean(st.publishableKey);
  const wh = clean(st.webhookSecret);
  if (sk && !/^(sk|rk)_(test|live)_/.test(sk)) throw httpError(400, 'The Stripe secret key starts with sk_test_ or sk_live_ (or rk_ for a restricted key)');
  if (pk && !/^pk_(test|live)_/.test(pk)) throw httpError(400, 'The Stripe publishable key starts with pk_test_ or pk_live_');
  if (wh && !/^whsec_/.test(wh)) throw httpError(400, 'The Stripe webhook signing secret starts with whsec_');
  const skMode = modeOf(sk || decrypt(next.stripe.secretKey));
  const pkMode = modeOf(pk || next.stripe.publishableKey);
  if (skMode && pkMode && skMode !== pkMode) throw httpError(400, 'The Stripe secret and publishable keys must both be test keys or both be live keys');
  if (sk) { next.stripe.secretKey = encrypt(sk); changed.push('stripe.secretKey'); }
  if (pk) { next.stripe.publishableKey = pk; changed.push('stripe.publishableKey'); }
  if (wh) { next.stripe.webhookSecret = encrypt(wh); changed.push('stripe.webhookSecret'); }
  if ((pk || wh) && !next.stripe.secretKey) throw httpError(400, 'Add the Stripe secret key too');

  const ca = body.camsol || {};
  const ck = clean(ca.secretKey);
  const cw = clean(ca.webhookSecret);
  const cu = clean(ca.baseUrl);
  if (ck && !/^sk_(test|live)_/.test(ck)) throw httpError(400, 'The PayWithCAMSOL secret key starts with sk_test_ or sk_live_');
  if (cu && !/^(https:\/\/[^\s/]+|http:\/\/localhost(:\d+)?)(\/.*)?$/.test(cu)) throw httpError(400, 'The PayWithCAMSOL address must start with https://');
  if (ck) { next.camsol.secretKey = encrypt(ck); changed.push('camsol.secretKey'); }
  if (cw) { next.camsol.webhookSecret = encrypt(cw); changed.push('camsol.webhookSecret'); }
  if (cu) { next.camsol.baseUrl = cu.replace(/\/$/, ''); changed.push('camsol.baseUrl'); }
  if ((cw || cu) && !next.camsol.secretKey) throw httpError(400, 'Add the PayWithCAMSOL secret key too');

  if (!changed.length) throw httpError(400, 'Paste at least one key to save');
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [KEY, JSON.stringify(next), userId],
  );
  cache = null;
  return changed;
}

/** Removes the saved keys of one provider ('stripe' or 'camsol'); the environment (if any) applies again. */
async function clear(provider, userId = null) {
  if (!['stripe', 'camsol'].includes(provider)) throw httpError(400, 'Unknown provider');
  const row = await readRow();
  const next = { ...(row.value || {}) };
  delete next[provider];
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [KEY, JSON.stringify(next), userId],
  );
  cache = null;
}

const apiBase = () => (process.env.PUBLIC_API_URL || `${(process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '')}/api`).replace(/\/$/, '');

/** What HQ shows: where each provider's keys come from, test or live, what works — never the keys themselves. */
async function status() {
  const cfg = await load();
  const s = cfg.saved?.stripe || {};
  const c = cfg.saved?.camsol || {};
  return {
    updatedAt: cfg.updatedAt,
    stripe: {
      source: cfg.stripe.source,
      mode: modeOf(cfg.stripe.secretKey),
      canCharge: Boolean(cfg.stripe.secretKey),
      canShowCardForm: Boolean(cfg.stripe.publishableKey),
      verifiesWebhooks: Boolean(cfg.stripe.webhookSecret),
      publishableKey: cfg.stripe.publishableKey,
      saved: {
        secretKey: s.secretKey ? hint(decrypt(s.secretKey)) || 'unreadable' : null,
        publishableKey: s.publishableKey ? hint(s.publishableKey) : null,
        webhookSecret: s.webhookSecret ? hint(decrypt(s.webhookSecret)) || 'unreadable' : null,
      },
      webhookUrl: `${apiBase()}/payments/webhook/stripe`,
      events: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'],
    },
    camsol: {
      source: cfg.camsol.source,
      mode: cfg.camsol.source === 'simulated' ? 'simulated' : modeOf(cfg.camsol.secretKey),
      canCollect: Boolean(cfg.camsol.secretKey) || cfg.camsol.source === 'simulated',
      verifiesWebhooks: Boolean(cfg.camsol.webhookSecret),
      baseUrl: cfg.camsol.baseUrl,
      saved: {
        secretKey: c.secretKey ? hint(decrypt(c.secretKey)) || 'unreadable' : null,
        webhookSecret: c.webhookSecret ? hint(decrypt(c.webhookSecret)) || 'unreadable' : null,
        baseUrl: c.baseUrl || null,
      },
      webhookUrl: `${apiBase()}/payments/webhook/camsol`,
      events: ['payment.success', 'payment.failed'],
    },
  };
}

/** For the website and the app: which ways to pay are open, and the (public) Stripe publishable key. */
async function publicConfig() {
  const cfg = await load();
  return {
    card: cfg.stripe.secretKey && cfg.stripe.publishableKey ? { publishableKey: cfg.stripe.publishableKey } : null,
    mobileMoney: { automatic: Boolean(cfg.camsol.secretKey) || cfg.camsol.source === 'simulated', simulated: cfg.camsol.source === 'simulated' },
  };
}

const resetCache = () => {
  cache = null;
};

module.exports = { load, save, clear, status, publicConfig, resetCache };
