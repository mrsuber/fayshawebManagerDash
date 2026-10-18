import { useState } from 'react';
import { sendContact } from '../api';
import { PageContent, Txt } from '../content';
import { CONTACT, tel } from '../data';
import { useLang } from '../i18n';

export default function Contact() {
  return (
    <PageContent pageId="contact">
      <ContactBody />
    </PageContent>
  );
}

function ContactBody() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'Booking', message: '' });
  const [state, setState] = useState({ busy: false, ok: false, error: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, error: '' });
    try {
      await sendContact(form);
      setState({ busy: false, ok: true, error: '' });
      setForm({ name: '', email: '', phone: '', subject: 'Booking', message: '' });
    } catch (err) {
      setState({ busy: false, ok: false, error: err.message });
    }
  };

  return (
    <>
      <section className="fs-container fs-page-head" style={{ paddingBottom: 56 }}>
        <Txt s="hero" k="kicker" as="p" className="fs-kicker">
          Contact
        </Txt>
        <h1 className="fs-h1">
          <Txt s="hero" k="title">We’re here for you</Txt>
        </h1>
        <Txt s="hero" k="description" as="p" className="fs-lead" multiline>
          Questions about a stay, a wellness journey or an event? Our team answers within 24 hours on business days — and the concierge line is open day and night.
        </Txt>
      </section>

      <section className="fs-container" style={{ paddingBottom: 120 }}>
        <div className="fs-split" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexBasis: 340 }}>
            {[
              ['Concierge', CONTACT.concierge, tel(CONTACT.concierge), 'Day and night'],
              ['Emergency', CONTACT.emergency, tel(CONTACT.emergency), 'For residents on site'],
              ['Email', CONTACT.email, `mailto:${CONTACT.email}`, 'Reply within 24 hours'],
              ['Location', CONTACT.location, null, 'Directions are sent with your booking'],
            ].map(([k, v, href, s]) => (
              <div key={k} className="fs-card fs-info">
                <div className="fs-info__k">{k}</div>
                <div className="fs-info__v" style={{ fontSize: 22 }}>
                  {href ? <a href={href}>{v}</a> : v}
                </div>
                <div className="fs-info__s">{s}</div>
              </div>
            ))}
          </div>

          <form className="fs-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18, flexGrow: 2 }} onSubmit={submit}>
            <h2 className="fs-h3" style={{ fontSize: 28 }}>
              <Txt s="form" k="title">Send us a message</Txt>
            </h2>
            <div className="fs-form-grid">
              <label className="fs-field">
                {t('book.name')}
                <input className="fs-input" autoComplete="name" value={form.name} onChange={set('name')} required />
              </label>
              <label className="fs-field">
                {t('book.email')}
                <input className="fs-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
              </label>
              <label className="fs-field">
                Phone
                <input className="fs-input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
              </label>
              <label className="fs-field">
                Subject
                <select className="fs-input" value={form.subject} onChange={set('subject')}>
                  {['Booking', 'Wellness journey', 'Dining & events', 'Long stay', 'Partnership', 'Other'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="fs-field">
              Message
              <textarea className="fs-input" rows={6} value={form.message} onChange={set('message')} required maxLength={5000} />
            </label>
            {state.error && <div className="fs-alert fs-alert--error" role="alert">{state.error}</div>}
            {state.ok && <div className="fs-alert fs-alert--ok" role="status">Thank you — your message is on its way. We’ll reply shortly.</div>}
            <div>
              <button type="submit" className="fs-btn fs-btn--gold" disabled={state.busy}>
                {state.busy ? t('common.sending') : t('common.send')}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
