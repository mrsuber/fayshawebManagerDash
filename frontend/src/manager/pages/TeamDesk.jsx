import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import AssignPicker from '../components/AssignPicker';
import { Empty, Pill, Tabs, Toolbar } from '../components/kit';
import { Icon, KpiGrid } from '../components/ui';
import { mediaUrl } from '../config';
import { useToast } from '../context/ToastContext';
import useSocketEvent from '../hooks/useSocketEvent';

/**
 * FAY OS → Team desk: the managers' side of My work. Messages with each team member (about a task, with photos),
 * time off to approve or decline, and warnings given to the team (with their acknowledgement and their side).
 * API: /api/manager/staff-desk (routes/manager/staffDesk.js).
 */
const api = {
  get: (u) => client.get(`/staff-desk${u}`).then((r) => r.data),
  post: (u, b) => client.post(`/staff-desk${u}`, b).then((r) => r.data),
};
const LEAVE = { pending: ['To decide', '#e8b84a'], approved: ['Approved', '#3fd283'], rejected: ['Declined', '#d94040'], cancelled: ['Cancelled', '#8f897d'] };
const LEVEL = { verbal: ['Verbal', '#e6e0d4'], written: ['Written', '#e8b84a'], final: ['Final', '#ff6b6b'] };

export default function TeamDesk() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = ['messages', 'leave', 'warnings'].includes(params.get('tab')) ? params.get('tab') : 'messages';
  const [inbox, setInbox] = useState([]);
  const [leave, setLeave] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const load = useCallback(() => {
    api.get('/inbox').then(setInbox).catch(() => setInbox([]));
    api.get('/leave').then(setLeave).catch(() => setLeave([]));
    api.get('/warnings').then(setWarnings).catch(() => setWarnings([]));
  }, []);
  useEffect(load, [load]);
  useSocketEvent('staff-message:new', load);

  const unread = inbox.reduce((s, x) => s + x.unread, 0);
  const toDecide = leave.filter((l) => l.status === 'pending').length;
  const away = leave.filter((l) => l.status === 'approved' && l.from <= moment().format('YYYY-MM-DD') && l.to >= moment().format('YYYY-MM-DD')).length;
  const unacked = warnings.filter((w) => !w.acknowledgedAt).length;
  const kpis = [
    { icon: 'forum', c: '#5b8ff0', n: unread, l: 'Unread messages', onClick: () => setParams({ tab: 'messages' }) },
    { icon: 'beach_access', c: '#e8b84a', n: toDecide, l: 'Time off to decide', onClick: () => setParams({ tab: 'leave' }) },
    { icon: 'event_busy', c: '#3fd283', n: away, l: 'Away today' },
    { icon: 'report', c: '#ff6b6b', n: unacked, l: 'Warnings not yet read', onClick: () => setParams({ tab: 'warnings' }) },
  ];

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={190} />
      <Toolbar>
        <Tabs value={tab} onChange={(t) => setParams({ tab: t })} options={[['messages', `Messages${unread ? ` (${unread})` : ''}`], ['leave', `Time off${toDecide ? ` (${toDecide})` : ''}`], ['warnings', 'Warnings']]} />
      </Toolbar>
      {tab === 'messages' ? <MessagesTab inbox={inbox} reload={load} toast={toast} initial={Number(params.get('staff')) || null} /> : null}
      {tab === 'leave' ? <LeaveTab leave={leave} reload={load} toast={toast} /> : null}
      {tab === 'warnings' ? <WarningsTab warnings={warnings} reload={load} toast={toast} /> : null}
    </div>
  );
}

function Photos({ list }) {
  if (!list?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      {list.map((p) => (
        <a key={p.url} href={mediaUrl(p.url)} target="_blank" rel="noreferrer">
          <img src={mediaUrl(p.url)} alt={p.name || 'Photo'} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
        </a>
      ))}
    </div>
  );
}

