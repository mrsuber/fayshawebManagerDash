import { Avatar, Card, CardLink, Donut, Icon, KpiGrid, MediaCard, QuickActions, VenueTile } from '../components/ui';

// Mock data — replace with API calls.
const SC = { Completed: '#1f9d55', 'In Progress': '#2f6fe8', Upcoming: '#3a3f48', Confirmed: '#7c4ddb', Pending: '#2f6fe8' };
const VENUES = [
  { img: 'thermal suite photo', n: 'FAY Thermal Recovery Suite', d: 'Heat. Cool. Recover.' },
  { img: 'gym photo', n: 'Signature Wellness Club', d: 'Move. Energize. Thrive.' },
  { img: 'treatment room photo', n: 'Spa Treatments', d: 'Rejuvenate. Restore. Renew.' },
  { img: 'float pool photo', n: 'FAY FLOAT', d: 'Floating meditation experience' },
];
const KPIS = [
  { icon: 'event_note', c: '#3fd283', n: '24', l: 'Total Bookings', d: '↑ 20%' },
  { icon: 'person', c: '#5b8ff0', n: '6', l: 'In Progress', d: '↑ 0%' },
  { icon: 'verified', c: '#3fd283', n: '15', l: 'Completed Today', d: '↑ 36%' },
  { icon: 'hourglass_top', c: '#9b7bf0', n: '3', l: 'Waitlist', d: '—' },
  { icon: 'speed', c: '#e8b84a', n: '92%', l: 'Facility Utilization', d: '↑ 18%' },
  { icon: 'star', c: '#e8b84a', n: '9.6', l: 'Guest Satisfaction', d: '↑ 4%' },
];
const SCHEDULE = [
  ['09:00', '10:00', 'Deep Tissue Massage', 'Sophie Laurent', 'Treatment Room 1', 'Completed'],
  ['10:00', '11:30', 'FAY Thermal Recovery', 'Abba Abdouraman', 'Recovery Suite', 'In Progress'],
  ['11:00', '12:00', 'Yoga & Breathwork', 'James & Anna', 'Wellness Club', 'In Progress'],
  ['12:00', '13:00', 'Signature Facial', 'Elena Petrova', 'Treatment Room 2', 'Upcoming'],
  ['14:00', '15:00', 'Red Light Therapy', 'Michael Chen', 'Recovery Suite', 'Upcoming'],
  ['15:30', '16:30', 'Couples Massage', 'David & Grace', 'Treatment Room 1', 'Upcoming'],
  ['17:00', '18:00', 'Meditation Float', 'Richard Thompson', 'FAY FLOAT', 'Upcoming'],
  ['18:30', '19:30', 'Hot Stone Massage', 'Marie T.', 'Treatment Room 3', 'Upcoming'],
];
const dotColor = (s) => (s === 'Completed' ? '#e8b84a' : s === 'In Progress' ? '#2f6fe8' : '#5c6270');
const RINGS = [
  { n: 'Spa', d: '4/5 rooms', v: '85%', c: '#3fd283' },
  { n: 'Recovery Suite', d: '7/10 slots', v: '70%', c: '#2f6fe8' },
  { n: 'Wellness Club', d: '46/50 capacity', v: '92%', c: '#1f9d55' },
  { n: 'FAY FLOAT', d: '12/20', v: '60%', c: '#e8b84a' },
];
const RECS = [
  { t: 'Morning Recovery Session', d: 'Based on wellness preferences and activity level' },
  { t: 'Sunset Float Experience', d: 'Popular with guests this week' },
  { t: 'Signature Massage', d: 'Available this evening' },
];
const PREFS = [
  { icon: 'spa', c: '#4fc3f7', t: 'Wellness & Recovery', d: 'Spa, FAY FLOAT, movement, sleep' },
  { icon: 'healing', c: '#9b7bf0', t: 'Preferred Treatments', d: 'Massage, red light therapy, hydrotherapy' },
  { icon: 'schedule', c: '#e8b84a', t: 'Preferred Time', d: 'Morning' },
  { icon: 'flag', c: '#3fd283', t: 'Goals', d: 'Recovery, relaxation, better sleep' },
];
const PACKAGES = [
  { t: 'FAY Recovery Package', d: 'Nov 29, 10:00 – 12:00', s: 'Confirmed' },
  { t: 'Couples Wellness Ritual', d: 'Nov 29, 16:00 – 18:00', s: 'Pending' },
];
const QUICK = [
  { icon: 'spa', c: '#9b7bf0', l: 'Book Treatment' },
  { icon: 'hot_tub', c: '#4fc3f7', l: 'Book Recovery' },
  { icon: 'pool', c: '#4fc3f7', l: 'Book FAY FLOAT' },
  { icon: 'redeem', c: '#f06292', l: 'Packages' },
  { icon: 'event_available', c: '#5b8ff0', l: 'Availability' },
  { icon: 'edit_calendar', c: '#e6e0d4', l: 'Manage Booking' },
];

export default function Wellness() {
  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {VENUES.map((v) => (
          <VenueTile key={v.n} {...v} height={170} />
        ))}
      </div>

      <KpiGrid items={KPIS} min={160} iconSize={32} />

      <div className="grid-cols">
        <Card title="Today's Schedule" link="View Full Schedule ›" gap={2} headGap={8}>
          {SCHEDULE.map(([a, b, t, g, room, s]) => (
            <div
              key={a + t}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '14px 44px 40px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}
            >
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${dotColor(s)}` }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.3 }}>
                {a}
                <br />
                {b}
              </span>
              <Avatar size={40} style={{ borderRadius: 6 }} />
              <div className="col" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14 }}>{t}</span>
                <span className="sub">
                  {g} · {room}
                </span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>

        <div className="stack">
          <Card title="Facility Utilization" gap={12}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {RINGS.map((r) => (
                <div key={r.n} className="col" style={{ alignItems: 'center', gap: 6, textAlign: 'center' }}>
                  <Donut size={80} inner={62} gradient={`conic-gradient(${r.c} 0 ${r.v},#262a31 ${r.v})`}>
                    <span style={{ fontSize: 16 }}>{r.v}</span>
                  </Donut>
                  <span style={{ fontSize: 13 }}>{r.n}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.d}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="FAY AI Wellness Recommendations" gap={8}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {RECS.map((r) => (
                <MediaCard key={r.t}>
                  <span style={{ fontSize: 13 }}>{r.t}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{r.d}</span>
                  <span className="cta-sm">Recommend</span>
                </MediaCard>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Guest Wellness Profile" aside={<CardLink>Edit ›</CardLink>} gap={6}>
            <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Abba Abdouraman · Serenity 1</span>
            {PREFS.map((p) => (
              <div key={p.t} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                <Icon name={p.icon} size={22} color={p.c} />
                <div className="col">
                  <span style={{ fontSize: 14 }}>{p.t}</span>
                  <span className="sub">{p.d}</span>
                </div>
              </div>
            ))}
          </Card>
          <Card title="Upcoming Packages" gap={6}>
            {PACKAGES.map((p) => (
              <div key={p.t} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                <Icon name="spa" size={26} color="var(--purple)" />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 14 }}>{p.t}</span>
                  <span className="sub">{p.d}</span>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[p.s] }}>{p.s}</span>
              </div>
            ))}
          </Card>
          <Card title="Quick Actions">
            <QuickActions items={QUICK} />
          </Card>
        </div>
      </div>
    </div>
  );
}
