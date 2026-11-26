import moment from 'moment';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { teamApi } from '../api';
import { minutesText } from '../components/TaskTimer';
import { Ago, Empty, Facts, ListRow, Pill, SearchBox, SplitView, Tabs, Toolbar } from '../components/kit';
import { Bar, Icon, KpiGrid } from '../components/ui';
import useApi from '../hooks/useApi';
import useNav from '../hooks/useNav';
import useSocketEvent from '../hooks/useSocketEvent';

/**
 * FAY OS → Team performance. The whole team with each person's record over a period (work done, on time, guests'
 * ratings, a score), and one person's full work history: every task given to them, how long it took, whether it was
 * checked, and what the guest said. API: /api/manager/team-performance (backend/routes/manager/teamPerformance.js).
 */

const STANDING = { Excellent: '#3fd283', Good: '#5b8ff0', Fair: '#e8b84a', 'Needs attention': '#ff6b6b' };
const KIND = { request: ['Request', 'room_service'], work_order: ['Work order', 'build'], wellness: ['Wellness session', 'spa'] };
const CONTEXT = { request: 'Request', housekeeping: 'Housekeeping', dining: 'Dining', wellness: 'Wellness', transfer: 'Ride', loan: 'Equipment', stay: 'Stay' };
const SORTS = [['score', 'Best first'], ['rating', 'Rating'], ['done', 'Most work'], ['late', 'Late now'], ['name', 'Name']];
const stars = (n) => `${'★'.repeat(Math.round(n || 0))}${'☆'.repeat(5 - Math.round(n || 0))}`;
const ratingTone = (r) => (r >= 4 ? 'var(--green-bright)' : r >= 3 ? 'var(--gold)' : 'var(--red-soft)');

function Standing({ p, big = false }) {
  const tone = STANDING[p.label] || '#8f897d';
  return (
    <Pill tone={tone} style={big ? { fontSize: 14, padding: '4px 12px' } : undefined}>
      {p.score !== null && p.score !== undefined ? `${p.score} · ${p.label}` : p.label}
    </Pill>
  );
}

export default function TeamPerformance() {
  const navigate = useNav();
  const [params, setParams] = useSearchParams();
  const selected = Number(params.get('staff')) || null;
  const [days, setDays] = useState(30);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All');
  const [sort, setSort] = useState('score');
  const team = useApi(() => teamApi.list(days), [days], { people: [] });
  useSocketEvent('rating:new', team.reload);
  useSocketEvent('service-request:updated', team.reload);

  const people = useMemo(() => team.data?.people || [], [team.data]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(people.map((p) => p.department).filter(Boolean))).sort()], [people]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    const by = {
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1) || b.done - a.done,
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.ratings - a.ratings,
      done: (a, b) => b.done - a.done,
      late: (a, b) => b.lateNow - a.lateNow || b.open - a.open,
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return people
      .filter((p) => dept === 'All' || p.department === dept)
      .filter((p) => !words || `${p.name} ${p.department || ''} ${p.jobTitle || ''} ${p.role}`.toLowerCase().includes(words))
      .sort(by);
  }, [people, q, dept, sort]);

  const judged = people.filter((p) => p.score !== null);
  const rated = people.filter((p) => p.ratings);
  const allRatings = rated.reduce((s, p) => s + p.ratings, 0);
  const timed = people.reduce((s, p) => s + p.timed, 0);
  const kpis = [
    { icon: 'task_alt', c: '#3fd283', n: people.reduce((s, p) => s + p.done, 0), l: `Tasks finished (${days} days)` },
    { icon: 'timer', c: '#5b8ff0', n: timed ? `${Math.round((people.reduce((s, p) => s + p.onTime, 0) / timed) * 100)}%` : '—', l: 'Finished on time' },
    { icon: 'star', c: '#e8b84a', n: allRatings ? `${(rated.reduce((s, p) => s + p.rating * p.ratings, 0) / allRatings).toFixed(1)} / 5` : '—', l: `Guests' rating (${allRatings})` },
    { icon: 'running_with_errors', c: '#ff6b6b', n: people.reduce((s, p) => s + p.lateNow, 0), l: 'Tasks late right now', dc: '#ff6b6b' },
    { icon: 'flag', c: '#ff6b6b', n: judged.filter((p) => p.label === 'Needs attention').length, l: 'People needing attention' },
  ];

  const list = (
    <div className="col" style={{ gap: 10 }}>
      <SearchBox value={q} onChange={setQ} placeholder="Search the team…" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="kit-select" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department" style={SELECT}>
          {departments.map((d) => <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>)}
        </select>
        <select className="kit-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={SELECT}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {team.error ? <span className="sub" style={{ color: 'var(--red-soft)' }}>{team.error.message}</span> : null}
      {!team.loading && !shown.length ? <Empty icon="groups" title="Nobody here">Team members appear once they have an account (HQ → Staff).</Empty> : null}
      <div className="col" style={{ gap: 2 }}>
        {shown.map((p) => (
          <ListRow
            key={p.id}
            active={p.id === selected}
            onClick={() => setParams({ staff: String(p.id) })}
            title={p.name}
            meta={[p.jobTitle || p.role, p.department].filter(Boolean).join(' · ')}
            aside={<Standing p={p} />}
          >
            <span className="sub" style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>{p.done} done</span>
              {p.onTimeRate !== null ? <span>{p.onTimeRate}% on time</span> : null}
              {p.rating ? <span style={{ color: ratingTone(p.rating) }}>★ {p.rating.toFixed(1)} ({p.ratings})</span> : <span>no ratings</span>}
              {p.lateNow ? <span style={{ color: 'var(--red-soft)' }}>{p.lateNow} late now</span> : null}
            </span>
          </ListRow>
        ))}
      </div>
    </div>
  );

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={180} />
      <Toolbar right={<Tabs value={days} onChange={setDays} options={[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']]} />}>
        <span className="sub">The score mixes guests’ ratings (60%) and finishing on time (40%), less 5 points per warning in the period.</span>
      </Toolbar>
      <SplitView
        listWidth={380}
        hasSelection={!!selected}
        onBack={() => setParams({})}
        list={list}
        detail={selected ? <Person key={`${selected}-${days}`} id={selected} days={days} navigate={navigate} /> : <Empty icon="person_search" title="Choose a team member">Their work history, timings and what guests said about them.</Empty>}
      />
    </div>
  );
}

const SELECT = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'var(--sans)' };

