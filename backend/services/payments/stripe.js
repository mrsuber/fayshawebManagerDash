/**
 * The Stripe client for the keys in force (HQ → Settings → Payments, or the environment).
 * getStripe() resolves to null when no secret key is set, so callers can answer "card payments are not available".
 */
const Stripe = require('stripe');
const settings = require('./settings');

const clients = new Map();

async function getStripe() {
  const { stripe } = await settings.load();
  if (!stripe.secretKey) return null;
  if (!clients.has(stripe.secretKey)) clients.set(stripe.secretKey, Stripe(stripe.secretKey));
  return clients.get(stripe.secretKey);
}

/** Like getStripe, but throws an error with HTTP 503 when cards are not set up. */
async function requireStripe() {
  const client = await getStripe();
  if (!client) throw Object.assign(new Error('Card payments are not available right now. Please choose mobile money.'), { status: 503 });
  return client;
}

async function webhookSecret() {
  return (await settings.load()).stripe.webhookSecret;
}

/** Checks the secret key with Stripe without charging anything. */
async function checkKeys() {
  const client = await getStripe();
  if (!client) return { result: 'missing', message: 'No Stripe secret key is set' };
  try {
    const balance = await client.balance.retrieve();
    return { result: 'ok', message: `Connected (${balance.livemode ? 'live' : 'test'} mode)` };
  } catch (e) {
    if (e.type === 'StripeAuthenticationError' || e.statusCode === 401) return { result: 'refused', message: 'Stripe refused this key' };
    if (e.type === 'StripePermissionError' || e.statusCode === 403) return { result: 'ok', message: 'Connected (restricted key)' };
    return { result: 'unreachable', message: e.message || 'Stripe could not be reached' };
  }
}

module.exports = { getStripe, requireStripe, webhookSecret, checkKeys };
