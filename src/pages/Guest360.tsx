import { useState, type ReactNode } from 'react';
import { Card, Icon, Placeholder, QuickActions } from '../components/ui';

// Mock data — replace with API calls.
const ST: Record<string, [string, string]> = {
  Ready: ['#1f9d55', '#fff'],
  Completed: ['#1f9d55', '#fff'],
  'In Progress': ['#2f6fe8', '#fff'],
  Confirmed: ['#7c4ddb', '#fff'],
  Pending: ['#2f6fe8', '#fff'],
  Scheduled: ['#2f6fe8', '#fff'],
  Delivered: ['#3a3f48', '#e6e0d4'],
  '—': ['transparent', '#8f897d'],
};
const st = (s: string) => ST[s] ?? ST['—'];

const TABS = ['Overview', 'Stay Details', 'Preferences', 'Journey', 'Communications', 'Requests', 'Reservations', 'Wellness', 'Dining', 'Experiences', 'Billing', 'Notes', 'History'];

const ACTIONS_TOP = [
  { icon: 'chat', label: 'Message Guest' },
  { icon: 'assignment_add', label: 'Create Request' },
  { icon: 'expand_more', label: 'More Actions' },
];
const TAGS = ['Wellness & Recovery', 'Fine Dining', 'Outdoor Experiences', 'Business'];
const CONTACT = [
  { icon: 'call', text: '+971 50 123 4567' },
  { icon: 'mail', text: 'abba@domain.com' },
  { icon: 'location_on', text: 'UAE' },
  { icon: 'translate', text: 'English' },
  { icon: 'schedule', text: 'Local Time 18:42' },
];
const VALUE = [
  { n: '$12,450', l: 'Total Revenue (YTD)' },
  { n: '3', l: 'Stays' },
  { n: '9.6 / 10', l: 'Satisfaction' },
];
const PREFS = [
  { icon: 'spa', c: '#3fd283', t: 'Wellness & Recovery', d: 'Spa, FAY FLOAT, movement, sleep optimization' },
  { icon: 'restaurant', c: '#e8b84a', t: 'Dining', d: 'Healthy, seafood, private dining, local cuisine' },
  { icon: 'sailing', c: '#4fc3f7', t: 'Experiences', d: 'Outdoor, cultural, water activities, golf' },
  { icon: 'home', c: '#e6e0d4', t: 'Residence', d: 'High floor, ocean view, quiet, smart residence' },
  { icon: 'forum', c: '#9b7bf0', t: 'Communication', d: 'WhatsApp, email, English, concise updates' },
  { icon: 'redeem', c: '#f06292', t: 'Special Occasions', d: 'Birthday (Dec 5), business meetings' },
];
const LOCKER = [
  { icon: 'deployed_code', c: '#4fc3f7', t: 'Locker 07', d: '1 package ready for collection', s: 'Ready' },
  { icon: 'local_laundry_service', c: '#9b7bf0', t: 'Laundry', d: '2 items in processing', s: 'In Progress' },
  { icon: 'local_shipping', c: '#e8b84a', t: 'Deliveries', d: '1 completed today', s: 'Delivered' },
  { icon: 'autorenew', c: '#3fd283', t: 'Return Items', d: 'No active returns', s: '—' },
  { icon: 'lock', c: '#e8b84a', t: 'Last Access', d: 'Today, 18:42', s: '—' },
];
const REQUESTS = [
  { icon: 'bed', c: '#4fc3f7', t: 'Extra towels', d: 'Housekeeping', time: '18:20', s: 'In Progress' },
  { icon: 'room_service', c: '#e8b84a', t: 'Private dining setup', d: 'Dining', time: '17:10', s: 'Completed' },
  { icon: 'directions_car', c: '#e6e0d4', t: 'Airport transfer (departure)', d: 'Transportation', time: 'Nov 30', s: 'Scheduled' },
];
const BOOKINGS = [
  { icon: 'spa', c: '#9b7bf0', t: 'FAY Thermal Recovery', d: 'Tomorrow, 10:00 AM – 11:30 AM', s: 'Confirmed' },
  { icon: 'restaurant', c: '#e8b84a', t: 'Dinner at Riviera', d: 'Tomorrow, 8:00 PM – 10:00 PM', s: 'Confirmed' },
  { icon: 'sailing', c: '#4fc3f7', t: 'Sunset Yacht Experience', d: 'Nov 30, 4:00 PM – 7:00 PM', s: 'Pending' },
];
const TIMELINE = [
  { time: '18:42', t: 'Delivered – Package at Locker 07', cat: 'Smart Locker' },
  { time: '18:30', t: 'Housekeeping assigned', cat: 'Service Request' },
  { time: '17:10', t: 'Private dining setup completed', cat: 'Dining' },
  { time: '15:05', t: 'Arrived at Faysha', cat: 'Arrival' },
  { time: '14:50', t: 'Digital key activated', cat: 'Residence' },
  { time: 'Nov 27', t: 'Pre-arrival welcome sent', cat: 'Communication' },
];
const HISTORY = [
  { d: 'Nov 28, 2025', r: 'Serenity 1', n: 2, p: 'Leisure', s: '9.6' },
  { d: 'May 12, 2025', r: 'Riviera 1', n: 4, p: 'Business', s: '9.4' },
  { d: 'Jan 18, 2025', r: 'Villa Spectra 2', n: 3, p: 'Leisure', s: '9.8' },
];
const INSIGHTS = [
  'Prefers morning wellness sessions',
  'Has not yet booked a fitness activity this stay',
  'Enjoys seafood and Mediterranean cuisine',
  'Frequently requests late checkout',
  'High satisfaction with personalized experiences',
];
const QUICK = [
  { icon: 'chat', c: '#4fc3f7', l: 'Message Guest' },
  { icon: 'assignment_add', c: '#5b8ff0', l: 'Create Request' },
  { icon: 'spa', c: '#9b7bf0', l: 'Book Wellness' },
  { icon: 'restaurant', c: '#e8b84a', l: 'Book Dining' },
  { icon: 'sailing', c: '#4fc3f7', l: 'Book Experience' },
  { icon: 'manage_accounts', c: '#e6e0d4', l: 'Edit Preferences' },
];

