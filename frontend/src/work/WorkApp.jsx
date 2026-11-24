import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from '../manager/components/ui';
import TaskTimer, { minutesText, timerState } from '../manager/components/TaskTimer';
import { mediaUrl } from '../manager/config';
import '../manager/styles.css';
import './work.css';

/**
 * My work (/work): the team member's own desk, made for a phone, in four tabs.
 *
 *  - Today: clock in / out, everything assigned to me (requests, wellness sessions, work orders, events) with each
 *    task's clock — time left, or how late (it keeps counting until done) — and photos of the finished work.
 *  - Messages: my conversation with the managers, about a task or not, with photos.
 *  - Time off: my balances, asking for leave, what was decided.
 *  - Me: my timing, what guests said (low ratings stay visible with what was done), warnings to acknowledge, HR notices.
 *
 * The staff app will use the same API (/api/work).
 */
const API = (process.env.REACT_APP_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:5001/api')).replace(/\/$/, '');

function useWorkApi() {
  const { token } = useAuth();
  return useMemo(() => {
    const http = axios.create({ baseURL: `${API}/work`, timeout: 30000 });
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
const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '');
const day = (d) => {
  if (!d) return '';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return 'Today';
  if (d === tomorrow) return 'Tomorrow';
  return new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};
const money = (n) => (n === null || n === undefined ? '' : `${Number(n).toLocaleString('en-US')} XAF`);
const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
const TABS = [
  ['today', 'Today', 'task_alt'],
  ['messages', 'Messages', 'forum'],
  ['leave', 'Time off', 'beach_access'],
  ['me', 'Me', 'person'],
];

export default function WorkApp() {
  const api = useWorkApi();
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'today';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [about, setAbout] = useState(null); // a task the next message is about

  const load = useCallback(() => api.get('/').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), [api]);
  const go = useCallback((t) => setParams(t === 'today' ? {} : { tab: t }), [setParams]);

  useEffect(() => {
    document.body.classList.add('fayos', 'faywork');
    load();
    // Messages refresh faster while the conversation is open.
    const timer = setInterval(load, tab === 'messages' ? 8000 : 30000);
    return () => {
      clearInterval(timer);
      document.body.classList.remove('fayos', 'faywork');
    };
  }, [load, tab]);

  const act = useCallback(
    async (fn, okText) => {
      try {
        const r = await fn();
        if (okText) {
          setFlash(okText);
          setTimeout(() => setFlash(''), 3000);
        }
        await load();
        return r || true;
      } catch (e) {
        setFlash('');
        setError(e.message);
        return false;
      }
    },
    [load],
  );

  /** Uploads one photo; returns the attachment ({ url, name, type }). */
  const upload = useCallback(
    async (file) => {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post('/photos', form);
      return r.attachment;
    },
    [api],
  );

  if (!data) {
    return (
      <div className="work-shell">
        <div className="work-empty">{error || 'Loading your work…'}</div>
      </div>
    );
  }

  const openWarnings = data.warnings.filter((w) => !w.acknowledgedAt).length;
  const unreadNotices = data.notices.filter((n) => !n.read).length;
  const badges = { messages: data.unreadMessages, me: openWarnings + unreadNotices, leave: 0, today: 0 };
  const messageAbout = (task) => {
    setAbout(task);
    go('messages');
  };

  return (
    <div className="work-shell">
      <header className="work-head">
        <div>
          <span className="work-brand">FAYSHA</span>
          <h1>{TABS.find(([k]) => k === tab)[1] === 'Today' ? 'My work' : TABS.find(([k]) => k === tab)[1]}</h1>
          <span className="sub">{data.me.name}{data.me.jobTitle ? ` · ${data.me.jobTitle}` : ''}{data.me.department ? ` · ${data.me.department}` : ''}</span>
        </div>
        <div className="work-head__actions">
          {['manager', 'superadmin'].includes(user?.role) ? <Link className="fay-btn-outline" to="/manager">FAY OS</Link> : null}
          <button type="button" className="fay-btn-outline" onClick={load} aria-label="Refresh"><Icon name="refresh" size={18} /></button>
          <button type="button" className="fay-btn-outline" onClick={logout} aria-label="Sign out"><Icon name="logout" size={18} /></button>
        </div>
      </header>

      {error ? <div className="work-alert work-alert--error" role="alert">{error} <button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button></div> : null}
      {flash ? <div className="work-alert" role="status">{flash}</div> : null}
      {openWarnings && tab !== 'me' ? (
        <button type="button" className="work-alert work-alert--error work-alert--link" onClick={() => go('me')}>
          You have {openWarnings === 1 ? 'a warning' : `${openWarnings} warnings`} to read <Icon name="chevron_right" size={18} />
        </button>
      ) : null}

      {tab === 'today' ? <Today data={data} api={api} act={act} upload={upload} onMessage={messageAbout} /> : null}
      {tab === 'messages' ? <Messages data={data} api={api} act={act} upload={upload} about={about} clearAbout={() => setAbout(null)} reload={load} /> : null}
      {tab === 'leave' ? <TimeOff data={data} api={api} act={act} /> : null}
      {tab === 'me' ? <Me data={data} api={api} act={act} reload={load} /> : null}

      <nav className="work-tabs" aria-label="My work">
        {TABS.map(([k, label, icon]) => (
          <button key={k} type="button" className={`work-tab${k === tab ? ' on' : ''}`} aria-current={k === tab ? 'page' : undefined} onClick={() => go(k)}>
            <span className="work-tab__icon">
              <Icon name={icon} size={22} />
              {badges[k] ? <span className="work-badge">{badges[k]}</span> : null}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ================================================================= Today
function Today({ data, api, act, upload, onMessage }) {
  const openRequests = data.requests.filter((r) => r.open);
  const doneRequests = data.requests.filter((r) => !r.open);
  const sessions = data.wellness.filter((w) => ['requested', 'upcoming', 'in_progress'].includes(w.status));
  const openOrders = data.workOrders.filter((o) => !['Completed', 'Closed', 'Cancelled'].includes(o.status));
  const total = openRequests.length + sessions.length + openOrders.length;
  const lateNow = [...openRequests, ...openOrders].filter((x) => timerState(x.timer)?.late).length;
  const tm = data.timing || {};
  // Late first, then the least time left.
  const byClock = (a, b) => {
    const due = (x) => (x.timer && x.open !== false ? new Date(x.timer.dueAt).getTime() : Infinity);
    return due(a) - due(b);
  };

  return (
    <>
      <Clock clock={data.clock} api={api} act={act} />
      <div className="work-stats">
        <Stat label="To do" value={total} />
        <Stat label="Late now" value={lateNow} danger={lateNow > 0} hint={lateNow ? 'finish these first' : 'all on time'} />
        <Stat
          label="My timing"
          value={tm.onTimeRate === null || tm.onTimeRate === undefined ? '—' : `${tm.onTimeRate}%`}
          hint={tm.done ? `on time · ${tm.done} done in 30 days` : 'no timed tasks yet'}
        />
      </div>

      {total === 0 && !data.events.length ? <div className="work-empty"><Icon name="task_alt" size={40} color="var(--gold)" /><p>Nothing assigned to you right now.</p></div> : null}

      {openRequests.length ? (
        <Section title="Requests" icon="room_service" count={openRequests.length}>
          {[...openRequests].sort(byClock).map((r) => <RequestCard key={r.id} r={r} api={api} act={act} upload={upload} onMessage={onMessage} />)}
        </Section>
      ) : null}

      {data.wellness.length ? (
        <Section title="Wellness sessions" icon="spa" count={sessions.length}>
          <CheckIn api={api} act={act} />
          {data.wellness.map((w) => <SessionCard key={w.id} w={w} api={api} act={act} />)}
        </Section>
      ) : null}

      {data.workOrders.length ? (
        <Section title="Work orders" icon="construction" count={openOrders.length}>
          {[...data.workOrders].sort(byClock).map((o) => <OrderCard key={o.id} o={o} api={api} act={act} upload={upload} onMessage={onMessage} />)}
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
              <TaskTimer timer={r.timer} />
              <span className="sub">{r.resolution}</span>
              <Photos list={r.photos} />
            </article>
          ))}
        </Section>
      ) : null}
    </>
  );
}

function Clock({ clock, api, act }) {
  if (!clock?.available) return null;
  const since = clock.in ? Math.floor((Date.now() - new Date(clock.in).getTime()) / 60000) : 0;
  return (
    <div className={`work-clock${clock.in ? ' on' : ''}`}>
      <Icon name={clock.in ? 'timer' : 'schedule'} size={24} color={clock.in ? 'var(--green-bright, #3fd283)' : 'var(--gold)'} />
      <div style={{ flex: 1 }}>
        <strong>{clock.in ? `On shift since ${time(clock.in)}` : 'Not clocked in'}</strong>
        <div className="sub">{clock.in ? `${minutesText(since)} today` : clock.lastOut ? `Last out at ${time(clock.lastOut)}` : 'Clock in when you start'} · {clock.weekHours} h this week</div>
      </div>
      {clock.in ? (
        <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Clock out now?') && act(() => api.post('/clock-out'), 'Clocked out — thank you')}>Clock out</button>
      ) : (
        <button type="button" className="btn-gold" onClick={() => act(() => api.post('/clock-in'), 'Clocked in — have a good shift')}>Clock in</button>
      )}
    </div>
  );
}

function Stat({ label, value, hint, danger }) {
  return (
    <div className={`work-stat${danger ? ' work-stat--danger' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Section({ title, icon, count, children }) {
  return (
    <section className="work-section">
      <h2><Icon name={icon} size={20} color="var(--gold)" /> {title}{count ? <span className="work-count">{count}</span> : null}</h2>
      {children}
    </section>
  );
}

function Photos({ list }) {
  if (!list?.length) return null;
  return (
    <div className="work-photos">
      {list.map((p) => (
        <a key={p.url} href={mediaUrl(p.url)} target="_blank" rel="noreferrer">
          {p.type === 'document' ? <span className="work-doc"><Icon name="description" size={20} /> {p.name}</span> : <img src={mediaUrl(p.url)} alt={p.name || 'Photo'} />}
        </a>
      ))}
    </div>
  );
}

/** Take or choose photos (the phone's camera opens directly); shows them as they upload. */
function PhotoPicker({ photos, setPhotos, upload, label = 'Add a photo' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 6 - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      const added = [];
      for (const f of files) added.push(await upload(f));
      setPhotos([...photos, ...added]);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="work-photos">
      {photos.map((p, i) => (
        <span key={p.url} className="work-photo">
          <img src={mediaUrl(p.url)} alt={`Attachment ${i + 1}`} />
          <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((x) => x !== p))}>×</button>
        </span>
      ))}
      {photos.length < 6 ? (
        <button type="button" className="work-photo-add" onClick={() => ref.current?.click()} disabled={busy}>
          <Icon name={busy ? 'hourglass_top' : 'photo_camera'} size={22} />
          <span>{busy ? 'Uploading…' : label}</span>
        </button>
      ) : null}
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden onChange={pick} />
      {err ? <span className="sub" style={{ color: '#ff6b6b', width: '100%' }}>{err}</span> : null}
    </div>
  );
}

function DoneForm({ placeholder, withCost, onCancel, onDone, upload }) {
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const [photos, setPhotos] = useState([]);
  return (
    <div className="work-form">
      <textarea className="kit-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
      {withCost ? <input className="kit-input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Cost of parts, XAF (optional)" /> : null}
      <PhotoPicker photos={photos} setPhotos={setPhotos} upload={upload} label="Photo of the work" />
      <div className="work-actions">
        <button type="button" className="fay-btn-outline" onClick={onCancel}>Back</button>
        <button type="button" className="btn-gold" disabled={!note.trim()} onClick={() => onDone({ note, cost: cost || null, photos })}>Mark done</button>
      </div>
    </div>
  );
}

function RequestCard({ r, api, act, upload, onMessage }) {
  const [closing, setClosing] = useState(false);
  return (
    <article className={`work-card${r.urgent || timerState(r.timer)?.late ? ' work-card--urgent' : ''}`}>
      <div className="work-card__top">
        <strong>{r.department}{r.urgent ? ' · URGENT' : ''}</strong>
        <span className="work-pill">{r.status}</span>
      </div>
      <div className="work-card__clock">
        <TaskTimer timer={r.timer} size="lg" />
        <span className="sub">{r.sourceLabel}{r.timer ? ` · ${minutesText(r.timer.minutes)} allowed` : ''}</span>
      </div>
      <p className="work-card__title">{r.title}</p>
      {r.notes ? <p className="work-card__notes">{r.notes}</p> : null}
      <span className="sub">{[r.guest, r.location, `asked ${time(r.createdAt)}`].filter(Boolean).join(' · ')}</span>
      {closing ? (
        <DoneForm
          placeholder={r.guest ? 'What was done (the guest sees it)' : 'What was done'}
          upload={upload}
          onCancel={() => setClosing(false)}
          onDone={(v) => act(() => api.post(`/requests/${r.id}/done`, v), r.guest ? 'Done — the guest is told and asked to rate it' : 'Done — thank you')}
        />
      ) : (
        <div className="work-actions">
          <button type="button" className="work-link" onClick={() => onMessage({ kind: 'request', id: r.id, title: r.title })}><Icon name="chat" size={16} /> Ask the manager</button>
          {!r.started ? <button type="button" className="fay-btn-outline" onClick={() => act(() => api.post(`/requests/${r.id}/start`), r.guest ? 'Started — the guest knows you are on it' : 'Started')}>Start</button> : null}
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

function OrderCard({ o, api, act, upload, onMessage }) {
  const [closing, setClosing] = useState(false);
  const done = ['Completed', 'Closed', 'Cancelled'].includes(o.status);
  return (
    <article className={`work-card${(o.priority === 'High' || o.priority === 'Critical' || timerState(o.timer)?.late) && !done ? ' work-card--urgent' : ''}${done ? ' work-card--done' : ''}`}>
      <div className="work-card__top">
        <strong>{o.number} · {o.priority}</strong>
        <span className="work-pill">{o.status}</span>
      </div>
      <div className="work-card__clock">
        <TaskTimer timer={o.timer} size={done ? 'md' : 'lg'} />
        {o.timer && !done ? <span className="sub">{minutesText(o.timer.minutes)} allowed</span> : null}
      </div>
      <p className="work-card__title">{o.title}</p>
      <span className="sub">{[o.location, o.asset ? `Asset: ${o.asset}` : null].filter(Boolean).join(' · ')}</span>
      {done ? (
        <>
          <span className="sub">{o.notes}{o.cost ? ` · ${money(o.cost)}` : ''}</span>
          <Photos list={o.photos} />
        </>
      ) : closing ? (
        <DoneForm placeholder="What was done" withCost upload={upload} onCancel={() => setClosing(false)} onDone={(v) => act(() => api.post(`/work-orders/${o.id}/done`, v), 'Work order completed')} />
      ) : (
        <div className="work-actions">
          <button type="button" className="work-link" onClick={() => onMessage({ kind: 'work_order', id: o.id, title: o.title })}><Icon name="chat" size={16} /> Ask the manager</button>
          {!o.started ? <button type="button" className="fay-btn-outline" onClick={() => act(() => api.post(`/work-orders/${o.id}/start`), 'Started')}>Start</button> : null}
          <button type="button" className="btn-gold" onClick={() => setClosing(true)}>Done…</button>
        </div>
      )}
    </article>
  );
}

// ================================================================= Messages
function Messages({ data, api, act, upload, about, clearAbout, reload }) {
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const end = useRef(null);
  const unread = data.unreadMessages;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [data.messages.length]);
  useEffect(() => {
    if (unread) api.post('/messages/read').then(reload).catch(() => {});
  }, [unread, api, reload]);

  const send = async () => {
    setSending(true);
    const ok = await act(() => api.post('/messages', { body, attachments: photos, about }), null);
    setSending(false);
    if (ok) {
      setBody('');
      setPhotos([]);
      clearAbout();
    }
  };

  return (
    <section className="work-section">
      <span className="sub">Your conversation with the managers — questions, problems on the job, anything you need. Photos help.</span>
      <div className="work-thread">
        {!data.messages.length ? <div className="work-empty" style={{ padding: 24 }}><Icon name="forum" size={36} color="var(--gold)" /><p>No messages yet. Write to your managers here.</p></div> : null}
        {data.messages.map((m) => (
          <div key={m.id} className={`work-msg${m.fromStaff ? ' mine' : ''}`}>
            {!m.fromStaff ? <span className="work-msg__who">{m.sender || 'Manager'}</span> : null}
            {m.about ? <span className="work-msg__about"><Icon name="link" size={14} /> {m.about.title}</span> : null}
            {m.body ? <span>{m.body}</span> : null}
            <Photos list={m.attachments} />
            <span className="work-msg__at">{dateText(m.at)} · {time(m.at)}{m.fromStaff && m.read ? ' · read' : ''}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="work-composer">
        {about ? (
          <span className="work-msg__about">
            <Icon name="link" size={14} /> About: {about.title}
            <button type="button" aria-label="Not about this task" onClick={clearAbout}>×</button>
          </span>
        ) : null}
        <textarea className="kit-input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write to your managers…" aria-label="Message" />
        <PhotoPicker photos={photos} setPhotos={setPhotos} upload={upload} />
        <div className="work-actions">
          <button type="button" className="btn-gold" disabled={sending || (!body.trim() && !photos.length)} onClick={send}>
            <Icon name="send" size={16} /> Send
          </button>
        </div>
      </div>
    </section>
  );
}

// ================================================================= Time off
const LEAVE_STATUS = { pending: ['Waiting', '#e8b84a'], approved: ['Approved', '#3fd283'], rejected: ['Not approved', '#ff6b6b'], cancelled: ['Cancelled', '#8f897d'] };

function TimeOff({ data, api, act }) {
  const leave = data.leave;
  const [form, setForm] = useState(null);
  if (!leave.available) {
    return <div className="work-empty"><Icon name="badge" size={36} color="var(--gold)" /><p>Your HR record is not set up yet. Ask HR to add you (HQ → Staff), then you can ask for time off here.</p></div>;
  }
  const today = new Date().toISOString().slice(0, 10);
  const days = form?.from && form?.to && form.to >= form.from ? Math.round((new Date(form.to) - new Date(form.from)) / 86400000) + 1 : 0;
  const type = form && leave.types.find((t) => t.id === Number(form.leaveTypeId));
  return (
    <>
      <div className="work-balances">
        {/* The leave everyone uses (up to a month a year), and any other kind in use. */}
        {leave.types.filter((t) => t.limited && t.total > 0 && (t.total <= 30 || t.remaining < t.total || t.pending)).map((t) => (
          <div key={t.id} className="work-stat">
            <strong>{t.remaining}</strong>
            <span>{t.name}</span>
            <small>of {t.total} days{t.pending ? ` · ${t.pending} asked` : ''}</small>
          </div>
        ))}
      </div>

      {form ? (
        <section className="work-card">
          <p className="work-card__title">Ask for time off</p>
          <label className="work-field">Kind
            <select className="kit-input" value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
              {leave.types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.limited ? ` (${t.remaining - t.pending} left)` : ''}{t.paid ? '' : ' · unpaid'}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="work-field" style={{ flex: 1 }}>First day<input type="date" className="kit-input" min={today} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to && form.to >= e.target.value ? form.to : e.target.value })} /></label>
            <label className="work-field" style={{ flex: 1 }}>Last day<input type="date" className="kit-input" min={form.from || today} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
          </div>
          <label className="work-field">Why<textarea className="kit-input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Family wedding in Bamenda" /></label>
          {days ? <span className="sub">{days} day{days > 1 ? 's' : ''}{type?.limited ? ` · ${Math.max(0, type.remaining - type.pending - days)} left after this` : ''}</span> : null}
          <div className="work-actions">
            <button type="button" className="fay-btn-outline" onClick={() => setForm(null)}>Cancel</button>
            <button
              type="button"
              className="btn-gold"
              disabled={!days || !form.reason.trim()}
              onClick={async () => {
                if (await act(() => api.post('/leave', { ...form, leaveTypeId: Number(form.leaveTypeId) }), 'Sent — your manager will answer here')) setForm(null);
              }}
            >
              Send request
            </button>
          </div>
        </section>
      ) : (
        <button type="button" className="btn-gold work-wide" onClick={() => setForm({ leaveTypeId: leave.types[0]?.id || '', from: '', to: '', reason: '' })}>
          <Icon name="add" size={18} /> Ask for time off
        </button>
      )}

      <Section title="My requests" icon="event_note">
        {!leave.requests.length ? <span className="sub">None yet.</span> : null}
        {leave.requests.map((r) => (
          <article key={r.id} className="work-card">
            <div className="work-card__top">
              <strong>{r.type}</strong>
              <span className="work-pill" style={{ color: LEAVE_STATUS[r.status]?.[1], borderColor: LEAVE_STATUS[r.status]?.[1] }}>{LEAVE_STATUS[r.status]?.[0] || r.status}</span>
            </div>
            <span>{day(r.from)} → {day(r.to)} · {r.days} day{r.days > 1 ? 's' : ''}</span>
            <span className="sub">“{r.reason}”</span>
            {r.status === 'rejected' && r.rejectionReason ? <span className="sub" style={{ color: '#ff6b6b' }}>{r.decidedBy ? `${r.decidedBy}: ` : ''}{r.rejectionReason}</span> : null}
            {r.status === 'approved' && r.decidedBy ? <span className="sub">Approved by {r.decidedBy}</span> : null}
            {r.status === 'pending' ? (
              <div className="work-actions">
                <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Cancel this request?') && act(() => api.post(`/leave/${r.id}/cancel`), 'Request cancelled')}>Cancel request</button>
              </div>
            ) : null}
          </article>
        ))}
      </Section>
    </>
  );
}

// ================================================================= Me
function Me({ data, api, act, reload }) {
  const tm = data.timing || {};
  const unread = data.notices.some((n) => !n.read);
  useEffect(() => {
    if (unread) api.post('/notices/read').then(reload).catch(() => {});
  }, [unread, api, reload]);
  return (
    <>
      <div className="work-stats">
        <Stat label="On time" value={tm.onTimeRate === null || tm.onTimeRate === undefined ? '—' : `${tm.onTimeRate}%`} hint={`${tm.done || 0} timed tasks in 30 days`} />
        <Stat label="Average time" value={tm.avgMinutes ? minutesText(tm.avgMinutes) : '—'} hint={tm.avgLateMinutes ? `+${minutesText(tm.avgLateMinutes)} when late` : 'per task'} />
        <Stat label="Guest rating" value={data.ratings.average ? `${data.ratings.average}★` : '—'} hint={data.ratings.count ? `${data.ratings.count} rating${data.ratings.count > 1 ? 's' : ''}` : 'no ratings yet'} />
      </div>

      {data.warnings.length ? (
        <Section title="Warnings" icon="report">
          {data.warnings.map((w) => <WarningCard key={w.id} w={w} api={api} act={act} />)}
        </Section>
      ) : null}

      {data.ratings.low.length ? (
        <Section title="Needs attention" icon="sentiment_dissatisfied">
          <span className="sub">Low ratings from guests in the last 90 days. Talk to your manager if something was out of your hands.</span>
          {data.ratings.low.map((x, i) => (
            <article key={i} className="work-card work-card--urgent">
              <div className="work-card__top"><strong style={{ color: '#ff6b6b' }}>{stars(x.rating)}</strong><span className="sub">{x.context} · {dateText(x.at)}</span></div>
              {x.comment ? <span>“{x.comment}”</span> : null}
              {x.followedUp ? <span className="sub">Followed up by the manager{x.followUp ? `: ${x.followUp}` : ''}</span> : null}
            </article>
          ))}
        </Section>
      ) : null}

      {data.ratings.recent.length ? (
        <Section title="What guests said" icon="reviews">
          {data.ratings.recent.map((x, i) => (
            <article key={i} className="work-card">
              <div className="work-card__top"><strong style={{ color: x.rating <= 2 ? '#ff6b6b' : 'var(--gold)' }}>{stars(x.rating)}</strong><span className="sub">{x.context} · {dateText(x.at)}</span></div>
              {x.comment ? <span>“{x.comment}”</span> : null}
            </article>
          ))}
        </Section>
      ) : null}

      {data.notices.length ? (
        <Section title="Notices from HR" icon="campaign">
          {data.notices.map((n) => (
            <article key={n.id} className={`work-card${n.read ? '' : ' work-card--new'}`}>
              <div className="work-card__top"><strong>{n.title}</strong><span className="sub">{dateText(n.at)}</span></div>
              <span className="sub">{n.message}</span>
            </article>
          ))}
        </Section>
      ) : null}
    </>
  );
}

function WarningCard({ w, api, act }) {
  const [reply, setReply] = useState('');
  const open = !w.acknowledgedAt;
  return (
    <article className={`work-card${open ? ' work-card--urgent' : ''}`}>
      <div className="work-card__top">
        <strong style={{ color: w.level === 'final' ? '#ff6b6b' : w.level === 'written' ? '#e8b84a' : 'var(--text)' }}>{w.label}</strong>
        <span className="sub">{dateText(w.at)}{w.by ? ` · ${w.by}` : ''}</span>
      </div>
      <span>{w.reason}</span>
      {open ? (
        <div className="work-form">
          <textarea className="kit-input" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your side (optional) — your manager reads it" />
          <div className="work-actions">
            <button type="button" className="btn-gold" onClick={() => act(() => api.post(`/warnings/${w.id}/acknowledge`, { response: reply }), 'Acknowledged')}>I have read this</button>
          </div>
        </div>
      ) : (
        <span className="sub">Acknowledged {dateText(w.acknowledgedAt)}{w.response ? ` · your side: “${w.response}”` : ''}</span>
      )}
    </article>
  );
}
