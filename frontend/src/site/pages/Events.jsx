import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { eventDeposit, getEventQuote, getStories, respondToEventQuote, sendEventRequest } from '../api';
import { Loading } from '../components/ui';
import { IMG } from '../data';
import { useLang } from '../i18n';

const TYPES = ['wedding', 'engagement', 'birthday', 'anniversary', 'corporate', 'conference', 'retreat', 'private_dinner', 'other'];
const SPACES = ['garden', 'pool_deck', 'restaurant', 'sky_deck', 'lounge', 'wellness_club', 'whole_estate'];
const SERVICES = ['decor', 'flowers', 'sound', 'lighting', 'photo', 'video', 'cake', 'officiant', 'transport', 'security', 'wellness', 'kids'];
const STYLES = ['plated', 'buffet', 'cocktail', 'family', 'bbq'];
const STEPS = ['events.step1', 'events.step2', 'events.step3', 'events.step4'];
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n, cur) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'XAF', maximumFractionDigits: ['XAF', 'XOF'].includes(cur) ? 0 : 2 }).format(n || 0);
  } catch {
    return `${Math.round(n || 0).toLocaleString()} ${cur}`;
  }
};

const blank = {
  eventType: '', title: '', eventDate: '', flexibleDates: false, altDate: '', startTime: '', endTime: '', guests: 50,
  spaces: [], catering: 'faysha', cateringStyle: '', dietary: '', services: [], roomsNeeded: 0,
  budgetMin: '', budgetMax: '', currency: 'XAF', name: '', email: '', phone: '', organisation: '', message: '', heardFrom: '', website: '',
};

function Chips({ options, value, onChange, multi = false, label }) {
  const { t } = useLang();
  const on = (o) => (multi ? value.includes(o) : value === o);
  const toggle = (o) => onChange(multi ? (value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : o);
  return (
    <div className="fs-filters" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="fs-chip" aria-pressed={on(o)} onClick={() => toggle(o)}>
          {t(`events.${o}`)}
        </button>
      ))}
    </div>
  );
}