const divider = '1px solid var(--border)';
const histCols = '1.2fr 1.2fr .6fr 1fr .8fr';

function ListRow({ icon, c, t, d, children, iconBox }: { icon: string; c: string; t: string; d: string; children?: ReactNode; iconBox?: boolean }) {
  return (
    <div className="row-line" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '8px 0' }}>
      {iconBox ? (
        <span className="icon" style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', fontSize: 24, color: c }}>
          {icon}
        </span>
      ) : (
        <Icon name={icon} size={24} color={c} />
      )}
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 15 }}>{t}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{d}</span>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ s, minWidth }: { s: string; minWidth?: number }) {
  const [bg, fg] = st(s);
  return <span style={{ padding: '5px 12px', borderRadius: 4, fontSize: 13, minWidth, textAlign: 'center', background: bg, color: fg }}>{s}</span>;
}

export default function Guest360() {
  const [tab, setTab] = useState('Overview');

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {ACTIONS_TOP.map((a) => (
          <div
            key={a.label}
            className="hov-gold-bg"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '1px solid rgba(232,184,74,.4)', borderRadius: 6, fontSize: 15, cursor: 'pointer', background: '#0f1216' }}
          >
            <Icon name={a.icon} size={20} />
            {a.label}
          </div>
        ))}
      </div>

      {/* Profile banner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 14, background: 'var(--surface)', border: divider, borderRadius: 10 }}>
        <Placeholder label="guest portrait" style={{ width: 150, height: 150, borderRadius: 8, display: 'flex', alignItems: 'flex-end', padding: 8 }} />
        <div className="col" style={{ gap: 6, minWidth: 0, flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="serif" style={{ fontSize: 34, fontWeight: 600 }}>
              Abba Abdouraman
            </span>
            <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>VIP</span>
            <span style={{ background: 'var(--green)', padding: '2px 10px', borderRadius: 4, fontSize: 13 }}>In House</span>
          </div>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            Serenity Collection · Residence 1
          </span>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            Nov 28, 2025 – Nov 30, 2025 (2 nights)
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {TAGS.map((t) => (
              <span key={t} style={{ padding: '7px 14px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 6, fontSize: 14 }}>
                {t}
              </span>
            ))}
            <span className="icon" style={{ padding: '7px 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 6, fontSize: 18, cursor: 'pointer' }}>
              add
            </span>
          </div>
        </div>
        <div className="col" style={{ gap: 8, padding: '0 20px', borderLeft: divider, fontSize: 14 }}>
          {CONTACT.map((c) => (
            <div key={c.icon} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name={c.icon} size={18} color="#b9b2a5" />
              {c.text}
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 10, paddingLeft: 20, borderLeft: divider }}>
          <span style={{ fontSize: 15, color: '#d6cfc1' }}>Guest Value</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {VALUE.map((v) => (
              <div key={v.l} className="col" style={{ padding: '12px 14px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, gap: 4 }}>
                <span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>
                  {v.n}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{v.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t} className={`tab${t === tab ? ' on' : ''}`} onClick={() => setTab(t)} style={{ borderRadius: '6px 6px 0 0', background: t === tab ? 'rgba(232,184,74,.12)' : 'transparent' }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
        <Card title="Current Stay" gap={12}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Placeholder style={{ minWidth: 150, height: 150, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10 }}>
              <span className="mono-label" style={{ marginBottom: 'auto' }}>
                residence photo
              </span>
              <span className="serif" style={{ fontSize: 22 }}>
                Serenity 1
              </span>
              <span style={{ fontSize: 13, color: '#b9b2a5' }}>Serenity Collection</span>
            </Placeholder>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: 'var(--text-3)', alignContent: 'start' }}>
              <div>
                <div style={{ color: 'var(--dim)' }}>Check-in</div>Nov 28, 2025
                <br />
                3:00 PM
              </div>
              <div>
                <div style={{ color: 'var(--dim)' }}>Check-out</div>Nov 30, 2025
                <br />
                11:00 AM
              </div>
              <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: divider }}>2 Nights</div>
              <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: divider }}>2 Adults · 0 Children</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderRadius: 6, background: 'rgba(31,157,85,.18)', border: '1px solid var(--green)', fontSize: 13 }}>
              <Icon name="check_circle" size={18} color="var(--green-bright)" />
              In House
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 13 }}>
              <Icon name="key" size={18} color="var(--green-bright)" />
              Digital Key Active
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 13 }}>
              <Icon name="local_parking" size={18} color="var(--blue-soft)" />
              Parking Confirmed
            </span>
          </div>
        </Card>

        <Card title="Guest Preferences" link="Edit ›" gap={4} headGap={6}>
          {PREFS.map((r) => (
            <div key={r.t} className="row-line" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '7px 0' }}>
              <Icon name={r.icon} size={24} color={r.c} />
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 15 }}>{r.t}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.d}</span>
              </div>
              <Icon name="chevron_right" size={18} color="var(--dim)" />
            </div>
          ))}
        </Card>

        <Card title="Smart Locker & Resident Services" link="View All ›" gap={4} headGap={6}>
          {LOCKER.map((r) => (
            <ListRow key={r.t} {...r} iconBox>
              <StatusPill s={r.s} />
            </ListRow>
          ))}
        </Card>

        <Card title={`Active Requests (${REQUESTS.length})`} link="View All ›" gap={4} headGap={6}>
          {REQUESTS.map((r) => (
            <ListRow key={r.t} {...r}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{r.time}</span>
              <StatusPill s={r.s} minWidth={92} />
            </ListRow>
          ))}
        </Card>

        <Card title="Upcoming Bookings" link="View All ›" gap={4} headGap={6}>
          {BOOKINGS.map((r) => (
            <ListRow key={r.t} {...r}>
              <StatusPill s={r.s} minWidth={92} />
            </ListRow>
          ))}
        </Card>

        <Card title="Stay Timeline" link="View All ›" gap={2} headGap={6}>
          {TIMELINE.map((r) => (
            <div key={r.t} style={{ display: 'grid', gridTemplateColumns: '14px 52px 1fr auto', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--gold)' }} />
              <span style={{ color: 'var(--text-3)' }}>{r.time}</span>
              <span>{r.t}</span>
              <span style={{ color: 'var(--dim)', fontSize: 12 }}>{r.cat}</span>
            </div>
          ))}
        </Card>

        <Card title="Guest History" link="View All ›" gap={4} headGap={6}>
          <div style={{ display: 'grid', gridTemplateColumns: histCols, gap: 8, fontSize: 12, color: 'var(--dim)', paddingBottom: 6, borderBottom: divider }}>
            <span>Date</span>
            <span>Residence</span>
            <span>Nights</span>
            <span>Purpose</span>
            <span>Satisfaction</span>
          </div>
          {HISTORY.map((r) => (
            <div key={r.d} className="row-line" style={{ display: 'grid', gridTemplateColumns: histCols, gap: 8, fontSize: 13, padding: '7px 0' }}>
              <span>{r.d}</span>
              <span>{r.r}</span>
              <span>{r.n}</span>
              <span>{r.p}</span>
              <span style={{ color: 'var(--green-bright)' }}>{r.s}</span>
            </div>
          ))}
        </Card>

        <Card title="Guest Insights (AI)" link="View All ›" gap={8} headGap={2}>
          {INSIGHTS.map((r) => (
            <div key={r} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <Icon name="auto_awesome" size={18} color="var(--gold)" />
              {r}
            </div>
          ))}
        </Card>

        <Card title="Quick Actions">
          <QuickActions items={QUICK} iconSize={26} variant="fill" fontSize={13} padding="12px 6px" gap={6} />
        </Card>
      </div>
    </div>
  );
}
