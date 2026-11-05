import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from '../manager/components/ui';
import '../manager/styles.css';
import './work.css';

/**
 * My work (/work): what is assigned to me — guest requests, wellness sessions, work orders, events I lead — with the
 * buttons to move each forward, and my ratings. For every team member; made for a phone. The staff app will use the
 * same API (/api/work).
 */
const API = (process.env.REACT_APP_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:5001/api')).replace(/\/$/, '');

function useWorkApi() {
  const { token } = useAuth();
  return useMemo(() => {
    const http = axios.create({ baseURL: `${API}/work`, timeout: 20000 });
    http.interceptors.request.use((c) => {
      const t = token || localStorage.getItem('authToken');
      if (t) c.headers.Authorization = `Bearer ${t}`;
      return c;
    });
    http.interceptors.response.use(
      (r) => r.data,
      (e) => Promise.reject(new Error(e.response?.data?.message || e.message)),
    );
    return http;
  }, [token]);
}

const time = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const day = (d) => {
  if (!d) return '';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return 'Today';
  if (d === tomorrow) return 'Tomorrow';
  return new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};
const money = (n) => (n === null || n === undefined ? '' : `${Number(n).toLocaleString('en-US')} XAF`);

export default function WorkApp() {
  const api = useWorkApi();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(() => api.get('/').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), [api]);

  useEffect(() => {
    document.body.classList.add('fayos', 'faywork');
    load();
    const timer = setInterval(load, 30000);
    return () => {
      clearInterval(timer);
      document.body.classList.remove('fayos', 'faywork');
    };
  }, [load]);

  const act = async (fn, okText) => {
    try {
      await fn();
      setFlash(okText);
      setTimeout(() => setFlash(''), 3000);
      await load();
      return true;
    } catch (e) {
      setFlash('');
      setError(e.message);
      return false;
    }
  };

  if (!data) {
    return (
      <div className="work-shell">
        <div className="work-empty">{error || 'Loading your work…'}</div>
      </div>
    );
  }

  const openRequests = data.requests.filter((r) => r.open);
  const doneRequests = data.requests.filter((r) => !r.open);
  const sessions = data.wellness.filter((w) => ['requested', 'upcoming', 'in_progress'].includes(w.status));
  const openOrders = data.workOrders.filter((o) => !['Completed', 'Closed', 'Cancelled'].includes(o.status));
  const total = openRequests.length + sessions.length + openOrders.length;

  return (
    <div className="work-shell">
      <header className="work-head">
        <div>
          <span className="work-brand">FAYSHA</span>
          <h1>My work</h1>
          <span className="sub">{data.me.name}{data.me.jobTitle ? ` · ${data.me.jobTitle}` : ''}{data.me.department ? ` · ${data.me.department}` : ''}</span>
        </div>
        <div className="work-head__actions">
          {['manager', 'superadmin'].includes(user?.role) ? <Link className="fay-btn-outline" to="/manager">FAY OS</Link> : null}
          <button type="button" className="fay-btn-outline" onClick={load} aria-label="Refresh"><Icon name="refresh" size={18} /></button>
          <button type="button" className="fay-btn-outline" onClick={logout} aria-label="Sign out"><Icon name="logout" size={18} /></button>
        </div>
      </header>

      <div className="work-stats">
        <Stat label="To do" value={total} />
        <Stat label="Requests" value={openRequests.length} />
        <Stat label="Sessions" value={sessions.length} />
        <Stat label="Work orders" value={openOrders.length} />
        <Stat label="My rating" value={data.ratings.average ? `${data.ratings.average}★` : '—'} hint={data.ratings.count ? `${data.ratings.count} rating${data.ratings.count > 1 ? 's' : ''}` : 'no ratings yet'} />
      </div>

      {error ? <div className="work-alert work-alert--error" role="alert">{error} <button type="button" onClick={() => setError('')}>×</button></div> : null}
      {flash ? <div className="work-alert" role="status">{flash}</div> : null}

      {total === 0 && !data.events.length ? <div className="work-empty"><Icon name="task_alt" size={40} color="var(--gold)" /><p>Nothing assigned to you right now.</p></div> : null}

      {openRequests.length ? (
        <Section title="Guest requests" icon="room_service">
          {openRequests.map((r) => <RequestCard key={r.id} r={r} api={api} act={act} />)}
        </Section>
      ) : null}

      {data.wellness.length ? (
        <Section title="Wellness sessions" icon="spa">
          <CheckIn api={api} act={act} />
          {data.wellness.map((w) => <SessionCard key={w.id} w={w} api={api} act={act} />)}
        </Section>
      ) : null}

      {data.workOrders.length ? (
        <Section title="Work orders" icon="construction">
          {data.workOrders.map((o) => <OrderCard key={o.id} o={o} api={api} act={act} />)}
        </Section>
      ) : null}

      {data.events.length ? (
        <Section title="Events I lead" icon="celebration">
          {data.events.map((e) => (
            <article key={e.id} className="work-card">
              <div className="work-card__top"><strong>{e.reference}</strong><span className="work-pill">{e.status.replace(/_/g, ' ')}</span></div>
              <p className="work-card__title">{e.title || e.name}</p>
              <span className="sub">{[day(e.date), e.guests ? `${e.guests} guests` : null, e.type].filter(Boolean).join(' · ')}</span>
            </article>
          ))}
        </Section>
      ) : null}

      {doneRequests.length ? (
        <Section title="Done today" icon="done_all">
          {doneRequests.map((r) => (
            <article key={r.id} className="work-card work-card--done">
              <div className="work-card__top"><strong>{r.title}</strong><span className="sub">{time(r.completedAt)}</span></div>
              <span className="sub">{r.resolution}</span>
            </article>
          ))}
        </Section>
      ) : null}

      {data.ratings.recent.length ? (
        <Section title="What guests said" icon="reviews">
          {data.ratings.recent.map((x, i) => (
            <article key={i} className="work-card">
              <div className="work-card__top"><strong style={{ color: 'var(--gold)' }}>{'★'.repeat(x.rating)}{'☆'.repeat(5 - x.rating)}</strong><span className="sub">{x.context}</span></div>
              {x.comment ? <span>“{x.comment}”</span> : null}
            </article>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="work-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="work-section">
      <h2><Icon name={icon} size={20} color="var(--gold)" /> {title}</h2>
      {children}
    </section>
  );
}

function RequestCard({ r, api, act }) {
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState('');
  return (
    <article className={`work-card${r.urgent ? ' work-card--urgent' : ''}`}>
      <div className="work-card__top">
        <strong>{r.department}{r.urgent ? ' · URGENT' : ''}</strong>
        <span className="work-pill">{r.status}</span>
      </div>
      <p className="work-card__title">{r.title}</p>
      {r.notes ? <p className="work-card__notes">{r.notes}</p> : null}
      <span className="sub">{[r.guest, r.location, `asked ${time(r.createdAt)}`].filter(Boolean).join(' · ')}</span>
      {closing ? (
        <div className="work-form">
          <textarea className="kit-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done (the guest sees it)" />
          <div className="work-actions">
            <button type="button" className="fay-btn-outline" onClick={() => setClosing(false)}>Back</button>
            <button type="button" className="btn-gold" disabled={!note.trim()} onClick={() => act(() => api.post(`/requests/${r.id}/done`, { note }), 'Done — the guest is told and asked to rate it')}>Mark done</button>
          </div>
        </div>
      ) : (
        <div className="work-actions">
          {!r.started ? <button type="button" className="fay-btn-outline" onClick={() => act(() => api.post(`/requests/${r.id}/start`), 'Started — the guest knows you are on it')}>Start</button> : null}
          <button type="button" className="btn-gold" onClick={() => setClosing(true)}>Done…</button>
        </div>
      )}
    </article>
  );
}

function CheckIn({ api, act }) {
  const [code, setCode] = useState('');
  return (
    <form
      className="work-checkin"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act(() => api.post('/wellness/check-in', { code }), 'Checked in — welcome them')) setCode('');
      }}
    >
      <Icon name="qr_code_2" size={22} color="var(--gold)" />
      <input className="kit-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Guest’s booking code, e.g. W7K3Q9A" aria-label="Guest booking code" autoCapitalize="characters" />
      <button type="submit" className="btn-gold" disabled={code.trim().length < 4}>Check in</button>
    </form>
  );
}

function SessionCard({ w, api, act }) {
  const live = ['upcoming', 'in_progress'].includes(w.status);
  return (
    <article className={`work-card${w.status === 'completed' || w.status === 'no_show' ? ' work-card--done' : ''}`}>
      <div className="work-card__top">
        <strong>{day(w.date)} · {w.start}–{w.end}</strong>
        <span className="work-pill">{w.status === 'in_progress' ? 'arrived' : w.status.replace('_', ' ')}</span>
      </div>
      <p className="work-card__title">{w.activity}</p>
      <span className="sub">{[w.guest, w.people > 1 ? `${w.people} people` : null, w.place, w.residence ? `Residence ${w.residence}` : null].filter(Boolean).join(' · ')}</span>
      {w.requests ? <p className="work-card__notes">“{w.requests}”</p> : null}
      {w.status === 'requested' ? <span className="sub">Waiting for a manager to confirm the time.</span> : null}
      {live ? (
        <div className="work-actions">
          {w.status === 'upcoming' ? <button type="button" className="fay-btn-outline" onClick={() => act(() => api.post(`/wellness/${w.id}/no-show`), 'Marked as missed')}>No-show</button> : null}
          {w.status === 'in_progress' ? <button type="button" className="btn-gold" onClick={() => act(() => api.post(`/wellness/${w.id}/complete`), 'Completed — the guest is asked to rate it')}>Completed</button> : <span className="sub">Ask for the code above when they arrive.</span>}
        </div>
      ) : null}
    </article>
  );
}

function OrderCard({ o, api, act }) {
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const done = ['Completed', 'Closed', 'Cancelled'].includes(o.status);
  return (
    <article className={`work-card${o.priority === 'High' || o.priority === 'Critical' ? ' work-card--urgent' : ''}${done ? ' work-card--done' : ''}`}>
      <div className="work-card__top">
        <strong>{o.number} · {o.priority}</strong>
        <span className="work-pill">{o.status}</span>
      </div>
      <p className="work-card__title">{o.title}</p>
      <span className="sub">{[o.location, o.asset ? `Asset: ${o.asset}` : null].filter(Boolean).join(' · ')}</span>
      {done ? (
        <span className="sub">{o.notes}{o.cost ? ` · ${money(o.cost)}` : ''}</span>
      ) : closing ? (
        <div className="work-form">
          <textarea className="kit-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done" />
          <input className="kit-input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Cost of parts, XAF (optional)" />
          <div className="work-actions">
            <button type="button" className="fay-btn-outline" onClick={() => setClosing(false)}>Back</button>
            <button type="button" className="btn-gold" disabled={!note.trim()} onClick={() => act(() => api.post(`/work-orders/${o.id}/done`, { note, cost: cost || null }), 'Work order completed')}>Mark done</button>
          </div>
        </div>
      ) : (
        <div className="work-actions">
          {!o.started ? <button type="button" className="fay-btn-outline" onClick={() => act(() => api.post(`/work-orders/${o.id}/start`), 'Started')}>Start</button> : null}
          <button type="button" className="btn-gold" onClick={() => setClosing(true)}>Done…</button>
        </div>
      )}
    </article>
  );
}