/** /events — hosting at Faysha, and the request form. Prices follow an assessment of each brief. */
export default function Events() {
  const { t } = useLang();
  const [stories, setStories] = useState([]);
  useEffect(() => {
    getStories().then((s) => setStories(s.filter((x) => x.category !== 'news').slice(0, 3))).catch(() => {});
  }, []);
  return (
    <>
      <section className="fs-band-img" style={{ minHeight: '78vh' }}>
        <img className="fs-hero__img" src={IMG.sunset} alt="" />
        <div className="fs-band-img__shade" />
        <div className="fs-container" style={{ position: 'relative', paddingTop: 160, paddingBottom: 96 }}>
          <p className="fs-kicker">{t('events.kicker')}</p>
          <h1 className="fs-h1" style={{ maxWidth: 820 }}>{t('events.title')}</h1>
          <p className="fs-lead" style={{ maxWidth: 640 }}>{t('events.lead')}</p>
          <a href="#plan" className="fs-btn fs-btn--gold" style={{ marginTop: 28 }}>{t('events.cta')}</a>
        </div>
      </section>

      <section className="fs-container fs-section">
        <div className="fs-split" style={{ alignItems: 'flex-start' }}>
          <div style={{ flexBasis: 360 }}>
            <p className="fs-kicker">{t('events.howKicker')}</p>
            <h2 className="fs-h2">{t('events.howTitle')}</h2>
            <p className="fs-muted" style={{ lineHeight: 1.8 }}>{t('events.howLead')}</p>
          </div>
          <ol className="fs-steps" style={{ flexGrow: 2 }}>
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>
                <span className="fs-steps__n">0{n}</span>
                <div>
                  <h3 className="fs-h3" style={{ margin: '0 0 8px' }}>{t(`events.how${n}`)}</h3>
                  <p className="fs-muted" style={{ margin: 0, lineHeight: 1.7 }}>{t(`events.how${n}d`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="plan" className="fs-band">
        <div className="fs-container fs-section">
          <PlanForm />
        </div>
      </section>

      {stories.length ? (
        <section className="fs-container fs-section">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
            <div>
              <p className="fs-kicker">{t('stories.kicker')}</p>
              <h2 className="fs-h2">{t('events.storiesTitle')}</h2>
            </div>
            <Link to="/stories" className="fs-btn fs-btn--ghost">{t('stories.all')} →</Link>
          </div>
          <div className="fs-story-grid">
            {stories.map((s) => (
              <Link key={s.slug} to={`/stories/${s.slug}`} className="fs-story-card">
                <div className="fs-story-card__img">{s.cover ? <img src={s.cover} alt="" loading="lazy" /> : null}</div>
                <div className="fs-story-card__body">
                  <h3 className="fs-h3">{s.title}</h3>
                  {s.excerpt ? <p className="fs-muted" style={{ margin: 0 }}>{s.excerpt}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function PlanForm() {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [v, setV] = useState(blank);
  const [state, setState] = useState({ busy: false, error: '', done: null });
  const top = useRef(null);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val && val.target ? (val.target.type === 'checkbox' ? val.target.checked : val.target.value) : val }));

  const problem = () => {
    if (step === 0 && !v.eventType) return t('events.errType');
    if (step === 0 && !v.flexibleDates && !v.eventDate) return t('events.errDate');
    if (step === 0 && !(Number(v.guests) > 0)) return t('events.errGuests');
    if (step === 3 && (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))) return t('events.errContact');
    return '';
  };
  const go = (n) => {
    const p = n > step ? problem() : '';
    setState((s) => ({ ...s, error: p }));
    if (p) return;
    setStep(n);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const submit = async () => {
    const p = problem();
    if (p) return setState((s) => ({ ...s, error: p }));
    setState({ busy: true, error: '', done: null });
    try {
      const r = await sendEventRequest({ ...v, guests: Number(v.guests), roomsNeeded: Number(v.roomsNeeded) || 0 });
      setState({ busy: false, error: '', done: r.reference });
    } catch (e) {
      setState({ busy: false, error: e.message, done: null });
    }
  };

  if (state.done) {
    return (
      <div className="fs-card" style={{ padding: 'clamp(28px, 5vw, 64px)', textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <p className="fs-kicker">{state.done}</p>
        <h2 className="fs-h2">{t('events.thanksTitle')}</h2>
        <p className="fs-lead" style={{ margin: '0 auto' }}>{t('events.thanksLead')}</p>
      </div>
    );
  }

  return (
    <div ref={top} style={{ maxWidth: 920, margin: '0 auto', scrollMarginTop: 120 }}>
      <p className="fs-kicker">{t('events.formKicker')}</p>
      <h2 className="fs-h2" style={{ marginBottom: 32 }}>{t('events.formTitle')}</h2>
      <ol className="fs-stepper-bar" aria-label={t('events.formTitle')}>
        {STEPS.map((k, i) => (
          <li key={k} className={i < step ? 'done' : i === step ? 'current' : undefined} aria-current={i === step ? 'step' : undefined}>
            0{i + 1} · {t(k)}
          </li>
        ))}
      </ol>
      <div className="fs-card" style={{ padding: 'clamp(22px, 4vw, 48px)', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <input type="text" name="website" value={v.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        {step === 0 && (
          <>
            <div className="fs-field">{t('events.qType')}<Chips options={TYPES} value={v.eventType} onChange={set('eventType')} label={t('events.qType')} /></div>
            <div className="fs-form-grid">
              <label className="fs-field">{t('events.qDate')}<input className="fs-input" type="date" min={today()} value={v.eventDate} onChange={set('eventDate')} disabled={v.flexibleDates} /></label>
              <label className="fs-field">{t('events.qAlt')}<input className="fs-input" type="date" min={today()} value={v.altDate} onChange={set('altDate')} /></label>
              <label className="fs-field">{t('events.qGuests')}<input className="fs-input" type="number" min="1" max="5000" value={v.guests} onChange={set('guests')} /></label>
              <label className="fs-field">{t('events.qStart')}<input className="fs-input" type="time" value={v.startTime} onChange={set('startTime')} /></label>
              <label className="fs-field">{t('events.qEnd')}<input className="fs-input" type="time" value={v.endTime} onChange={set('endTime')} /></label>
            </div>
            <label className="fs-check"><input type="checkbox" checked={v.flexibleDates} onChange={set('flexibleDates')} /><span>{t('events.qFlexible')}</span></label>
          </>
        )}
        {step === 1 && (
          <>
            <div className="fs-field">{t('events.qSpaces')}<Chips multi options={SPACES} value={v.spaces} onChange={set('spaces')} label={t('events.qSpaces')} /></div>
            <div className="fs-field">{t('events.qCatering')}<Chips options={['faysha', 'external', 'none']} value={v.catering} onChange={set('catering')} label={t('events.qCatering')} /></div>
            {v.catering === 'faysha' ? (
              <>
                <div className="fs-field">{t('events.qStyle')}<Chips options={STYLES} value={v.cateringStyle} onChange={set('cateringStyle')} label={t('events.qStyle')} /></div>
                <label className="fs-field">{t('events.qDietary')}<textarea className="fs-input" rows={2} value={v.dietary} onChange={set('dietary')} placeholder={t('events.qDietaryPh')} /></label>
              </>
            ) : null}
          </>
        )}
        {step === 2 && (
          <>
            <div className="fs-field">{t('events.qServices')}<Chips multi options={SERVICES} value={v.services} onChange={set('services')} label={t('events.qServices')} /></div>
            <div className="fs-form-grid">
              <label className="fs-field">{t('events.qRooms')}<input className="fs-input" type="number" min="0" value={v.roomsNeeded} onChange={set('roomsNeeded')} /></label>
              <label className="fs-field">{t('events.qBudgetMin')}<input className="fs-input" type="number" min="0" value={v.budgetMin} onChange={set('budgetMin')} /></label>
              <label className="fs-field">{t('events.qBudgetMax')}<input className="fs-input" type="number" min="0" value={v.budgetMax} onChange={set('budgetMax')} /></label>
              <label className="fs-field">{t('events.qCurrency')}
                <select className="fs-input" value={v.currency} onChange={set('currency')}>
                  {['XAF', 'EUR', 'USD', 'GBP', 'NGN', 'XOF'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label className="fs-field">{t('events.qVision')}<textarea className="fs-input" rows={5} value={v.message} onChange={set('message')} placeholder={t('events.qVisionPh')} /></label>
          </>
        )}
        {step === 3 && (
          <div className="fs-form-grid">
            <label className="fs-field">{t('book.name')}<input className="fs-input" autoComplete="name" value={v.name} onChange={set('name')} /></label>
            <label className="fs-field">{t('book.email')}<input className="fs-input" type="email" autoComplete="email" value={v.email} onChange={set('email')} /></label>
            <label className="fs-field">{t('book.phone')}<input className="fs-input" type="tel" autoComplete="tel" placeholder="+237" value={v.phone} onChange={set('phone')} /></label>
            <label className="fs-field">{t('events.qOrg')}<input className="fs-input" value={v.organisation} onChange={set('organisation')} /></label>
            <label className="fs-field">{t('events.qHeard')}<input className="fs-input" value={v.heardFrom} onChange={set('heardFrom')} /></label>
          </div>
        )}
        {state.error ? <div className="fs-alert fs-alert--error" role="alert">{state.error}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {step > 0 ? <button type="button" className="fs-btn fs-btn--ghost" onClick={() => go(step - 1)}>← {t('common.back')}</button> : <span />}
          {step < 3 ? (
            <button type="button" className="fs-btn fs-btn--gold" onClick={() => go(step + 1)}>{t('common.continue')} →</button>
          ) : (
            <button type="button" className="fs-btn fs-btn--gold" onClick={submit} disabled={state.busy}>{state.busy ? t('common.sending') : t('events.send')}</button>
          )}
        </div>
      </div>
      <p className="fs-muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>{t('events.pricingNote')}</p>
    </div>
  );
}

/** /events/quote/:token — the client reads the proposal and accepts or declines it. */
export function EventQuote() {
  const { token } = useParams();
  const { t } = useLang();
  const [d, setD] = useState(undefined);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => getEventQuote(token).then(setD).catch((e) => { setError(e.message); setD(null); });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const respond = async (decision) => {
    setBusy(true);
    setError('');
    try {
      await respondToEventQuote(token, { decision, name, note });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (d === undefined) return <Loading label={t('common.loading')} />;
  if (d === null) return <div className="fs-container fs-section fs-empty"><p>{error}</p><Link to="/contact" className="fs-btn fs-btn--ghost">{t('nav.contact')}</Link></div>;
  const q = d.quote;
  return (
    <section className="fs-container fs-container--narrow fs-page-head" style={{ paddingBottom: 120 }}>
      <p className="fs-kicker">{d.reference} · {t('events.proposal')} v{q.version}</p>
      <h1 className="fs-h1">{d.title || `${d.typeLabel} · ${d.guests} ${t('stories.guests')}`}</h1>
      <p className="fs-lead">{t('events.proposalFor', { name: d.name })}{d.eventDate ? ` · ${new Date(`${d.eventDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</p>
      <div className="fs-card" style={{ padding: 'clamp(22px, 4vw, 44px)', marginTop: 32 }}>
        <table className="fs-quote">
          <tbody>
            {q.items.map((it, i) => (
              <tr key={i}>
                <td>
                  {it.label}
                  {it.detail ? <div className="fs-muted" style={{ fontSize: 13, marginTop: 4 }}>{it.detail}</div> : null}
                </td>
                <td className="fs-quote__qty">{it.qty !== 1 ? `${it.qty}${it.unit ? ` ${it.unit}` : ''} × ${fmt(it.unitPrice, q.currency)}` : ''}</td>
                <td className="fs-quote__amt">{fmt(it.qty * it.unitPrice, q.currency)}</td>
              </tr>
            ))}
            {q.discount ? <tr><td>{t('events.discount')}</td><td /><td className="fs-quote__amt">− {fmt(q.discount, q.currency)}</td></tr> : null}
            {q.tax ? <tr><td>{t('events.tax')} ({q.taxRate}%)</td><td /><td className="fs-quote__amt">{fmt(q.tax, q.currency)}</td></tr> : null}
            <tr className="fs-quote__total"><td>{t('events.total')}</td><td /><td className="fs-quote__amt">{fmt(q.total, q.currency)}</td></tr>
            <tr><td>{t('events.deposit')} ({q.depositPercent}%)</td><td /><td className="fs-quote__amt">{fmt(q.depositAmount, q.currency)}</td></tr>
          </tbody>
        </table>
        {q.notes ? <p className="fs-muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, marginTop: 28 }}>{q.notes}</p> : null}
        {q.validUntil && q.status === 'sent' ? <p className="fs-muted" style={{ fontSize: 13 }}>{t('events.validUntil')} {q.validUntil}</p> : null}
      </div>
      {q.status === 'sent' ? (
        <div className="fs-card" style={{ padding: 'clamp(22px, 4vw, 44px)', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label className="fs-field">{t('events.signName')}<input className="fs-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="fs-field">{t('events.noteToUs')}<textarea className="fs-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {error ? <div className="fs-alert fs-alert--error" role="alert">{error}</div> : null}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="fs-btn fs-btn--ghost" disabled={busy} onClick={() => respond('decline')}>{t('events.decline')}</button>
            <button type="button" className="fs-btn fs-btn--gold" disabled={busy || !name.trim()} onClick={() => respond('accept')}>{t('events.accept')}</button>
          </div>
          <p className="fs-muted" style={{ fontSize: 13, margin: 0 }}>{t('events.acceptNote')}</p>
        </div>
      ) : (
        <div className={`fs-alert ${q.status === 'accepted' ? 'fs-alert--ok' : ''}`} style={{ marginTop: 20 }}>{t(`events.state_${q.status}`)}</div>
      )}
      {q.status === 'accepted' ? <DepositPay token={token} /> : null}
    </section>
  );
}

const stripeLoads = {};
const stripeFor = (key) => (key ? (stripeLoads[key] = stripeLoads[key] || loadStripe(key)) : null);

/** Pay the deposit of an accepted proposal: card (Stripe) or MTN / Orange money; the event is confirmed at once. */
function DepositPay({ token }) {
  const { t } = useLang();
  const [info, setInfo] = useState(null);
  const load = () => eventDeposit.get(token).then(setInfo).catch(() => setInfo(false));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (!info) return null;
  if (!(info.due > 0)) {
    return info.paid > 0 ? <div className="fs-alert fs-alert--ok" style={{ marginTop: 20 }}>{t('events.depositPaid')} {fmt(info.paid, info.currency)}</div> : null;
  }
  if (!info.card && !info.mobileMoney?.automatic) return <p className="fs-muted" style={{ marginTop: 20 }}>{t('events.depositOffline')}</p>;
  return (
    <Elements stripe={info.card ? stripeFor(info.card.publishableKey) : null}>
      <DepositForm token={token} info={info} onPaid={load} />
    </Elements>
  );
}

function DepositForm({ token, info, onPaid }) {
  const { t } = useLang();
  const stripe = useStripe();
  const elements = useElements();
  const methods = [...(info.card ? [['card', t('book.card')]] : []), ...(info.mobileMoney?.automatic ? [['mtn', t('book.mtn')], ['orange', t('book.orange')]] : [])];
  const [method, setMethod] = useState(methods[0][0]);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(async () => {
      try {
        const r = await eventDeposit.status(token, waiting);
        if (r.status === 'completed') {
          setWaiting(null);
          onPaid();
        } else if (r.status === 'failed') {
          setWaiting(null);
          setError(r.message || t('book.momoDeclined'));
        }
      } catch {
        // keep waiting
      }
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      if (method === 'card') {
        if (!stripe || !elements) throw new Error(t('book.cardMissing'));
        const intent = await eventDeposit.startCard(token);
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intent.client_secret, { payment_method: { card: elements.getElement(CardElement) } });
        if (stripeError) throw new Error(stripeError.message);
        await eventDeposit.confirmCard(token, paymentIntent.id);
        onPaid();
      } else {
        const r = await eventDeposit.startMobileMoney(token, { provider: method, phone });
        setWaiting(r.payment_id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fs-card" style={{ padding: 'clamp(22px, 4vw, 44px)', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 className="fs-h3" style={{ margin: 0 }}>{t('events.payDeposit')} · {fmt(info.due, info.currency)}</h2>
      {waiting ? (
        <div className="fs-alert" role="status">{t('book.approve')} — {t('book.approveNote')}</div>
      ) : (
        <>
          <div className="fs-chips" role="group" aria-label={t('book.payment')}>
            {methods.map(([id, label]) => (
              <button key={id} type="button" className="fs-chip fs-chip--soft" aria-pressed={method === id} onClick={() => setMethod(id)} style={{ minHeight: 48 }}>{label}</button>
            ))}
          </div>
          {method === 'card' ? (
            <div className="fs-stripe">
              <CardElement options={{ hidePostalCode: true, style: { base: { color: '#ece6da', fontSize: '16px', fontFamily: 'Jost, sans-serif', '::placeholder': { color: '#5c6270' }, iconColor: '#e8b84a' }, invalid: { color: '#ff6b6b' } } }} />
            </div>
          ) : (
            <label className="fs-field">
              {t('book.momoNumber')} ({method === 'mtn' ? 'MTN' : 'Orange'})
              <input className="fs-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6__ ___ ___" />
            </label>
          )}
          {error ? <div className="fs-alert fs-alert--error" role="alert">{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="fs-btn fs-btn--gold" disabled={busy || (method !== 'card' && phone.replace(/\D/g, '').length < 8)} onClick={pay}>
              {busy ? t('book.working') : method === 'card' ? `${t('book.pay')} · ${fmt(info.due, info.currency)}` : t('book.request')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
