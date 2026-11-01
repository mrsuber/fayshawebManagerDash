/**
 * Currencies. Every price is stored in the property's base currency (XAF). Guests can see prices in another
 * currency and pay by card in it; the rate used is recorded with the payment.
 *
 * Rates are "base units per 1 unit of the currency" (e.g. EUR: 655.957 means €1 = 655.957 XAF).
 * XAF and XOF are pegged to the euro at 655.957 (CFA franc), so EUR and XOF never drift and cannot be edited.
 */
const db = require('../config/database');
const { decimalsOf } = require('../utils/money');

const PEGGED = { XAF: 1, XOF: 1, EUR: 655.957 };
const DEFAULTS = {
  base: 'XAF',
  accepted: ['XAF', 'EUR', 'USD', 'GBP'],
  rates: { ...PEGGED, USD: 600, GBP: 765, NGN: 0.38, CAD: 440, CHF: 690, AED: 163, ZAR: 33, GHS: 40 },
  updatedAt: null,
};
// Currencies Stripe can charge cards in for this account (presentment); mobile money is XAF only.
const CARD_CURRENCIES = ['XAF', 'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AED', 'ZAR', 'NGN', 'GHS', 'XOF'];

async function settings() {
  const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'currencies'`);
  const v = rows[0]?.value || {};
  return { ...DEFAULTS, ...v, rates: { ...DEFAULTS.rates, ...(v.rates || {}), ...PEGGED } };
}

/** Converts an amount in the base currency to `currency` (rounded to that currency's precision). */
function fromBase(amount, currency, rates) {
  const rate = rates[currency];
  if (!rate) throw Object.assign(new Error(`No exchange rate for ${currency}`), { status: 400 });
  const dp = decimalsOf(currency);
  return Number((Number(amount) / rate).toFixed(dp));
}

/** Stripe's integer amount (minor units, except zero-decimal currencies). */
const toStripeAmount = (amount, currency) => Math.round(Number(amount) * 10 ** decimalsOf(currency));

module.exports = { settings, fromBase, toStripeAmount, PEGGED, CARD_CURRENCIES, DEFAULTS };
