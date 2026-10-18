import { useEffect, useState } from 'react';
import { applyForJob, getJobs } from '../api';
import { Loading } from '../components/ui';
import { PageContent, Txt } from '../content';
import { useLang } from '../i18n';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', cover_letter_text: '', expected_salary: '', available_start_date: '', cv: null, cover_letter_file: null };

export default function Careers() {
  return (
    <PageContent pageId="careers">
      <CareersBody />
    </PageContent>
  );
}

function CareersBody() {
  const { t } = useLang();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    getJobs().then(setJobs).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <section className="fs-container fs-page-head" style={{ paddingBottom: 56 }}>
        <Txt s="hero" k="kicker" as="p" className="fs-kicker">
          Careers
        </Txt>
        <h1 className="fs-h1">
          <Txt s="hero" k="title">Craft serenity with us</Txt>
        </h1>
        <Txt s="hero" k="description" as="p" className="fs-lead" multiline>
          Hospitality, wellness, technology and care — join the team that makes every Faysha stay feel effortless.
        </Txt>
      </section>

      <section className="fs-container" style={{ paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <div className="fs-alert fs-alert--error">{error}</div>}
        {!jobs && !error && <Loading label={t('common.loading')} />}
        {jobs && jobs.length === 0 && (
          <div className="fs-card fs-empty">
            <Txt s="empty" k="text">There are no open positions right now. Send your CV to info@fayshaa.com and we’ll keep it on file.</Txt>
          </div>
        )}
        {jobs?.map((job) => (
          <article key={job.id} className="fs-card" style={{ padding: 30 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <h2 className="fs-h3" style={{ fontSize: 28 }}>{job.title}</h2>
                <p className="fs-muted" style={{ margin: '6px 0 0', fontSize: 13, textTransform: 'capitalize' }}>
                  {[job.department_name, job.employment_type?.replace('-', ' '), job.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" className="fs-btn fs-btn--ghost" aria-expanded={open === job.id} onClick={() => setOpen(open === job.id ? null : job.id)}>
                {open === job.id ? 'Close' : 'View & apply'}
              </button>
            </div>
            {open === job.id && <JobDetail job={job} />}
          </article>
        ))}
      </section>
    </>
  );
}

function JobDetail({ job }) {
  const { t } = useLang();
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, ok: false, error: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.files ? e.target.files[0] : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, error: '' });
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
    try {
      await applyForJob(job.id, data);
      setState({ busy: false, ok: true, error: '' });
      setForm(EMPTY);
    } catch (err) {
      setState({ busy: false, ok: false, error: err.message });
    }
  };

  return (
    <div style={{ marginTop: 26, paddingTop: 26, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="fs-prose" style={{ whiteSpace: 'pre-line' }}>
        <p>{job.description}</p>
        {job.responsibilities && (
          <>
            <h3>Responsibilities</h3>
            <p>{job.responsibilities}</p>
          </>
        )}
        {job.requirements && (
          <>
            <h3>Requirements</h3>
            <p>{job.requirements}</p>
          </>
        )}
        {job.qualifications && (
          <>
            <h3>Qualifications</h3>
            <p>{job.qualifications}</p>
          </>
        )}
      </div>
      {state.ok ? (
        <div className="fs-alert fs-alert--ok" role="status">Thank you — your application has been received. Our HR team will be in touch.</div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="fs-form-grid">
            <label className="fs-field">First name<input className="fs-input" value={form.first_name} onChange={set('first_name')} required /></label>
            <label className="fs-field">Last name<input className="fs-input" value={form.last_name} onChange={set('last_name')} required /></label>
            <label className="fs-field">{t('book.email')}<input className="fs-input" type="email" value={form.email} onChange={set('email')} required /></label>
            <label className="fs-field">Phone<input className="fs-input" type="tel" value={form.phone} onChange={set('phone')} required /></label>
            <label className="fs-field">Expected salary (XAF)<input className="fs-input" type="number" min="0" value={form.expected_salary} onChange={set('expected_salary')} /></label>
            <label className="fs-field">Available from<input className="fs-input" type="date" style={{ colorScheme: 'dark' }} value={form.available_start_date} onChange={set('available_start_date')} /></label>
            <label className="fs-field">CV (PDF or Word)<input className="fs-input" type="file" accept=".pdf,.doc,.docx" onChange={set('cv')} required /></label>
            <label className="fs-field">Cover letter file (optional)<input className="fs-input" type="file" accept=".pdf,.doc,.docx" onChange={set('cover_letter_file')} /></label>
          </div>
          <label className="fs-field">Cover letter<textarea className="fs-input" rows={5} value={form.cover_letter_text} onChange={set('cover_letter_text')} /></label>
          {state.error && <div className="fs-alert fs-alert--error" role="alert">{state.error}</div>}
          <div>
            <button type="submit" className="fs-btn fs-btn--gold" disabled={state.busy}>
              {state.busy ? t('common.sending') : 'Send application'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
