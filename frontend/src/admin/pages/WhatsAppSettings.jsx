import { useEffect, useState } from 'react';
import { Pill, TextInput } from '../../manager/components/kit';
import { Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';

const RESULT = { ok: '#3fd283', refused: '#ff6b6b', unreachable: '#e8b84a', missing: '#8f897d' };
const errorOf = (e) => e?.message || 'Something went wrong';

/**
 * HQ → Settings → WhatsApp: connects the Meta WhatsApp Business account (Cloud API). The super administrator pastes the
 * phone number ID, a permanent access token and the app secret (stored encrypted, never shown again), copies the
 * webhook address and verify token into Meta, and can set the template used for the stay pass.
 */
export default function WhatsAppSettings() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const [tpl, setTpl] = useState({ name: '', language: 'en' });
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [copied, setCopied] = useState('');

  const runCheck = () => {
    setCheck({ result: 'checking', message: 'Checking…' });
    hqApi.checkWhatsapp().then(setCheck).catch((e) => setCheck({ result: 'unreachable', message: errorOf(e) }));
  };
  useEffect(() => {
    hqApi
      .whatsappSettings()
      .then((s) => {
        setInfo(s);
        setTpl({ name: s.stayPassTemplate?.name || '', language: s.stayPassTemplate?.language || 'en' });
        if (s.ready) hqApi.checkWhatsapp().then(setCheck).catch(() => {});
      })
      .catch((e) => setError(errorOf(e)));
  }, []);

  if (error) return <section className="card"><span className="sub">{error}</span></section>;
  if (!info) return null;

  const saveBody = async (body, okText) => {
    setBusy(true);
    try {
      const s = await hqApi.saveWhatsapp(body);
      setInfo(s);
      setForm({});
      toast(okText);
      if (s.ready) runCheck();
    } catch (e) {
      toast(errorOf(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = (k, v) => {
    navigator.clipboard?.writeText(v);
    setCopied(k);
    setTimeout(() => setCopied(''), 1500);
  };
  const codeBox = (k, label, value) => (
    <div className="kit-field">
      <span className="kit-label">{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ padding: '8px 10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, wordBreak: 'break-all' }}>{value}</code>
        <button type="button" className="fay-btn-outline" onClick={() => copy(k, value)}>
          <Icon name={copied === k ? 'check' : 'content_copy'} size={16} /> {copied === k ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
  const fields = [
    ['phoneNumberId', 'Phone number ID', info.phoneNumberId ? `Saved (${info.phoneNumberId}). Paste another to replace it` : 'Meta → WhatsApp → API setup → Phone number ID', 'text'],
    ['accessToken', 'Permanent access token', info.saved.accessToken ? (info.saved.accessToken === 'unreadable' ? 'Saved but unreadable — paste it again' : `Saved (${info.saved.accessToken}). Paste a new one to replace it`) : 'System user token with whatsapp_business_messaging'],
    ['appSecret', 'App secret (checks the webhook)', info.saved.appSecret ? `Saved (${info.saved.appSecret})` : 'Meta app → App settings → Basic → App secret'],
    ['businessAccountId', 'WhatsApp Business Account ID (optional)', info.businessAccountId || 'Meta → WhatsApp → API setup', 'text'],
  ];

  return (
    <section className="card" style={{ gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Icon name="chat" size={28} color="#25d366" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="serif" style={{ fontSize: 22 }}>WhatsApp Business</span>
          <p className="sub" style={{ margin: '4px 0 0', lineHeight: 1.55 }}>
            Messages from FAY OS → Communications on the WhatsApp channel reach the guest’s WhatsApp, their replies come back into the same conversation,
            and the stay pass PDF is sent from your business number. Uses Meta’s WhatsApp Cloud API.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill tone={info.ready ? '#3fd283' : '#8f897d'}>{info.ready ? (info.enabled ? 'Connected' : 'Paused') : 'Not set up'}</Pill>
          {info.ready && !info.verifiesWebhooks ? <Pill tone="#e8b84a">Webhook not verified</Pill> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {[
          [info.ready, 'Messages can be sent (phone number ID + access token)'],
          [info.verifiesWebhooks, 'Replies are accepted only from Meta (app secret)'],
          [Boolean(info.stayPassTemplate?.name), 'Stay pass can be sent any time (approved template)'],
        ].map(([ok, label]) => (
          <span key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} size={18} color={ok ? '#3fd283' : 'var(--dim)'} /> {label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="fay-btn-outline" disabled={!info.ready || check?.result === 'checking'} onClick={runCheck}>
          <Icon name="network_check" size={18} /> Test connection
        </button>
        {check ? <span style={{ color: RESULT[check.result] || 'var(--muted)', fontSize: 14 }}>{check.message}</span> : null}
      </div>

      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--gold)', fontSize: 14 }}>How to connect (5 minutes in Meta)</summary>
        <ol className="sub" style={{ lineHeight: 1.8, margin: '8px 0 0', paddingLeft: 20 }}>
          <li>In <strong>developers.facebook.com</strong> → your app → <strong>WhatsApp → API setup</strong>: copy the <strong>Phone number ID</strong> of your business number.</li>
          <li>In <strong>business.facebook.com</strong> → Settings → <strong>System users</strong>: create (or open) a system user, give it your app and WhatsApp account, and <strong>Generate token</strong> with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>, expiry “Never”. Paste it below.</li>
          <li>App → <strong>App settings → Basic</strong>: copy the <strong>App secret</strong>.</li>
          <li>Save, then in the app → <strong>WhatsApp → Configuration → Webhook</strong>: paste the <strong>Callback URL</strong> and <strong>Verify token</strong> below, click Verify and save, then <strong>subscribe to “messages”</strong>.</li>
          <li>Send yourself the test below. For the stay pass outside the 24-hour window, create the template in WhatsApp Manager (see the end of this card).</li>
        </ol>
      </details>

      {codeBox('url', 'Callback URL — paste in Meta → WhatsApp → Configuration → Webhook', info.webhookUrl)}
      {codeBox('token', 'Verify token — paste next to it', info.verifyToken)}
      <span className="sub">Webhook field to subscribe: {info.fields.join(', ')}</span>

      {info.canEdit ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v && String(v).trim()));
              if (Object.keys(body).length) saveBody(body, 'WhatsApp settings saved');
            }}
            style={{ display: 'grid', gap: 12 }}
            autoComplete="off"
          >
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {fields.map(([key, label, hint, type = 'password']) => (
                <TextInput key={key} label={label} type={type} value={form[key] || ''} onChange={(v) => setForm({ ...form, [key]: v })} placeholder={hint} />
              ))}
              <TextInput label="Default country code" value={form.defaultCountryCode ?? ''} onChange={(v) => setForm({ ...form, defaultCountryCode: v })} placeholder={`${info.defaultCountryCode} — for numbers saved without +`} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="btn-gold" disabled={busy || !Object.values(form).some((v) => v && String(v).trim())}>
                <Icon name="lock" size={18} /> Save
              </button>
              {info.ready ? (
                <button type="button" className="fay-btn-outline" disabled={busy} onClick={() => saveBody({ enabled: !info.enabled }, info.enabled ? 'WhatsApp paused' : 'WhatsApp on')}>
                  <Icon name={info.enabled ? 'pause' : 'play_arrow'} size={18} /> {info.enabled ? 'Pause sending' : 'Resume sending'}
                </button>
              ) : null}
              {info.saved.accessToken || info.phoneNumberId ? (
                <button
                  type="button"
                  className="fay-btn-outline"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm('Disconnect WhatsApp? Sending stops until the keys are pasted again (the webhook address and verify token stay the same).')) return;
                    try {
                      setInfo(await hqApi.clearWhatsapp());
                      setCheck(null);
                      toast('WhatsApp disconnected');
                    } catch (e) {
                      toast(errorOf(e), 'error');
                    }
                  }}
                >
                  <Icon name="link_off" size={18} /> Disconnect
                </button>
              ) : null}
            </div>
            <span className="sub">Blank fields keep what is saved. The token and app secret are stored encrypted and never shown again.</span>
          </form>

          {info.ready ? (
            <div className="kit-field">
              <span className="kit-label">Send a test (Meta’s “hello_world” template) to a WhatsApp number</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="kit-input" style={{ padding: '8px 10px', minWidth: 220 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+237 6XX XX XX XX" aria-label="Test number" />
                <button
                  type="button"
                  className="fay-btn-outline"
                  disabled={!testTo.trim() || busy}
                  onClick={() => hqApi.testWhatsapp(testTo).then((r) => toast(r.message)).catch((e) => toast(errorOf(e), 'error'))}
                >
                  <Icon name="send" size={16} /> Send test
                </button>
              </div>
              <span className="sub">While your Meta app is in development mode, add the number under “To” in API setup first.</span>
            </div>
          ) : null}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 10 }}>
            <span className="serif" style={{ fontSize: 18 }}>Stay pass template</span>
            <span className="sub" style={{ lineHeight: 1.6 }}>
              Meta lets a business write freely only within 24 hours of the guest’s last WhatsApp message. To send the stay pass at any time, create a
              <strong> Utility</strong> template in WhatsApp Manager with a <strong>Document</strong> header and a body with three variables, e.g.:
              <br />
              <em>“Hello {'{{1}}'}, your Faysha stay {'{{2}}'} is confirmed ({'{{3}}'}). Your stay pass with your gate QR code and door PIN is attached. Please keep it private.”</em>
              <br />({'{{1}}'} guest name, {'{{2}}'} booking number, {'{{3}}'} dates). Once Meta approves it, enter its name and language here.
            </span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <TextInput label="Template name" value={tpl.name} onChange={(v) => setTpl({ ...tpl, name: v.toLowerCase() })} placeholder="stay_pass" />
              <TextInput label="Language code" value={tpl.language} onChange={(v) => setTpl({ ...tpl, language: v })} placeholder="en, en_US, fr" />
              <button type="button" className="fay-btn-outline" disabled={busy} onClick={() => saveBody({ stayPassTemplate: tpl.name ? tpl : null }, tpl.name ? 'Template saved' : 'Template removed')}>
                Save template
              </button>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={info.autoSendStayPass} disabled={busy || !info.ready} onChange={(e) => saveBody({ autoSendStayPass: e.target.checked }, e.target.checked ? 'The stay pass is sent on WhatsApp at each confirmation' : 'Automatic sending off')} />
              Send the stay pass on WhatsApp automatically when a booking is confirmed (needs the template)
            </label>
          </div>
        </>
      ) : (
        <span className="sub">Only a super administrator can change the WhatsApp settings.</span>
      )}
    </section>
  );
}
