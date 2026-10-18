import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  USE_MOCKS, confirmBooking, createBooking, createCardPayment, getAvailability, getResidences, getUnit, requestMobileMoney,
} from '../api';
import { Icon, Loading, ResidenceImage } from '../components/ui';
import { money, nightsBetween, prettyDate, stayFromParams, stayQuery } from '../format';
import { plural, useLang } from '../i18n';
import TermsBody from '../legal/TermsBody';

const STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';
let stripePromise;
const getStripe = () => {
  if (!STRIPE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_KEY);
  return stripePromise;
};

const STEPS = ['book.step1', 'book.step2', 'book.step3', 'book.step4'];

export default function Book() {
  const stripe = getStripe();
  return stripe ? (
    <Elements stripe={stripe}>
      <BookFlow cardEnabled />
    </Elements>
  ) : (
    <BookFlow cardEnabled={USE_MOCKS} />
  );
}

function BookFlow({ cardEnabled }) {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const stay = stayFromParams(params);
  const unitId = params.get('unit');
  const nights = nightsBetween(stay.checkIn, stay.checkOut);

  const [unit, setUnit] = useState(null);
  const [residence, setResidence] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '', requests: '' });
  const [terms, setTerms] = useState({ terms: false, rules: false });
  const [method, setMethod] = useState(cardEnabled ? 'card' : 'mtn');
  const [momoPhone, setMomoPhone] = useState('');
  const [booking, setBooking] = useState(null);
  const [result, setResult] = useState(null); // 'confirmed' | 'pending'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headRef = useRef(null);

  const stripe = useStripeSafe(cardEnabled && !USE_MOCKS);
  const elements = useElementsSafe(cardEnabled && !USE_MOCKS);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!unitId) throw new Error(t('book.noUnit'));
        const [u, all, avail] = await Promise.all([getUnit(unitId), getResidences(), getAvailability(stay.checkIn, stay.checkOut)]);
        if (!live) return;
        const free = avail.find((a) => String(a.id) === String(unitId));
        if (!u || !free || !free.available) throw new Error(t('book.noUnit'));
        setUnit({ ...u, price: free.price || u.price });
        setResidence(all.find((r) => String(r.id) === String(u.categoryId)) || null);
      } catch (e) {
        if (live) setLoadError(e.message);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, stay.checkIn, stay.checkOut]);

  useEffect(() => {
    headRef.current?.focus();
  }, [step]);

  const total = unit ? unit.price * nights : 0;
  const termsOk = terms.terms && terms.rules;

  const go = (n) => {
    setError('');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    if (step === 0) {
      if (!guest.name.trim() || !/^\S+@\S+\.\S+$/.test(guest.email) || guest.phone.replace(/\D/g, '').length < 8) {
        setError(t('book.missing'));
        return;
      }
      if (!momoPhone) setMomoPhone(guest.phone);
      go(1);
    } else if (step === 1 && termsOk) {
      go(2);
    }
  };

  const ensureBooking = async () => {
    if (booking) return booking;
    const b = await createBooking({
      apartment_id: Number(unit.id),
      check_in_date: stay.checkIn,
      check_out_date: stay.checkOut,
      number_of_guests: stay.guests,
      guest_name: guest.name.trim(),
      guest_email: guest.email.trim(),
      guest_phone: guest.phone.trim(),
      special_requests: guest.requests.trim() || null,
    });
    setBooking(b);
    return b;
  };

  const pay = async () => {
    setBusy(true);
    setError('');
    const acceptedAt = new Date().toISOString();
    try {
      const b = await ensureBooking();
      if (method === 'card') {
        const intent = await createCardPayment(b.id);
        if (!USE_MOCKS) {
          if (!stripe || !elements) throw new Error(t('book.cardMissing'));
          const { error: stripeError } = await stripe.confirmCardPayment(intent.client_secret, {
            payment_method: {
              card: elements.getElement(CardElement),
              billing_details: { name: guest.name, email: guest.email, phone: guest.phone },
            },
          });
          if (stripeError) throw new Error(stripeError.message);
        }
        await confirmBooking(b.id, {
          payment_intent_id: intent.payment?.stripe_payment_intent_id,
          terms_accepted: true,
          terms_accepted_at: acceptedAt,
        });
        setResult('confirmed');
      } else {
        await requestMobileMoney({ booking_id: b.id, provider: method, phone: momoPhone, terms_accepted: true, terms_accepted_at: acceptedAt });
        setResult('pending');
      }
      go(3);
    } catch (e) {
      setError(e.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="fs-container fs-section fs-container--narrow">
        <div className="fs-alert fs-alert--error" role="alert">{loadError}</div>
        <Link to={`/residences?${stayQuery(stay)}`} className="fs-btn fs-btn--ghost" style={{ marginTop: 24 }}>
          {t('book.change')}
        </Link>
      </div>
    );
  }
  if (!unit) return <Loading label={t('common.loading')} />;

  const name = residence?.name || unit.unit;

  return (
    <div className="fs-container" style={{ maxWidth: 1240, padding: '48px 32px 120px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase' }}>
          <Icon name="lock" size={14} stroke={1.6} className="fs-gold" /> {t('book.secure')}
        </span>
      </div>
      <ol className="fs-stepper-bar" aria-label="Booking steps">
        {STEPS.map((k, i) => (
          <li key={k} className={i < step ? 'done' : i === step ? 'current' : undefined} aria-current={i === step ? 'step' : undefined}>
            0{i + 1} · {t(k)}
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          {step === 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 ref={headRef} tabIndex={-1} className="fs-h1" style={{ fontSize: 44, outline: 'none' }}>{t('book.who')}</h1>
              <div className="fs-form-grid">
                <label className="fs-field">
                  {t('book.name')}
                  <input className="fs-input" autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} required />
                </label>
                <label className="fs-field">
                  {t('book.email')}
                  <input className="fs-input" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} required />
                </label>
                <label className="fs-field">
                  {t('book.phone')}
                  <input className="fs-input" type="tel" autoComplete="tel" placeholder="+237" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} required />
                </label>
              </div>
              <label className="fs-field">
                {t('book.requests')}
                <textarea className="fs-input" rows={4} placeholder={t('book.requestsPh')} value={guest.requests} onChange={(e) => setGuest({ ...guest, requests: e.target.value })} />
              </label>
            </section>
          )}

          {step === 1 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h1 ref={headRef} tabIndex={-1} className="fs-h1" style={{ fontSize: 44, outline: 'none' }}>{t('book.terms')}</h1>
              <p className="fs-muted" style={{ margin: 0, lineHeight: 1.7 }}>{t('book.termsLead')}</p>
              <div className="fs-card fs-terms-box fs-prose" tabIndex={0} aria-label={t('book.terms')}>
                <TermsBody />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="fs-check">
                  <input type="checkbox" checked={terms.terms} onChange={(e) => setTerms({ ...terms, terms: e.target.checked })} />
                  <span>
                    {t('book.accept1')} (<Link to="/terms" target="_blank">Terms</Link> · <Link to="/privacy" target="_blank">Privacy</Link>)
                  </span>
                </label>
                <label className="fs-check">
                  <input type="checkbox" checked={terms.rules} onChange={(e) => setTerms({ ...terms, rules: e.target.checked })} />
                  <span>{t('book.accept2')}</span>
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h1 ref={headRef} tabIndex={-1} className="fs-h1" style={{ fontSize: 44, outline: 'none' }}>{t('book.payment')}</h1>
              <div className="fs-chips" role="group" aria-label={t('book.payment')}>
                {[['card', 'book.card'], ['mtn', 'book.mtn'], ['orange', 'book.orange']].map(([id, key]) => (
                  <button key={id} type="button" className="fs-chip fs-chip--soft" aria-pressed={method === id} onClick={() => setMethod(id)} style={{ minHeight: 48 }}>
                    {t(key)}
                  </button>
                ))}
              </div>
              {method === 'card' ? (
                cardEnabled ? (
                  <div className="fs-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {USE_MOCKS ? (
                      <div className="fs-stripe fs-muted" style={{ fontSize: 14 }}>Sample mode: card entry is skipped.</div>
                    ) : (
                      <div className="fs-stripe">
                        <CardElement
                          options={{
                            hidePostalCode: true,
                            style: {
                              base: { color: '#ece6da', fontSize: '16px', fontFamily: 'Jost, sans-serif', '::placeholder': { color: '#5c6270' }, iconColor: '#e8b84a' },
                              invalid: { color: '#ff6b6b' },
                            },
                          }}
                        />
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('book.cardNote')}</span>
                  </div>
                ) : (
                  <div className="fs-alert">{t('book.cardMissing')}</div>
                )
              ) : (
                <div className="fs-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label className="fs-field">
                    {t('book.momoNumber')} ({method === 'mtn' ? 'MTN' : 'Orange'})
                    <input className="fs-input" type="tel" value={momoPhone} onChange={(e) => setMomoPhone(e.target.value)} placeholder="+237 6__ ___ ___" />
                  </label>
                  <span className="fs-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{t('book.momoNote')}</span>
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                  <Icon name="check" size={26} stroke={1.8} />
                </span>
                <div>
                  <h1 ref={headRef} tabIndex={-1} className="fs-h1" style={{ fontSize: 44, outline: 'none' }}>
                    {result === 'confirmed' ? t('book.ready') : t('book.pending')}
                  </h1>
                  <p className="fs-muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    {booking?.booking_number} · {result === 'confirmed' ? t('book.sentTo') : t('book.emailLater')} {guest.email}
                  </p>
                </div>
              </div>
              <div className="fs-info-grid">
                <div className="fs-key">
                  <span className="fs-info__k" style={{ margin: 0 }}>{t('book.key')}</span>
                  <span className="fs-h3" style={{ fontSize: 34, letterSpacing: 8 }} aria-hidden="true">•• •• ••</span>
                  <span className="fs-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{result === 'confirmed' ? t('book.keyNote') : t('book.keyPending')}</span>
                </div>
                <div className="fs-card fs-info">
                  <div className="fs-info__k">{t('book.box')}</div>
                  <div className="fs-info__s" style={{ marginTop: 0 }}>{t('book.boxNote')}</div>
                </div>
              </div>
              <div className="fs-card" style={{ padding: 26, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                <div style={{ maxWidth: 480 }}>
                  <div className="fs-h3">{t('book.app')}</div>
                  <p className="fs-muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6 }}>{t('book.appNote')}</p>
                </div>
                <Link to="/" className="fs-btn fs-btn--ghost">Faysha</Link>
              </div>
            </section>
          )}

          {error && (
            <div className="fs-alert fs-alert--error" role="alert" style={{ marginTop: 24 }}>
              {error}
            </div>
          )}

          {step < 3 && (
            <div className="fs-flow-nav">
              {step > 0 ? (
                <button type="button" className="fs-btn fs-btn--ghost" onClick={() => go(step - 1)} disabled={busy}>
                  {t('book.back')}
                </button>
              ) : (
                <Link to={`/residences/${unit.categoryId}?${stayQuery(stay)}`} className="fs-btn fs-btn--ghost">
                  {t('book.change')}
                </Link>
              )}
              <span className="fs-muted" style={{ fontSize: 13 }}>{step === 1 && !termsOk ? t('book.acceptBoth') : ''}</span>
              {step < 2 ? (
                <button type="button" className="fs-btn fs-btn--gold" onClick={next} disabled={step === 1 && !termsOk}>
                  {t('book.continue')}
                </button>
              ) : (
                <button type="button" className="fs-btn fs-btn--gold" onClick={pay} disabled={busy || (method === 'card' && !cardEnabled)}>
                  {busy ? t('book.working') : method === 'card' ? `${t('book.pay')} · ${money(total)} XAF` : t('book.request')}
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="fs-card" style={{ flex: '1 1 340px', maxWidth: 420, overflow: 'hidden' }} aria-label={t('book.summary')}>
          <div style={{ position: 'relative', height: 160 }}>
            <ResidenceImage src={residence?.image || unit.image} name={name} />
          </div>
          <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="fs-h3" style={{ fontSize: 26 }}>{name}</div>
              <div className="fs-muted" style={{ fontSize: 13, marginTop: 4 }}>
                {[unit.building, unit.unit && `${t('book.unit')} ${unit.unit}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, fontSize: 13 }}>
              {[
                ['bar.checkin', prettyDate(stay.checkIn, { lang })],
                ['bar.checkout', prettyDate(stay.checkOut, { lang })],
                ['bar.guests', plural(t, stay.guests, 'guest.one', 'guest.many')],
                ['book.nights', nights],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="fs-bookbar__label">{t(k)}</div>
                  <div style={{ marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              <div className="fs-sum-row">
                <span>
                  {money(unit.price)} × {plural(t, nights, 'night.one', 'night.many')}
                </span>
                <span>{money(total)}</span>
              </div>
              <div className="fs-sum-row fs-sum-total">
                <span style={{ fontWeight: 500 }}>{t('price.total')}</span>
                <span className="fs-price" style={{ fontSize: 24 }}>{money(booking?.final_price ?? total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* Stripe hooks need <Elements>; without a publishable key the page renders without it. */
function useStripeSafe(enabled) {
  return enabled ? useStripe() : null; // eslint-disable-line react-hooks/rules-of-hooks
}
function useElementsSafe(enabled) {
  return enabled ? useElements() : null; // eslint-disable-line react-hooks/rules-of-hooks
}
