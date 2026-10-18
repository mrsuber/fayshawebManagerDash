import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import moment from 'moment';
import { useState } from 'react';

import { aiApi, guestsApi, reservationsApi, serviceRequestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Card, Icon, MediaCard, Placeholder, QuickActions } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import { money } from './guest360/format';
import useNav from '../hooks/useNav';

// Answers come from POST /ai/ask; alerts, priorities and KPIs come from the API too (see docs/API.md).
const QUICK = [
  { icon: 'crown', c: '#e8b84a', l: 'VIP Arrivals', to: '/reservations' },
  { icon: 'chat', c: '#5b8ff0', l: 'Guest Requests', to: '/requests' },
  { icon: 'cleaning_services', c: '#3fd283', l: 'Housekeeping', to: '/housekeeping' },
  { icon: 'build', c: '#e6e0d4', l: 'Maintenance', to: '/maintenance' },
  { icon: 'spa', c: '#9b7bf0', l: 'Spa & Wellness', to: '/wellness' },
  { icon: 'restaurant', c: '#e8b84a', l: 'Dining', to: '/dining' },
  { icon: 'sailing', c: '#4fc3f7', l: 'Experiences', to: '/experiences' },
  { icon: 'groups', c: '#9b7bf0', l: 'Staff', to: '/settings?section=team' },
];
const SEVERITY_COLOR = { High: '#ff6b6b', Medium: '#e8b84a', Low: '#5b8ff0' };
const PRIORITY_STYLE = { High: ['#c43a3a', '#fff'], Medium: ['#e8c46a', '#1a1408'], Low: ['#1f7a48', '#fff'] };
const INSIGHTS = [
  { img: 'pool club', t: 'Increase Pool Club Capacity', d: 'High demand expected this weekend. Consider extending hours.', cta: 'Implement', task: 'Extend Pool Club hours this weekend', level: 'Medium' },
  { img: 'spa', t: 'Personalized Wellness Offers', d: '3 in-house guests may be interested in recovery treatments.', cta: 'Create Offers', task: 'Send recovery offers to 3 in-house guests', level: 'High', to: '/wellness' },
  { img: 'dining', t: 'Boost In-Residence Dining', d: 'Feedback suggests interest in themed dinners.', cta: 'Plan Experience', task: 'Plan a themed in-residence dinner menu', level: 'Low', to: '/dining' },
];
const STAFF = [
  ['cleaning_services', 'Housekeeping', '18/20', '90%', '#1f9d55', '/housekeeping'],
  ['build', 'Maintenance', '6/8', '75%', '#2f6fe8', '/maintenance'],
  ['spa', 'Spa & Wellness', '12/14', '86%', '#9b7bf0', '/wellness'],
  ['restaurant', 'Dining & F&B', '16/18', '89%', '#e8b84a', '/dining'],
  ['sailing', 'Experiences', '10/12', '83%', '#3fd283', '/experiences'],
];
const CAMS = ['Arrival Court', 'Pool Club', 'Wellness & Spa', 'Dining Area', 'Residences', 'Marina', 'Beach Front', 'Main Gate', 'Parking', 'Smart Locker Hub'];