function Person({ id, days, navigate }) {
  const res = useApi(() => teamApi.get(id, days), [id, days], null);
  const [filter, setFilter] = useState('all');
  const [section, setSection] = useState('history');
  if (res.error) return <Empty icon="error" title="Couldn't load this team member">{res.error.message}</Empty>;
  const d = res.data;
  if (!d) return <div style={{ padding: 30, color: 'var(--muted)' }}>Loading…</div>;
  const { person, period: p, allTime: all } = d;

  const kpis = [
    { icon: 'task_alt', c: '#3fd283', n: p.done, l: `Done in ${days} days (${all.done} in all)` },
    { icon: 'timer', c: '#5b8ff0', n: p.onTimeRate !== null ? `${p.onTimeRate}%` : '—', l: p.avgLateMinutes ? `On time · ${minutesText(p.avgLateMinutes)} late on average when late` : 'On time' },
    { icon: 'hourglass_bottom', c: '#9b7bf0', n: p.avgMinutes !== null ? minutesText(p.avgMinutes) : '—', l: 'Average time per task' },
    { icon: 'star', c: '#e8b84a', n: p.rating ? `${p.rating.toFixed(1)} / 5` : '—', l: `Guests' rating (${p.ratings}${p.lowRatings ? `, ${p.lowRatings} low` : ''})` },
    { icon: 'pending_actions', c: p.lateNow ? '#ff6b6b' : '#e6e0d4', n: p.open, l: p.lateNow ? `Open now · ${p.lateNow} late` : 'Open now' },
    { icon: 'verified', c: '#3fd283', n: p.verified, l: 'Checked by a manager' },
  ];

  const rows = d.history.filter((h) =>
    filter === 'open' ? h.open : filter === 'done' ? !!h.completedAt : filter === 'late' ? h.onTime === false : filter === 'rated' ? !!h.rating : true,
  );
  const totalStars = Object.values(d.stars).reduce((s, n) => s + n, 0);
  const maxMonth = Math.max(1, ...d.months.map((m) => m.done));

  return (
    <div className="col" style={{ gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: 6, flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="serif" style={{ fontSize: 30, fontWeight: 600 }}>{person.name}</span>
            <Standing p={p} big />
            {!person.active ? <Pill tone="#8f897d">Inactive</Pill> : null}
          </div>
          <span className="sub">{[person.jobTitle, person.department, person.role].filter(Boolean).join(' · ')}</span>
          <Facts items={[['Email', person.email], ['Phone', person.phone], ['With Faysha since', person.since ? moment(person.since).format('D MMM YYYY') : null], ['Last task finished', p.lastDoneAt ? <Ago at={p.lastDoneAt} /> : 'Not yet']]} />
        </div>
        <div className="kit-actions">
          <button type="button" className="fay-btn-outline" onClick={() => navigate(`/team?tab=messages&staff=${person.id}`)}><Icon name="chat" size={18} /> Message</button>
          <button type="button" className="fay-btn-outline" onClick={() => navigate('/team?tab=warnings')}><Icon name="report" size={18} /> Warnings</button>
        </div>
      </div>

      <KpiGrid items={kpis} min={150} />

      <div className="grid-cols">
        <section className="card" style={{ gap: 8 }}>
          <span className="card-title">What guests gave (all time)</span>
          {!totalStars ? <span className="sub">No ratings yet. Guests rate a task in the app once it is done.</span> : null}
          {totalStars ? [5, 4, 3, 2, 1].map((n) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 36px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--gold)' }}>{'★'.repeat(n)}</span>
              <Bar value={`${(d.stars[n] / totalStars) * 100}%`} color={n >= 4 ? 'var(--green-bright)' : n === 3 ? 'var(--gold)' : 'var(--red-soft)'} />
              <span style={{ textAlign: 'right' }}>{d.stars[n]}</span>
            </div>
          )) : null}
        </section>
        <section className="card" style={{ gap: 8 }}>
          <span className="card-title">Last 6 months</span>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.months.length}, 1fr)`, gap: 8, alignItems: 'end', height: 120 }}>
            {d.months.map((m) => (
              <div key={m.month} className="col" style={{ gap: 4, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${m.done} done · ${m.onTimeRate ?? '—'}% on time · rating ${m.rating ?? '—'}`}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.done}</span>
                <div style={{ width: '70%', height: `${Math.max(3, (m.done / maxMonth) * 80)}px`, background: 'var(--gold)', borderRadius: 3, opacity: m.done ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.months.length}, 1fr)`, gap: 8, fontSize: 11, textAlign: 'center' }}>
            {d.months.map((m) => (
              <div key={m.month} className="col" style={{ gap: 2 }}>
                <span>{moment(`${m.month}-01`).format('MMM')}</span>
                <span style={{ color: m.rating ? ratingTone(m.rating) : 'var(--dim)' }}>{m.rating ? `★ ${m.rating.toFixed(1)}` : '—'}</span>
                <span className="sub">{m.onTimeRate !== null ? `${m.onTimeRate}%` : '—'}</span>
              </div>
            ))}
          </div>
          <span className="sub" style={{ fontSize: 11 }}>Bars: tasks finished · ★ guests' rating · % on time</span>
        </section>
      </div>

      <Tabs
        value={section}
        onChange={setSection}
        options={[['history', 'Work history', d.history.length], ['ratings', 'Guest ratings', d.ratings.length], ['warnings', 'Warnings', d.warnings.length], ['attendance', 'Attendance']]}
      />

      {section === 'history' ? (
        <div className="col" style={{ gap: 10 }}>
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              ['all', 'All'],
              ['open', 'Open', d.history.filter((h) => h.open).length],
              ['done', 'Done'],
              ['late', 'Late', d.history.filter((h) => h.onTime === false).length],
              ['rated', 'Rated'],
            ]}
          />
          {!rows.length ? <Empty icon="assignment" title="Nothing here">Tasks given to {person.name} appear here: requests, work orders and wellness sessions.</Empty> : null}
          {rows.length ? (
            <div className="kit-scroll">
              <table className="kit-table" style={{ minWidth: 780 }}>
                <thead>
                  <tr><th>Task</th><th>Guest · place</th><th>Given</th><th>Time taken</th><th>Status</th><th>Guest's rating</th></tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={`${h.kind}-${h.id}`}>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Icon name={KIND[h.kind][1]} size={18} color="var(--muted)" />
                          <span>{h.title}</span>
                        </div>
                        <div className="sub" style={{ fontSize: 12 }}>{KIND[h.kind][0]}{h.number ? ` · ${h.number}` : ''}</div>
                        {h.note ? <div className="sub" style={{ fontSize: 12, maxWidth: 280 }}>“{h.note}”</div> : null}
                      </td>
                      <td>
                        {h.guest ? <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${h.guestId}`)}>{h.guest}</button> : '—'}
                        {h.place ? <div className="sub" style={{ fontSize: 12 }}>{h.place}</div> : null}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{h.assignedAt ? moment(h.assignedAt).format('D MMM YYYY, HH:mm') : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {h.takenMinutes !== null ? minutesText(h.takenMinutes) : h.open ? 'Running' : '—'}
                        {h.minutesAllowed ? <div className="sub" style={{ fontSize: 12 }}>of {minutesText(h.minutesAllowed)}</div> : null}
                        {h.onTime === true ? <Pill tone="#3fd283">On time</Pill> : h.onTime === false ? <Pill tone="#ff6b6b">{minutesText(h.lateMinutes)} late</Pill> : null}
                      </td>
                      <td>
                        <Pill tone={h.open ? '#e8b84a' : /cancel|no-show/i.test(h.status) ? '#8f897d' : '#3fd283'}>{h.status}</Pill>
                        {h.verifiedAt ? <div className="sub" style={{ fontSize: 12, marginTop: 4 }}><Icon name="verified" size={14} color="var(--green-bright)" /> Checked{h.verifiedBy ? ` by ${h.verifiedBy}` : ''}</div> : null}
                      </td>
                      <td>
                        {h.rating ? (
                          <>
                            <span style={{ color: ratingTone(h.rating.stars), letterSpacing: 1 }}>{stars(h.rating.stars)}</span>
                            {h.rating.comment ? <div className="sub" style={{ fontSize: 12, maxWidth: 220 }}>“{h.rating.comment}”</div> : null}
                          </>
                        ) : <span className="sub">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'ratings' ? (
        <div className="col" style={{ gap: 2 }}>
          {!d.ratings.length ? <Empty icon="reviews" title="No ratings yet">Guests rate requests, sessions and their stay from the app.</Empty> : null}
          {d.ratings.map((r) => (
            <div key={r.id} className="kit-row" style={{ cursor: 'default', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: ratingTone(r.stars), fontSize: 16, letterSpacing: 2 }}>{stars(r.stars)}</span>
                <span style={{ flex: 1 }}>
                  {r.task || CONTEXT[r.context] || r.context}
                  {r.guest ? <> · <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${r.guestId}`)}>{r.guest}</button></> : null}
                </span>
                <span className="sub"><Ago at={r.at} /></span>
                {r.stars <= 2 ? <Pill tone={r.status === 'followed_up' ? '#3fd283' : '#e8b84a'}>{r.status === 'followed_up' ? 'Followed up' : 'To follow up'}</Pill> : null}
              </div>
              {r.comment ? <div className="kit-message" style={{ fontSize: 14 }}>“{r.comment}”</div> : null}
              {r.followUp ? <span className="sub">Follow-up: {r.followUp}</span> : null}
            </div>
          ))}
          {d.ratings.some((r) => r.stars <= 2 && r.status !== 'followed_up') ? (
            <button type="button" className="fay-btn-outline" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => navigate('/quality')}>
              <Icon name="support_agent" size={18} /> Follow up low ratings in Quality
            </button>
          ) : null}
        </div>
      ) : null}

      {section === 'warnings' ? (
        <div className="col" style={{ gap: 2 }}>
          {!d.warnings.length ? <Empty icon="verified_user" title="No warnings">A clean record.</Empty> : null}
          {d.warnings.map((w) => (
            <div key={w.id} className="kit-row" style={{ cursor: 'default', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pill tone={w.level === 'final' ? '#ff6b6b' : w.level === 'written' ? '#e8b84a' : '#e6e0d4'}>{w.label}</Pill>
                <span style={{ flex: 1 }}>{w.reason}</span>
                <span className="sub">{w.by ? `${w.by} · ` : ''}{moment(w.at).format('D MMM YYYY')}</span>
              </div>
              <span className="sub">{w.acknowledgedAt ? `Read ${moment(w.acknowledgedAt).format('D MMM')}` : 'Not read yet'}{w.response ? ` · Their side: “${w.response}”` : ''}</span>
            </div>
          ))}
        </div>
      ) : null}

      {section === 'attendance' ? (
        <section className="card" style={{ gap: 8 }}>
          <span className="card-title">Last {days} days</span>
          <Facts
            items={[
              ['Days worked', d.attendance.days],
              ['Hours', d.attendance.hours],
              ['Late arrivals', d.attendance.late],
              ['Absences', d.attendance.absent],
            ]}
          />
          <span className="sub" style={{ fontSize: 12 }}>From clock-in and clock-out in My work. Team members without an HR record show nothing here.</span>
        </section>
      ) : null}
    </div>
  );
}