function MessagesTab({ inbox, reload, toast, initial }) {
  const [sel, setSel] = useState(initial);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState('');
  const [newTo, setNewTo] = useState(null);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const end = useRef(null);
  const current = sel || inbox[0]?.id || null;

  const open = useCallback(
    (id) => {
      if (!id) return;
      api.get(`/messages/${id}`).then((t) => {
        setThread(t);
        reload();
      }).catch((e) => toast(e.message, 'error'));
    },
    [reload, toast],
  );
  useEffect(() => open(current), [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [thread]);
  useSocketEvent('staff-message:new', (e) => {
    if (e?.staffId === current) open(current);
  });

  const attach = async (e) => {
    const picked = [...(e.target.files || [])].slice(0, 6);
    e.target.value = '';
    try {
      for (const f of picked) {
        const form = new FormData();
        form.append('file', f);
        const r = await client.post('/attachments', form).then((x) => x.data);
        setFiles((xs) => [...xs, r.attachment]);
      }
    } catch (x) {
      toast(x.message, 'error');
    }
  };
  const send = () =>
    api
      .post(`/messages/${current}`, { body, attachments: files })
      .then(() => {
        setBody('');
        setFiles([]);
        open(current);
      })
      .catch((e) => toast(e.message, 'error'));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 14, alignItems: 'start' }} className="team-desk">
      <section className="card" style={{ gap: 6, padding: 10 }}>
        <label className="col" style={{ gap: 4, fontSize: 12, color: 'var(--muted)', padding: '0 4px 8px' }}>
          Write to a team member
          <AssignPicker department={null} allowSuggest={false} value={newTo} onChange={(id) => { setNewTo(id); if (id) setSel(id); }} />
        </label>
        {!inbox.length ? <span className="sub" style={{ padding: 6 }}>No conversations yet. The team writes from My work → Messages.</span> : null}
        {inbox.map((x) => (
          <button
            key={x.id}
            type="button"
            className="hov-row"
            onClick={() => setSel(x.id)}
            style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '8px 6px', border: 0, borderRadius: 6, background: x.id === current ? 'rgba(47,111,232,.18)' : 'transparent', color: 'var(--text)', cursor: 'pointer', font: 'inherit' }}
          >
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: x.unread ? 600 : 400 }}>{x.name}</span>
              <span className="sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.last.fromStaff ? '' : 'You: '}{x.last.body}</span>
            </div>
            <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
              <span className="sub" style={{ fontSize: 11 }}>{moment(x.last.at).fromNow(true)}</span>
              {x.unread ? <span style={{ background: '#ff6b6b', color: '#fff', borderRadius: 99, fontSize: 11, padding: '0 6px' }}>{x.unread}</span> : null}
            </div>
          </button>
        ))}
      </section>

      <section className="card" style={{ gap: 10, minHeight: 420 }}>
        {!thread ? <Empty icon="forum" title="Choose a conversation">Messages from the team appear here; they are notified when you answer.</Empty> : (
          <>
            <span className="card-title">{thread.staff.name}<span className="sub" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}> · {[thread.staff.jobTitle, thread.staff.department].filter(Boolean).join(' · ')}</span></span>
            <div className="col" style={{ gap: 8, maxHeight: 460, overflowY: 'auto', padding: 4 }}>
              {!thread.messages.length ? <span className="sub">No messages yet — say hello.</span> : null}
              {thread.messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.fromStaff ? 'flex-start' : 'flex-end', maxWidth: '78%', background: m.fromStaff ? 'rgba(255,255,255,.06)' : 'rgba(232,184,74,.16)', borderRadius: 12, padding: '8px 12px', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                  {!m.fromStaff ? <div className="sub" style={{ fontSize: 11, color: 'var(--gold)' }}>{m.sender}</div> : null}
                  {m.about ? <div className="sub" style={{ fontSize: 12 }}><Icon name="link" size={13} /> {m.about.kind === 'request' ? 'Request' : 'Work order'}: {m.about.title}</div> : null}
                  {m.body}
                  <Photos list={m.attachments} />
                  <div className="sub" style={{ fontSize: 11 }}>{moment(m.at).format('D MMM HH:mm')}{!m.fromStaff && m.read ? ' · read' : ''}</div>
                </div>
              ))}
              <div ref={end} />
            </div>
            <div className="col" style={{ gap: 8, marginTop: 'auto' }}>
              {files.length ? <Photos list={files} /> : null}
              <textarea className="kit-input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Answer ${thread.staff.name}…`} aria-label="Message" style={{ padding: 10, font: 'inherit', fontSize: 14 }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="fay-btn-outline" onClick={() => fileRef.current?.click()}><Icon name="photo_camera" size={16} /> Photo</button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={attach} />
                <button type="button" className="btn-gold" disabled={!body.trim() && !files.length} onClick={send}><Icon name="send" size={16} /> Send</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function LeaveTab({ leave, reload, toast }) {
  const decide = (l, decision) => {
    let reason = '';
    if (decision === 'reject') {
      reason = window.prompt(`Why can't ${l.staff.name} have these days? They read it.`, '');
      if (!reason) return;
    }
    api
      .post(`/leave/${l.id}/${decision}`, { reason })
      .then(() => {
        toast(decision === 'approve' ? `Approved — ${l.staff.name} is told` : 'Declined — they are told why');
        reload();
      })
      .catch((e) => toast(e.message, 'error'));
  };
  return (
    <section className="card kit-scroll" style={{ padding: 6 }}>
      {!leave.length ? <Empty icon="beach_access" title="No time off asked">The team asks from My work → Time off; HQ → Approvals sees the same requests.</Empty> : (
        <table className="kit-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Team member</th><th>Kind</th><th>Days</th><th>Why</th><th>Status</th><th /></tr></thead>
          <tbody>
            {leave.map((l) => (
              <tr key={l.id}>
                <td>{l.staff.name}<div className="sub">asked {moment(l.requestedAt).fromNow()}</div></td>
                <td>{l.type}</td>
                <td>{moment(l.from).format('ddd D MMM')} → {moment(l.to).format('ddd D MMM')}<div className="sub">{l.days} day{l.days > 1 ? 's' : ''}</div></td>
                <td style={{ maxWidth: 260 }}>{l.reason}{l.rejectionReason ? <div className="sub" style={{ color: '#ff6b6b' }}>{l.rejectionReason}</div> : null}</td>
                <td><Pill tone={LEAVE[l.status]?.[1]}>{LEAVE[l.status]?.[0] || l.status}</Pill>{l.decidedBy ? <div className="sub">{l.decidedBy}</div> : null}</td>
                <td>
                  {l.status === 'pending' ? (
                    <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-gold" onClick={() => decide(l, 'approve')}>Approve</button>
                      <button type="button" className="fay-btn-outline" onClick={() => decide(l, 'reject')}>Decline</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function WarningsTab({ warnings, reload, toast }) {
  const [form, setForm] = useState(null);
  const input = { padding: '9px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--input-bg)', color: 'var(--text)', font: 'inherit', fontSize: 14 };
  return (
    <div className="stack">
      <section className="card" style={{ gap: 10 }}>
        <span className="card-title">Give a warning</span>
        <span className="sub">The team member sees it in My work → Me with your reason, and acknowledges it (they can add their side). Kept on their record.</span>
        {form ? (
          <div className="col" style={{ gap: 8, maxWidth: 560 }}>
            <AssignPicker department={null} allowSuggest={false} value={form.staffId} onChange={(id) => setForm({ ...form, staffId: id })} />
            <select style={input} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} aria-label="Level">
              <option value="verbal">Verbal warning (recorded)</option>
              <option value="written">Written warning</option>
              <option value="final">Final warning</option>
            </select>
            <textarea style={input} rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="What happened, and what you expect from now on" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="fay-btn-outline" onClick={() => setForm(null)}>Cancel</button>
              <button
                type="button"
                className="btn-gold"
                disabled={!form.staffId || !form.reason.trim()}
                onClick={() =>
                  api
                    .post('/warnings', form)
                    .then(() => {
                      toast('Warning given — they are notified');
                      setForm(null);
                      reload();
                    })
                    .catch((e) => toast(e.message, 'error'))
                }
              >
                Give warning
              </button>
            </div>
          </div>
        ) : (
          <div><button type="button" className="fay-btn-outline" onClick={() => setForm({ staffId: null, level: 'verbal', reason: '' })}><Icon name="report" size={16} /> New warning</button></div>
        )}
      </section>
      <section className="card kit-scroll" style={{ padding: 6 }}>
        {!warnings.length ? <Empty icon="verified" title="No warnings">Nobody has been given a warning.</Empty> : (
          <table className="kit-table" style={{ minWidth: 720 }}>
            <thead><tr><th>Team member</th><th>Level</th><th>Reason</th><th>Their side</th><th>Given</th></tr></thead>
            <tbody>
              {warnings.map((w) => (
                <tr key={w.id}>
                  <td>{w.staff?.name}</td>
                  <td><Pill tone={LEVEL[w.level][1]}>{LEVEL[w.level][0]}</Pill></td>
                  <td style={{ maxWidth: 300 }}>{w.reason}</td>
                  <td style={{ maxWidth: 260 }}>{w.acknowledgedAt ? (w.response ? `“${w.response}”` : <span className="sub">Read, no comment</span>) : <span className="sub" style={{ color: '#e8b84a' }}>Not read yet</span>}</td>
                  <td>{moment(w.at).format('D MMM YYYY')}<div className="sub">{w.by}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
