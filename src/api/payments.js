import api from './client';
import { withMock } from './mock';

/**
 * POST /payments/create-payment-intent { reservationId, amount, currency } → { clientSecret }
 * `amount` is in the smallest currency unit (cents). The backend creates the PaymentIntent with the Stripe secret key.
 */
export const createPaymentIntent = (payload) => withMock(() => api.post('/payments/create-payment-intent', payload), { clientSecret: null });
