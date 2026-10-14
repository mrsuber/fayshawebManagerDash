import { useState } from 'react';
import { aiApi } from '../api';
import { Card, CardLink, Icon, MediaCard, Placeholder, QuickActions } from '../components/ui';

// Answers come from POST /ai/ask (see docs/API.md); the panels below are still sample data.
const QUICK = [
  { icon: 'crown', c: '#e8b84a', l: 'VIP Arrivals' },
  { icon: 'chat', c: '#5b8ff0', l: 'Guest Requests' },
  { icon: 'cleaning_services', c: '#3fd283', l: 'Housekeeping' },
  { icon: 'build', c: '#e6e0d4', l: 'Maintenance' },
  { icon: 'spa', c: '#9b7bf0', l: 'Spa & Wellness' },
  { icon: 'restaurant', c: '#e8b84a', l: 'Dining' },
  { icon: 'sailing', c: '#4fc3f7', l: 'Experiences' },
  { icon: 'groups', c: '#9b7bf0', l: 'Staff' },
];
const ALERTS = [
  { icon: 'error', c: '#ff6b6b', t: 'VIP arrival in 2 hours', d: 'Prepare villa, transportation & amenities', time: '10m' },
  { icon: 'error', c: '#ff6b6b', t: 'Riviera 2 – AC below optimal', d: 'Maintenance assigned', time: '28m' },
  { icon: 'warning', c: '#e8b84a', t: 'High spa demand tomorrow', d: 'Recommend extra staff allocation', time: '1h' },
  { icon: 'warning', c: '#e8b84a', t: 'Housekeeping staff shortage', d: 'Request 2 additional staff for Nov 28', time: '2h' },
  { icon: 'info', c: '#5b8ff0', t: 'In-residence dining satisfaction dipping', d: 'Review recent feedback', time: '3h' },
];
const KPIS = [
  { icon: 'bed', c: '#3fd283', l: 'Occupancy Rate', n: '72%', d: '↑ 8%' },
  { icon: 'payments', c: '#e8b84a', l: 'Total Revenue', n: '$48,250', d: '↑ 18%' },
  { icon: 'star', c: '#e8b84a', l: 'Guest Satisfaction', n: '4.8 / 5', d: '↑ 0.3' },
  { icon: 'task_alt', c: '#3fd283', l: 'Service Completion', n: '96%', d: '↑ 6%' },
  { icon: 'groups', c: '#5b8ff0', l: 'Active Guests', n: '124', d: '↑ 12%' },
];
const PRIORITIES = [
  ['Prepare VIP arrivals (3 guests)', 'High'],
  ['Optimize spa staffing for tomorrow', 'High'],
  ['Follow up on outstanding requests (5)', 'Medium'],
  ['Coordinate private dinner at Pool Club', 'Medium'],
  ['Review maintenance alerts (2)', 'Low'],
];
const PRIORITY_STYLE = { High: ['#c43a3a', '#fff'], Medium: ['#e8c46a', '#1a1408'], Low: ['#1f7a48', '#fff'] };
const INSIGHTS = [
  { img: 'pool club', t: 'Increase Pool Club Capacity', d: 'High demand expected this weekend. Consider extending hours.', cta: 'Implement' },
  { img: 'spa', t: 'Personalized Wellness Offers', d: '3 in-house guests may be interested in recovery treatments.', cta: 'Create Offers' },
  { img: 'dining', t: 'Boost In-Residence Dining', d: 'Feedback suggests interest in themed dinners.', cta: 'Plan Experience' },
];
const STAFF = [
  ['cleaning_services', 'Housekeeping', '18/20', '90%', '#1f9d55'],
  ['build', 'Maintenance', '6/8', '75%', '#2f6fe8'],
  ['spa', 'Spa & Wellness', '12/14', '86%', '#9b7bf0'],
  ['restaurant', 'Dining & F&B', '16/18', '89%', '#e8b84a'],
  ['sailing', 'Experiences', '10/12', '83%', '#3fd283'],
];
const CAMS = ['Arrival Court', 'Pool Club', 'Wellness & Spa', 'Dining Area', 'Residences'];

export default function AICommand() {
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
          <QuickActions items={QUICK} cols={2} iconSize={22} />
        </Card>

        <Card title="Live Alerts & Priorities" aside={<CardLink>View All ›</CardLink>} gap={4} headGap={6}>
          {ALERTS.map((a) => (
            <div
              key={a.t}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'start', padding: '7px 0' }}
            >
              <Icon name={a.icon} size={24} color={a.c} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{a.t}</span>
                <span className="sub">{a.d}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{a.time}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* KPI tiles here put the label above the number */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {KPIS.map((k) => (
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
        <Card title="Today's AI Priorities" gap={4} headGap={6}>
          {PRIORITIES.map(([t, l], i) => (
            <div
              key={t}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  color: 'var(--on-gold)',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 14 }}>{t}</span>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: PRIORITY_STYLE[l][0], color: PRIORITY_STYLE[l][1] }}>{l}</span>
            </div>
          ))}
        </Card>

        <Card title="AI Insights & Recommendations">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {INSIGHTS.map((i) => (
              <MediaCard key={i.t} img={i.img} imgHeight={80} bodyPadding={10}>
                <span style={{ fontSize: 14 }}>{i.t}</span>
                <span className="sub" style={{ flex: 1 }}>
                  {i.d}
                </span>
                <span className="cta-sm" style={{ padding: 6 }}>
                  {i.cta}
                </span>
              </MediaCard>
            ))}
          </div>
        </Card>

        <Card title="Staff & Operations Status" gap={8}>
          {STAFF.map(([icon, n, f, w, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 50px 90px 36px', gap: 8, alignItems: 'center', fontSize: 13 }}>
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

      <Card title="Live Resort View" link="View All Cameras ›">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {CAMS.map((c) => (
            <div key={c} style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden' }}>
              <Placeholder label="camera feed" labelSize={9} style={{ height: 100, padding: 5 }} />
              <div className="col" style={{ padding: '8px 10px', gap: 2 }}>
                <span style={{ fontSize: 14 }}>{c}</span>
                <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>● Live</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
