import { useEffect, useState } from 'react';
import { Pill, TextInput } from '../../manager/components/kit';
import { Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';
import { Loading } from '../components/parts';

const SOURCE = {
  settings: ['Keys saved here', '#3fd283'],
  environment: ['Server environment', '#5b8ff0'],
  simulated: ['Simulated — no money moves', '#b48cff'],
};
const RESULT = { ok: '#3fd283', refused: '#ff6b6b', unreachable: '#e8b84a', missing: '#8f897d', simulated: '#b48cff' };
const errorOf = (e) => e?.message || 'Something went wrong';

/**
 * HQ → Settings → Payments. The super administrator pastes the Stripe (cards) and PayWithCAMSOL (mobile money)
 * keys; they are stored encrypted and never shown again — only their last 4 characters. Finance can see the status.
 */
export default function Settings() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    hqApi.paymentSettings().then(setState).catch((e) => setError(errorOf(e)));
  }, []);

  if (error) return <section className="card"><span className="sub">{error}</span></section>;
  if (!state) return <Loading />;

  return (
    <div className="stack">
      <section className="card" style={{ gap: 8 }}>
        <span className="card-title">Payments</span>
        <p className="sub" style={{ margin: 0, lineHeight: 1.6 }}>
          Faysha takes cards through <strong>Stripe</strong> and MTN / Orange mobile money through <strong>PayWithCAMSOL</strong>. Paste the keys from
          each account below. They are stored encrypted, apply at once (no restart), and are never shown again — only their last 4 characters.
          {state.canEdit ? '' : ' Only a super administrator can change them.'}
        </p>
      </section>
      <Provider
        id="camsol"
        title="Mobile money — PayWithCAMSOL"
        icon="phone_iphone"
        lead="Guests approve the payment on their phone; the stay is confirmed automatically by the webhook and a check every 30 seconds. Without keys, staff confirm mobile money by hand."
        info={state.camsol}
        canEdit={state.canEdit}
        onChange={setState}
        checks={[
          [state.camsol.canCollect, 'Guests can pay by MTN / Orange money'],
          [state.camsol.verifiesWebhooks, 'Instant confirmation (webhook secret)'],
        ]}
        fields={[
          ['secretKey', 'Secret key', 'sk_live_… or sk_test_…'],
          ['webhookSecret', 'Webhook secret (optional)', 'From the webhook settings in PayWithCAMSOL'],
          ['baseUrl', 'API address (optional)', 'https://paywithcamsol.com', 'text'],
        ]}
      />
      <Provider
        id="stripe"
        title="Cards — Stripe"
        icon="credit_card"
        lead="Cards on the website, in the app and at the desk (FAY OS → take payment). Refunds of card payments go back through Stripe."
        info={state.stripe}
        canEdit={state.canEdit}
        onChange={setState}
        checks={[
          [state.stripe.canCharge, 'Payments can be charged (secret key)'],
          [state.stripe.canShowCardForm, 'The card form can show (publishable key)'],
          [state.stripe.verifiesWebhooks, 'Confirmed even if the guest closes the page (webhook secret)'],
        ]}
        fields={[
          ['secretKey', 'Secret key', 'sk_live_… (or a restricted rk_live_…)'],
          ['publishableKey', 'Publishable key', 'pk_live_…', 'text'],
          ['webhookSecret', 'Webhook signing secret', 'whsec_…'],
        ]}
      />
    </div>
  );
}

function Provider({ id, title, icon, lead, info, canEdit, onChange, checks, fields }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(null);
  const [copied, setCopied] = useState(false);
  const [source, sourceTone] = SOURCE[info.source] || ['Not set up', '#8f897d'];

  const runTest = async () => {
    setTest({ result: 'checking', message: 'Checking…' });
    try {
      setTest(await hqApi.testPaymentKeys(id));
    } catch (e) {
      setTest({ result: 'unreachable', message: errorOf(e) });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v && v.trim()));
    if (!Object.keys(body).length) return;
    setBusy(true);
    try {
      onChange(await hqApi.savePaymentKeys({ [id]: body }));
      setForm({});
      toast('Keys saved');
      runTest();
    } catch (err) {
      toast(errorOf(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the saved ${title} keys? Payments by this method stop unless the server environment has keys.`)) return;
    setBusy(true);
    try {
      onChange(await hqApi.clearPaymentKeys(id));
      setTest(null);
      toast('Keys removed');
    } catch (err) {
      toast(errorOf(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const savedAny = Object.values(info.saved || {}).some(Boolean);

  return (
    <section className="card" style={{ gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Icon name={icon} size={28} color="var(--gold)" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="serif" style={{ fontSize: 22 }}>{title}</span>
          <p className="sub" style={{ margin: '4px 0 0', lineHeight: 1.55 }}>{lead}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={sourceTone}>{source}</Pill>
          {info.mode && info.mode !== 'simulated' ? <Pill tone={info.mode === 'live' ? '#3fd283' : '#e8b84a'}>{info.mode === 'live' ? 'Live keys' : 'Test keys'}</Pill> : null}
        </div>
      </div>

      {info.mode === 'test' ? (
        <div className="sub" style={{ color: '#e8b84a' }}>
          <Icon name="warning" size={16} /> Test keys: no real money is collected. Use live keys before opening to guests.
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 6 }}>
        {checks.map(([ok, label]) => (
          <span key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} size={18} color={ok ? '#3fd283' : 'var(--dim)'} /> {label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="fay-btn-outline" disabled={!info.source || info.source === 'simulated' || test?.result === 'checking'} onClick={runTest}>
          <Icon name="network_check" size={18} /> Test connection
        </button>
        {test ? <span style={{ color: RESULT[test.result] || 'var(--muted)', fontSize: 14 }}>{test.message}</span> : null}
      </div>

      <div className="kit-field">
        <span className="kit-label">Webhook address — paste it in the {id === 'stripe' ? 'Stripe dashboard (Developers → Webhooks)' : 'PayWithCAMSOL webhook settings'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ padding: '8px 10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, wordBreak: 'break-all' }}>{info.webhookUrl}</code>
          <button
            type="button"
            className="fay-btn-outline"
            onClick={() => {
              navigator.clipboard?.writeText(info.webhookUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={16} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span className="sub">Events: {info.events.join(', ')}</span>
      </div>

      {canEdit ? (
        <form onSubmit={save} style={{ display: 'grid', gap: 12 }} autoComplete="off">
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {fields.map(([key, label, hint, type = 'password']) => (
              <TextInput
                key={key}
                label={label}
                type={type}
                value={form[key] || ''}
                onChange={(v) => setForm({ ...form, [key]: v })}
                placeholder={info.saved?.[key] ? (info.saved[key] === 'unreadable' ? 'Saved but unreadable — paste it again' : `Saved (${info.saved[key]}). Paste a new one to replace it`) : hint}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-gold" disabled={busy || !Object.values(form).some((v) => v && v.trim())}>
              <Icon name="lock" size={18} /> Save keys
            </button>
            {savedAny ? (
              <button type="button" className="fay-btn-outline" disabled={busy} onClick={remove}>
                <Icon name="delete" size={18} /> Remove saved keys
              </button>
            ) : null}
          </div>
          <span className="sub">Blank fields keep the key already saved. Test and live keys can’t be mixed.</span>
        </form>
      ) : (
        <span className="sub">Only a super administrator can change these keys.</span>
      )}
    </section>
  );
}
