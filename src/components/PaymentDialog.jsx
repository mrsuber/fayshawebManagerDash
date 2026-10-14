import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentsApi } from '../api';
import config from '../config';
import { useToast } from '../context/ToastContext';

let stripePromise = null;
const getStripe = () => {
  if (!stripePromise && config.stripePublishableKey) stripePromise = loadStripe(config.stripePublishableKey);
  return stripePromise;
};

const money = (amount, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount);

function CheckoutForm({ amountLabel, onPaid, onCancel }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error: err, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setBusy(false);
    if (err) setError(err.message);
    else onPaid(paymentIntent);
  };

  return (
    <>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <PaymentElement />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={pay} disabled={!stripe || busy}>
          {t('payments.pay', { amount: amountLabel })}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Collects a card payment for a reservation with Stripe's Payment Element.
 * The backend creates the PaymentIntent (POST /payments/create-payment-intent) and should
 * confirm the booking from Stripe's `payment_intent.succeeded` webhook.
 */
export default function PaymentDialog({ reservation, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState('');
  const open = !!reservation;
  const currency = reservation?.currency || config.currency;
  const amount = reservation?.balanceDue ?? reservation?.totalAmount ?? 0;
  const enabled = !!getStripe();

  useEffect(() => {
    setClientSecret(null);
    setError('');
    if (!reservation || !enabled) return;
    paymentsApi
      .createPaymentIntent({ reservationId: reservation.id, amount: Math.round(amount * 100), currency })
      .then((r) => (r.clientSecret ? setClientSecret(r.clientSecret) : setError(t('payments.notConfigured'))))
      .catch((e) => setError(e.message));
  }, [reservation, enabled, amount, currency, t]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('payments.title')}</DialogTitle>
      {reservation && (
        <Box sx={{ px: 3, pb: 1 }}>
          <Typography color="text.secondary">{t('payments.for', { guest: reservation.guestName, residence: reservation.residence })}</Typography>
          <Typography variant="h4">{money(amount, currency)}</Typography>
        </Box>
      )}
      {!enabled || error ? (
        <>
          <DialogContent>
            <Alert severity={enabled ? 'error' : 'info'}>{error || t('payments.notConfigured')}</Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
          </DialogActions>
        </>
      ) : !clientSecret ? (
        <DialogContent sx={{ display: 'grid', placeItems: 'center', minHeight: 120 }}>
          <CircularProgress />
        </DialogContent>
      ) : (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#e8b84a' } } }}>
          <CheckoutForm
            amountLabel={money(amount, currency)}
            onCancel={onClose}
            onPaid={() => {
              toast(t('payments.success'));
              onClose();
            }}
          />
        </Elements>
      )}
    </Dialog>
  );
}
