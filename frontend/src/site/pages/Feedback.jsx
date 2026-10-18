import { useState } from 'react';
import { submitFeedback } from '../api';
import { PageContent, Txt } from '../content';
import { useLang } from '../i18n';

const TYPES = [
  ['testimonial', 'Testimonial'],
  ['general', 'General feedback'],
  ['suggestion', 'Suggestion'],
  ['complaint', 'Complaint'],
];
const EMPTY = {
  name: '', email: '', phone: '', feedbackType: 'general', rating: 5, testimonialText: '', role: '', allowPublicDisplay: false,
  whatWentWell: '', areasForImprovement: '', additionalComments: '',
};

export default function Feedback() {
  return (
    <PageContent pageId="feedback">
      <FeedbackBody />
    </PageContent>
  );
}

function FeedbackBody() {
  const { t } = useLang();
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [state, setState] = useState({ busy: false, ok: '', error: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: '', error: '' });
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, String(v)));
    if (photo) data.append('profileImage', photo);
    try {
      const res = await submitFeedback(data);
      setState({ busy: false, ok: res.message || 'Thank you for your feedback! We will review it shortly.', error: '' });
      setForm(EMPTY);
      setPhoto(null);
    } catch (err) {
      setState({ busy: false, ok: '', error: err.message });
    }
  };

  return (
    <>
      <section className="fs-container fs-page-head" style={{ paddingBottom: 56 }}>
        <Txt s="hero" k="kicker" as="p" className="fs-kicker">
          Feedback
        </Txt>
        <h1 className="fs-h1">
          <Txt s="hero" k="title">Tell us about your stay</Txt>
        </h1>
        <Txt s="hero" k="description" as="p" className="fs-lead" multiline>
          Every note is read by our team. Your words shape the next stay — yours and everyone else’s.
        </Txt>
      </section>

      <section className="fs-container fs-container--narrow" style={{ paddingBottom: 120 }}>
        <form className="fs-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }} onSubmit={submit}>
          <div className="fs-form-grid">
            <label className="fs-field">{t('book.name')}<input className="fs-input" value={form.name} onChange={set('name')} required /></label>
            <label className="fs-field">{t('book.email')}<input className="fs-input" type="email" value={form.email} onChange={set('email')} required /></label>
            <label className="fs-field">Phone<input className="fs-input" type="tel" value={form.phone} onChange={set('phone')} /></label>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fs-field" style={{ marginBottom: 10 }}>Rating</legend>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  aria-label={`${n} of 5`}
                  aria-pressed={form.rating === n}
                  style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 30, width: 44, height: 44, color: n <= form.rating ? 'var(--gold)' : '#3a3f48' }}
                >
                  ★
                </button>
              ))}
              <span className="fs-muted" style={{ marginLeft: 8 }}>{form.rating} / 5</span>
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fs-field" style={{ marginBottom: 10 }}>Type of feedback</legend>
            <div className="fs-chips">
              {TYPES.map(([v, label]) => (
                <button key={v} type="button" className="fs-chip fs-chip--soft" aria-pressed={form.feedbackType === v} onClick={() => setForm({ ...form, feedbackType: v })}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {form.feedbackType === 'testimonial' && (
            <>
              <label className="fs-field">Your role or title (optional)<input className="fs-input" value={form.role} onChange={set('role')} placeholder="Business traveller, family stay…" /></label>
              <label className="fs-field">Your testimonial<textarea className="fs-input" rows={4} value={form.testimonialText} onChange={set('testimonialText')} required /></label>
              <label className="fs-field">Photo (optional)<input className="fs-input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} /></label>
              <label className="fs-check fs-check--plain">
                <input type="checkbox" checked={form.allowPublicDisplay} onChange={set('allowPublicDisplay')} />
                <span>Faysha may show my testimonial on the website</span>
              </label>
            </>
          )}

          <label className="fs-field">What went well?<textarea className="fs-input" rows={3} value={form.whatWentWell} onChange={set('whatWentWell')} /></label>
          <label className="fs-field">What could be better?<textarea className="fs-input" rows={3} value={form.areasForImprovement} onChange={set('areasForImprovement')} /></label>
          <label className="fs-field">Anything else?<textarea className="fs-input" rows={3} value={form.additionalComments} onChange={set('additionalComments')} /></label>

          {state.error && <div className="fs-alert fs-alert--error" role="alert">{state.error}</div>}
          {state.ok && <div className="fs-alert fs-alert--ok" role="status">{state.ok}</div>}
          <div>
            <button type="submit" className="fs-btn fs-btn--gold" disabled={state.busy}>
              {state.busy ? t('common.sending') : 'Send feedback'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
