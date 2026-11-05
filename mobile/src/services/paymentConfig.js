import { initStripe } from '@stripe/stripe-react-native';
import apiClient from './api';
import { STRIPE_PUBLISHABLE_KEY } from '../config';

/**
 * Ways to pay that are open, and the public Stripe key — set in HQ → Settings → Payments and read from the server
 * (GET /api/payments/config). The key built into the app is only a fallback.
 */
let cached = null;

export async function getPaymentConfig() {
  if (cached && Date.now() - cached.at < 60000) return cached.value;
  try {
    const data = await apiClient.get('/payments/config');
    const value = { publishableKey: data.card?.publishableKey || STRIPE_PUBLISHABLE_KEY || '', momoAutomatic: Boolean(data.mobileMoney?.automatic) };
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return { publishableKey: STRIPE_PUBLISHABLE_KEY || '', momoAutomatic: false };
  }
}

let initialisedWith = STRIPE_PUBLISHABLE_KEY || null;

/** Points the Stripe SDK at the server's publishable key before a card payment. */
export async function applyStripeKey(publishableKey) {
  if (!publishableKey || publishableKey === initialisedWith) return;
  await initStripe({ publishableKey, urlScheme: 'faysha', merchantIdentifier: 'merchant.com.fayshaa.app' });
  initialisedWith = publishableKey;
}