export default function AICommand() {
  const navigate = useNav();
  const alerts = useCollection('aiAlerts');
  const priorities = useCollection('aiPriorities');
  const guests = useApi(() => guestsApi.list(), [], []);
  const reservations = useApi(() => reservationsApi.list(), [], []);
  const requests = useApi(() => serviceRequestsApi.list(), [], []);
  const [view, setView] = useState(null);
  const [camera, setCamera] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(true);
  const [thinking, setThinking] = useState(false);
  const ask = (t) => {
    setQ(t);
    setThinking(true);
    aiApi
      .ask(t)
      .then((r) => setAnswer(r.answer))
      .catch((e) => setAnswer(e.message))
      .finally(() => setThinking(false));
  };
  // ---- live KPIs ----
  const g = guests.data || [];
  const inHouse = g.filter((x) => x.status === 'In House').length;
  const live = (reservations.data || []).filter((r) => r.status !== 'Cancelled');
  const reqs = requests.data || [];
  const kpis = [
    { icon: 'bed', c: '#3fd283', l: 'Guests In House', n: String(inHouse), d: `${g.filter((x) => x.status === 'Arriving').length} arriving today` },
    { icon: 'payments', c: '#e8b84a', l: 'Booked Revenue', n: money(live.reduce((t, r) => t + (r.totalAmount || 0), 0)), d: `${live.length} reservations` },
    { icon: 'star', c: '#e8b84a', l: 'Guest Satisfaction', n: '4.8 / 5', d: '↑ 0.3' },
    { icon: 'task_alt', c: '#3fd283', l: 'Service Completion', n: `${reqs.length ? Math.round((reqs.filter((r) => r.status === 'Completed').length / reqs.length) * 100) : 0}%`, d: `${reqs.filter((r) => r.status !== 'Completed').length} open requests` },
    { icon: 'groups', c: '#5b8ff0', l: 'Known Guests', n: String(g.length), d: `${g.filter((x) => x.vip).length} VIP` },
  ];
  const openAlerts = alerts.items.filter((a) => a.status === 'Open');
  const alertRow = (a) => (
    <div key={a.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 10, alignItems: 'start', padding: '7px 0', opacity: a.status === 'Open' ? 1 : 0.5 }}>
      <Icon name={a.icon} size={24} color={SEVERITY_COLOR[a.severity]} />
      <div className="col hov-row" style={{ cursor: 'pointer' }} onClick={() => navigate(a.link)}>
        <span style={{ fontSize: 14 }}>{a.title}</span>
        <span className="sub">{a.detail}</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{moment(a.raisedAt).fromNow(true)}</span>
      {a.status === 'Open' ? (
        <button type="button" className="mini-btn" title="Resolve" aria-label="Resolve" onClick={() => alerts.update(a.id, { status: 'Resolved' }, 'Alert resolved')}>
          <Icon name="check" size={16} />
        </button>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--green-bright)' }}>Done</span>
      )}
    </div>
  );
  const priorityRow = (p, i) => (
    <div key={p.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0', opacity: p.done ? 0.5 : 1 }}>
      <button
        type="button"
        title={p.done ? 'Reopen' : 'Mark done'}
        onClick={() => priorities.update(p.id, { done: !p.done }, p.done ? 'Priority reopened' : 'Priority completed')}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: p.done ? 'var(--green)' : 'var(--gold)',
          color: 'var(--on-gold)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
        }}
      >
        {p.done ? '✓' : i + 1}
      </button>
      <span style={{ fontSize: 14, textDecoration: p.done ? 'line-through' : 'none' }}>{p.title}</span>
      <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: PRIORITY_STYLE[p.level][0], color: PRIORITY_STYLE[p.level][1] }}>{p.level}</span>
    </div>
  );
  const applyInsight = (i) => priorities.create({ title: i.task, level: i.level, done: false }, `Added to today's priorities: ${i.task}`).then(() => i.to && navigate(i.to));

  return (
    <div className="stack">
      <div className="grid-cols">
        <Placeholder
          stripe={10}
          style={{
            borderRadius: 10,
            border: '1px solid rgba(232,184,74,.25)',
            minHeight: 300,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <span className="mono-label" style={{ position: 'absolute', top: 10, right: 12 }}>
            FAY avatar portrait
          </span>
          <p className="serif" style={{ margin: 0, fontSize: 21, lineHeight: 1.3, maxWidth: 220, textWrap: 'pretty' }}>
            “I'm FAY, your AI Concierge and Operations Assistant. I turn insights into action, so every guest experience is exceptional.”
          </p>
          <span
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '6px 14px',
              border: '1px solid var(--gold)',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: listening ? '#3fd283' : '#5c6270' }} />
            {listening ? 'Listening…' : 'Mic off'}
          </span>
        </Placeholder>

        <section className="card" style={{ gap: 8 }}>
          <div
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 6px 6px 14px', border: '1px solid var(--border-strong)', borderRadius: 8 }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q.trim()) ask(q.trim());
              }}
              placeholder="How can I help you today?"
              style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 15 }}
            />
            <button
              type="button"
              aria-label={listening ? 'Turn microphone off' : 'Turn microphone on'}
              onClick={() => setListening((l) => !l)}
              className="icon"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid var(--gold)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                fontSize: 24,
                cursor: 'pointer',
              }}
            >
              mic
            </button>
          </div>
          {(answer || thinking) && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(232,184,74,.08)',
                border: '1px solid rgba(232,184,74,.3)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {thinking ? '…' : answer}
            </div>
          )}
          {aiApi.suggestions.map((t) => (
            <span
              key={t}
              onClick={() => ask(t)}
              className="hov-border-gold"
              style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >
              {t}
            </span>
          ))}
        </section>

        <Card title="Quick Actions">
          <QuickActions items={QUICK.map((x) => ({ ...x, onClick: () => navigate(x.to) }))} cols={2} iconSize={22} />
        </Card>

        <Card title={`Live Alerts & Priorities (${openAlerts.length})`} link="View All ›" onLink={() => setView('alerts')} gap={4} headGap={6}>
          {openAlerts.length ? openAlerts.slice(0, 5).map(alertRow) : <span className="sub">All clear.</span>}
        </Card>
      </div>

      {/* KPI tiles here put the label above the number */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {kpis.map((k) => (
          <div key={k.l} className="kpi">
            <Icon name={k.icon} size={34} color={k.c} />
            <div className="col">
              <span className="kpi-l">{k.l}</span>
              <span className="kpi-n">{k.n}</span>
              <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>{k.d}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-cols">
        <Card
          title={`Today's AI Priorities (${priorities.items.filter((p) => !p.done).length} open)`}
          gap={4}
          headGap={6}
          aside={
            <span style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="card-link" onClick={() => setAdding(true)}>
                + Add
              </button>
              <button type="button" className="card-link" onClick={() => setView('priorities')}>
                View All ›
              </button>
            </span>
          }
        >
          {priorities.items.slice(0, 6).map(priorityRow)}
        </Card>

        <Card title="AI Insights & Recommendations">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {INSIGHTS.map((i) => (
              <MediaCard key={i.t} img={i.img} imgHeight={80} bodyPadding={10}>
                <span style={{ fontSize: 14 }}>{i.t}</span>
                <span className="sub" style={{ flex: 1 }}>
                  {i.d}
                </span>
                <button type="button" className="cta-sm" style={{ padding: 6 }} onClick={() => applyInsight(i)}>
                  {i.cta}
                </button>
              </MediaCard>
            ))}
          </div>
        </Card>

        <Card title="Staff & Operations Status" gap={8}>
          {STAFF.map(([icon, n, f, w, c, to]) => (
            <div key={n} className="hov-row" onClick={() => navigate(to)} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 50px 90px 36px', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              <Icon name={icon} size={20} color={c} />
              <span>{n}</span>
              <span style={{ color: 'var(--text-3)' }}>{f}</span>
              <div className="bar">
                <div style={{ width: w, background: c }} />
              </div>
              <span style={{ color: 'var(--text-3)' }}>{w}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Live Resort View" link="View All Cameras ›" onLink={() => setView('cameras')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {CAMS.slice(0, 5).map((c) => (
            <div key={c} className="hov-border-gold" onClick={() => setCamera(c)} style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}>
              <Placeholder label="camera feed" labelSize={9} style={{ height: 100, padding: 5 }} />
              <div className="col" style={{ padding: '8px 10px', gap: 2 }}>
                <span style={{ fontSize: 14 }}>{c}</span>
                <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>● Live</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <ViewAllDialog
        open={view === 'alerts'}
        onClose={() => setView(null)}
        title="Live Alerts"
        items={alerts.items}
        searchText={(a) => `${a.title} ${a.detail}`}
        filters={{ options: ['All', 'Open', 'Resolved', 'High', 'Medium', 'Low'], get: (a) => [a.status, a.severity] }}
        renderItem={alertRow}
      />
      <ViewAllDialog
        open={view === 'priorities'}
        onClose={() => setView(null)}
        title="AI Priorities"
        items={priorities.items}
        searchText={(p) => p.title}
        filters={{ options: ['All', 'Open', 'Done', 'High', 'Medium', 'Low'], get: (p) => [p.done ? 'Done' : 'Open', p.level] }}
        renderItem={(p) => priorityRow(p, priorities.items.indexOf(p))}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setAdding(true)}>
            <Icon name="add" size={18} />
            Add Priority
          </button>
        }
      />
      <ViewAllDialog
        open={view === 'cameras'}
        onClose={() => setView(null)}
        title="All Cameras"
        items={CAMS}
        searchText={(c) => c}
        renderItem={(c) => (
          <div key={c} onClick={() => setCamera(c)} className="hov-border-gold" style={{ display: 'inline-block', width: 'calc(33.3% - 8px)', minWidth: 170, margin: 4, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', verticalAlign: 'top' }}>
            <Placeholder label="camera feed" labelSize={9} style={{ height: 110, padding: 5 }} />
            <div className="col" style={{ padding: '8px 10px', gap: 2 }}>
              <span style={{ fontSize: 14 }}>{c}</span>
              <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>● Live</span>
            </div>
          </div>
        )}
      />
      <Dialog open={!!camera} onClose={() => setCamera(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily: 'var(--serif)', fontSize: 26 }}>
          {camera} <span style={{ fontSize: 13, color: 'var(--green-bright)', fontFamily: 'var(--sans)' }}>● Live · {moment().format('HH:mm:ss')}</span>
        </DialogTitle>
        <DialogContent>
          <Placeholder label="camera feed — connect the CCTV/NVR stream URL here" labelSize={11} style={{ height: 420, borderRadius: 8, padding: 10 }} />
        </DialogContent>
      </Dialog>
      <FormDialog
        open={adding}
        title="Add Priority"
        submitLabel="Add"
        fields={[
          { name: 'title', label: 'Priority', required: true },
          { name: 'level', label: 'Level', type: 'select', options: ['High', 'Medium', 'Low'] },
        ]}
        initial={{ level: 'Medium' }}
        onSubmit={(v) => priorities.create({ ...v, done: false }, 'Priority added')}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
