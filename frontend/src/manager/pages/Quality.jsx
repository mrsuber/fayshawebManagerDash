import moment from 'moment';
import { useState } from 'react';
import { opsApi } from '../api';
import { Empty, Pill, Tabs, TextInput, Toolbar } from '../components/kit';
import { Bar, Icon, KpiGrid } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useNav from '../hooks/useNav';
import useSocketEvent from '../hooks/useSocketEvent';

const stars = (n) => `${'★'.repeat(Math.round(n || 0))}${'☆'.repeat(5 - Math.round(n || 0))}`;
const CONTEXT = { request: 'Request', housekeeping: 'Housekeeping', dining: 'Dining', wellness: 'Wellness', transfer: 'Ride', loan: 'Equipment', stay: 'Stay' };

/** Guest ratings of the team, low scores to follow up, and housekeeping inspection results. */
export default function Quality() {
  const toast = useToast();
  const navigate = useNav();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('low');
  const summary = useApi(() => opsApi.qualitySummary(days), [days], null);
  const ratings = useApi(() => opsApi.ratings({ days, max: tab === 'low' ? 2 : 5 }), [days, tab], []);
  const inspections = useApi(() => opsApi.inspections(days), [days], []);
  const [editing, setEditing] = useState(null);
  const [followUp, setFollowUp] = useState('');
  useSocketEvent('rating:new', () => {
    summary.reload();
    ratings.reload();
  });

  const s = summary.data || {};
  const o = s.overall || {};
  const ins = s.inspections || {};
  const kpis = [
    { icon: 'star', c: '#e8b84a', n: o.avg ? `${o.avg} / 5` : '—', l: `Average (${o.n || 0} ratings)` },
    { icon: 'sentiment_satisfied', c: '#3fd283', n: o.n ? `${Math.round((o.happy / o.n) * 100)}%` : '—', l: '4 or 5 stars' },
    { icon: 'report', c: '#ff6b6b', n: o.open_low || 0, l: 'Low ratings to follow up', dc: '#ff6b6b' },
    { icon: 'fact_check', c: '#5b8ff0', n: ins.n ? `${Math.round((ins.passed / ins.n) * 100)}%` : '—', l: `Inspections passed first time (${ins.n || 0})` },
  ];

  const save = (r, status) =>
    opsApi
      .updateRating(r.id, { status, followUp: followUp || undefined })
      .then(() => {
        setEditing(null);
        setFollowUp('');
        ratings.reload();
        summary.reload();
        toast(status === 'followed_up' ? 'Follow-up recorded' : 'Marked as seen');
      })
      .catch((e) => toast(e.message, 'error'));

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={190} />
      <Toolbar right={<Tabs value={days} onChange={setDays} options={[[7, '7 days'], [30, '30 days'], [90, '90 days']]} />}>
        <Tabs value={tab} onChange={setTab} options={[['low', 'Low ratings'], ['all', 'All ratings'], ['team', 'Team'], ['inspections', 'Inspections']]} />
      </Toolbar>

      {tab === 'team' ? (
        <div className="grid-cols">
          <section className="card" style={{ gap: 10 }}>
            <span className="card-title">Team members</span>
            {(s.people || []).length === 0 ? <span className="sub">Ratings appear once guests rate services served by a named team member.</span> : null}
            {(s.people || []).map((p) => (
              <div key={`${p.name}-${p.staff_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <span>{p.name}<div className="sub">{p.department || '—'} · {p.n} rating{p.n > 1 ? 's' : ''}{p.low ? ` · ${p.low} low` : ''}</div></span>
                <Bar value={`${(p.avg / 5) * 100}%`} color={p.avg >= 4 ? 'var(--green-bright)' : p.avg >= 3 ? 'var(--gold)' : 'var(--red-soft)'} />
                <span style={{ textAlign: 'right' }}>{p.avg}</span>
              </div>
            ))}
          </section>
          <section className="card" style={{ gap: 10 }}>
            <span className="card-title">Departments</span>
            {(s.departments || []).map((d) => (
              <div key={d.department} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <span>{d.department}<div className="sub">{d.n} rating{d.n > 1 ? 's' : ''}</div></span>
                <Bar value={`${(d.avg / 5) * 100}%`} />
                <span style={{ textAlign: 'right' }}>{d.avg}</span>
              </div>
            ))}
            <span className="card-title" style={{ marginTop: 10 }}>Housekeepers (inspection score)</span>
            {(s.cleaners || []).length === 0 ? <span className="sub">No inspections yet.</span> : null}
            {(s.cleaners || []).map((c) => (
              <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <span>{c.name}<div className="sub">{c.passed}/{c.n} passed first time</div></span>
                <Bar value={`${((c.avg || 0) / 5) * 100}%`} />
                <span style={{ textAlign: 'right' }}>{c.avg ?? '—'}</span>
              </div>
            ))}
          </section>
        </div>
      ) : tab === 'inspections' ? (
        <section className="card kit-scroll" style={{ padding: 6 }}>
          {(inspections.data || []).length === 0 ? <Empty icon="fact_check" title="No inspections yet">In Housekeeping, residences waiting for inspection open a checklist; passing it makes the residence Ready.</Empty> : null}
          {(inspections.data || []).length ? (
            <table className="kit-table" style={{ minWidth: 700 }}>
              <thead><tr><th>When</th><th>Residence</th><th>Cleaned by</th><th>Inspector</th><th>Score</th><th>Result</th></tr></thead>
              <tbody>
                {inspections.data.map((i) => (
                  <tr key={i.id}>
                    <td>{moment(i.at).format('D MMM HH:mm')}</td>
                    <td>{i.residence}</td>
                    <td>{i.cleanedBy || '—'}</td>
                    <td>{i.inspector}</td>
                    <td style={{ color: 'var(--gold)' }}>{i.score ? stars(i.score) : '—'}</td>
                    <td>
                      <Pill tone={i.passed ? '#3fd283' : '#ff6b6b'}>{i.passed ? 'Passed' : 'Re-clean'}</Pill>
                      {!i.passed ? <div className="sub">{(i.checklist || []).filter((c) => !c.ok).map((c) => c.item).join(', ')}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : (
        <section className="card" style={{ padding: 6 }}>
          {(ratings.data || []).length === 0 && !ratings.loading ? (
            <Empty icon="reviews" title={tab === 'low' ? 'No low ratings' : 'No ratings yet'}>Guests rate requests, meals, equipment and their stay from the app.</Empty>
          ) : null}
          {(ratings.data || []).map((r) => (
            <div key={r.id} className="kit-row" style={{ cursor: 'default', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: r.rating <= 2 ? 'var(--red-soft)' : 'var(--gold)', fontSize: 17, letterSpacing: 2 }}>{stars(r.rating)}</span>
                <span style={{ flex: 1 }}>
                  {CONTEXT[r.context] || r.context}
                  {r.staff ? ` · ${r.staff}` : ''} · <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${r.guestId}`)}>{r.guest}</button>
                  {r.residence ? ` · ${r.residence}` : ''}
                </span>
                <span className="sub">{moment(r.createdAt).fromNow()}</span>
                <Pill tone={r.status === 'followed_up' ? '#3fd283' : r.status === 'seen' ? '#5b8ff0' : '#e8b84a'}>{r.status === 'followed_up' ? 'Followed up' : r.status === 'seen' ? 'Seen' : 'New'}</Pill>
              </div>
              {r.comment ? <div className="kit-message" style={{ fontSize: 14 }}>“{r.comment}”</div> : null}
              {r.followUp ? <span className="sub">Follow-up: {r.followUp}</span> : null}
              {editing === r.id ? (
                <div className="col" style={{ gap: 8 }}>
                  <TextInput label="What was done" multiline rows={2} value={followUp} onChange={setFollowUp} placeholder="Called the guest, offered a complimentary spa session…" />
                  <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="fay-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                    <button type="button" className="btn-gold" disabled={!followUp.trim()} onClick={() => save(r, 'followed_up')}>Record follow-up</button>
                  </div>
                </div>
              ) : r.status !== 'followed_up' ? (
                <div className="kit-actions">
                  <button type="button" className="fay-btn-outline" onClick={() => { setEditing(r.id); setFollowUp(''); }}><Icon name="support_agent" size={18} /> Follow up</button>
                  {r.status === 'new' ? <button type="button" className="fay-btn-outline" onClick={() => save(r, 'seen')}>Mark seen</button> : null}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
