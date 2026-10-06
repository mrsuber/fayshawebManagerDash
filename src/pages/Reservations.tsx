import { useState } from 'react';
import { Avatar, Card, Chip, Donut, Icon, KpiGrid, MediaCard, conic } from '../components/ui';

// Mock data — replace with API calls.
const SC: Record<string, string> = { Expected: '#1f7a48', 'Checked In': '#2f6fe8', 'Checked Out': '#2f4d8f', 'In Progress': '#2f6fe8', Pending: '#6b5a3a', Confirmed: '#1f7a48', Inquiry: '#6b5a3a' };
const COL: Record<string, [string, string]> = {
  Serenity: ['#2f6fe8', '#fff'],
  'Villa Spectra': ['#e8c46a', '#1a1408'],
  'Allure Penthouse': ['#e05858', '#fff'],
  Riviera: ['#4fbf7a', '#0d1a12'],
  'Riviera 2': ['#7c4ddb', '#fff'],
};
/** Weeks of November 2025: day numbers, then stay bars as [label, collection, startCol, endCol]. */
const WEEKS: [number[], [string, string, number, number][]][] = [
  [[26, 27, 28, 29, 30, 31, 1], [['Serenity 1', 'Serenity', 5, 7]]],
  [[2, 3, 4, 5, 6, 7, 8], [['Villa Spectra 2', 'Villa Spectra', 1, 3], ['Riviera 1', 'Riviera', 4, 5], ['Allure Penthouse 1', 'Allure Penthouse', 6, 7]]],
  [[9, 10, 11, 12, 13, 14, 15], [['Riviera 2', 'Riviera 2', 1, 3], ['Serenity 2', 'Serenity', 4, 7]]],
  [[16, 17, 18, 19, 20, 21, 22], [['Villa Spectra 1', 'Villa Spectra', 1, 4], ['Allure Penthouse 2', 'Allure Penthouse', 5, 7]]],
  [[23, 24, 25, 26, 27, 28, 29], [['Serenity 1', 'Serenity', 1, 4], ['Riviera 1', 'Riviera', 5, 7]]],
  [[30, 1, 2, 3, 4, 5, 6], [['Villa Spectra 2', 'Villa Spectra', 1, 4], ['Riviera 2', 'Riviera 2', 5, 7]]],
];
const KPIS = [
  { icon: 'bed', c: '#3fd283', n: '72%', l: 'Occupancy Rate', d: '↑ 8%' },
  { icon: 'groups', c: '#5b8ff0', n: '124', l: 'Total Bookings', d: '↑ 18%' },
  { icon: 'payments', c: '#e8b84a', n: '$48,250', l: 'Booking Revenue', d: '↑ 22%' },
  { icon: 'flight_land', c: '#9b7bf0', n: '36', l: 'Upcoming Arrivals', d: '↑ 12%' },
  { icon: 'logout', c: '#5b8ff0', n: '28', l: 'Upcoming Departures', d: '↑ 6%' },
];
const TABS = ['Overview', 'Calendar', 'Booking List', 'Availability & Rates', 'Room Types', 'Packages', 'Groups & Events', 'Cancellations', 'Analytics'];
const VIEWS = ['Month', 'Week', 'Day'];
const LEGEND = [
  { l: 'Serenity', c: '#2f6fe8' },
  { l: 'Villa Spectra', c: '#e8c46a' },
  { l: 'Allure Penthouse', c: '#e05858' },
  { l: 'Riviera', c: '#4fbf7a' },
  { l: 'Blocked', c: '#5c6270' },
];
const ARRIVALS = [
  ['2:00 PM', 'Sophie Laurent', 'Serenity 1 · 2 guests', 'Expected'],
  ['3:30 PM', 'James & Anna', 'Villa Spectra 1 · 4 guests', 'Expected'],
  ['4:00 PM', 'Michael Chen', 'Allure Penthouse 1 · 2 guests', 'Checked In'],
  ['5:00 PM', 'Elena Petrova', 'Riviera 1 · 3 guests', 'Expected'],
  ['6:30 PM', 'Richard Thompson', 'Serenity 2 · 2 guests', 'Expected'],
];
const DEPARTURES = [
  ['10:00 AM', 'Carlos Mendez', 'Riviera 2 · 2 guests', 'Checked Out'],
  ['11:00 AM', 'Linda E.', 'Allure Penthouse 2 · 3 guests', 'Checked Out'],
  ['12:00 PM', 'Grace N.', 'Villa Spectra 2 · 2 guests', 'In Progress'],
  ['1:00 PM', 'Marie T.', 'Serenity 2 · 2 guests', 'Pending'],
  ['2:00 PM', 'David Kim', 'Riviera 1 · 4 guests', 'Pending'],
];
const ROOMS = [
  { n: 'Serenity Collection', a: '2 available / 6', w: '67%' },
  { n: 'Villa Spectra', a: '3 available / 6', w: '50%' },
  { n: 'Allure Penthouse', a: '1 available / 4', w: '75%' },
  { n: 'Riviera Collection', a: '2 available / 4', w: '50%' },
];
const SOURCES = [
  { l: 'Direct Website', v: 42, c: '#2f6fe8' },
  { l: 'Repeat Guests', v: 24, c: '#1f9d55' },
  { l: 'Travel Partners', v: 15, c: '#9b7bf0' },
  { l: 'Corporate', v: 10, c: '#f06292' },
  { l: 'Events & Groups', v: 6, c: '#e8b84a' },
  { l: 'Walk-in / Other', v: 3, c: '#8f897d' },
];
const RECENT = [
  ['Nov 28', 'Elena Petrova', 'Riviera 1', 'Confirmed'],
  ['Nov 28', 'Michael Chen', 'Allure Penthouse 1', 'Confirmed'],
  ['Nov 27', 'James & Anna', 'Villa Spectra 1', 'Checked In'],
  ['Nov 27', 'Sophie Laurent', 'Serenity 1', 'Confirmed'],
  ['Nov 26', 'Carlos Mendez', 'Riviera 2', 'Checked Out'],
];
const PACKAGES = [
  { n: 'Wellness Escape', d: 'Stay · Spa · Dining', p: 'From $690' },
  { n: 'Romantic Getaway', d: 'Villa · Private Dining', p: 'From $950' },
  { n: 'Family Retreat', d: 'Stay · Activities', p: 'From $780' },
];
const GROUPS: [string, string, string, number, string][] = [
  ['Dec 5–7', 'Corporate Retreat', 'Villa Spectra (6 rooms)', 24, 'Confirmed'],
  ['Dec 12–13', 'Wedding Celebration', 'Allure Penthouse + Pool Club', 50, 'Confirmed'],
  ['Dec 20–23', 'End of Year Group', 'Serenity Collection (4 rooms)', 16, 'Pending'],
  ['Jan 5–8', 'Wellness Retreat', 'Full Property (12 rooms)', 28, 'Inquiry'],
];

function GuestList({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <Card title={title} link="View All ›" gap={4} headGap={6}>
      {rows.map(([t, n, r, s]) => (
        <div key={n} className="row-line" style={{ display: 'grid', gridTemplateColumns: '62px 36px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{t}</span>
          <Avatar size={36} />
          <div className="col">
            <span style={{ fontSize: 14 }}>{n}</span>
            <span className="sub">{r}</span>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[s] }}>{s}</span>
        </div>
      ))}
    </Card>
  );
}

export default function Reservations() {
  const [tab, setTab] = useState(0);
  const [view, setView] = useState(0);

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div className="btn-outline">
          <Icon name="calendar_month" size={18} />
          Nov 1 – Nov 30, 2025 ▾
        </div>
        <div className="btn-gold">
          <Icon name="add" size={18} />
          New Reservation
        </div>
      </div>

      <KpiGrid items={KPIS} min={200} iconSize={40} numSize={30} padding={16} gap={14} labelSize={14} deltaSize={13} />

      <div className="tabs">
        {TABS.map((t, i) => (
          <div key={t} className={`tab${i === tab ? ' on' : ''}`} onClick={() => setTab(i)}>
            {t}
          </div>
        ))}
      </div>

      <div className="grid-cols">
        <Card
          title="Booking Calendar"
          style={{ gridRow: 'span 2' }}
          aside={
            <div style={{ display: 'flex', gap: 4 }}>
              {VIEWS.map((l, i) => (
                <Chip key={l} on={i === view} onClick={() => setView(i)} style={{ padding: '5px 14px', borderRadius: 4, fontSize: 13 }}>
                  {l}
                </Chip>
              ))}
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 16 }}>
            <Icon name="chevron_left" style={{ cursor: 'pointer' }} />
            November 2025
            <Icon name="chevron_right" style={{ cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', fontSize: 12, color: 'var(--muted)', textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {WEEKS.map(([days, bars], wi) => (
            <div key={wi} className="row-line" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 4, paddingBottom: 8 }}>
              {days.map((n, di) => {
                const outside = (wi === 0 && n > 7) || (wi === WEEKS.length - 1 && n < 7);
                return (
                  <span key={di} style={{ fontSize: 12, padding: '4px 6px', color: outside ? 'var(--faint)' : 'var(--text-3)' }}>
                    {n}
                  </span>
                );
              })}
              {bars.map(([l, k, a, b]) => (
                <span
                  key={l + a}
                  style={{
                    gridColumn: `${a} / ${b + 1}`,
                    margin: '0 3px',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    background: COL[k][0],
                    color: COL[k][1],
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
            {LEGEND.map((l) => (
              <span key={l.l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.c }} />
                {l.l}
              </span>
            ))}
          </div>
        </Card>

        <GuestList title={`Today's Arrivals (${ARRIVALS.length})`} rows={ARRIVALS} />
        <GuestList title={`Today's Departures (${DEPARTURES.length})`} rows={DEPARTURES} />

        <Card title="Room Availability" link="View All ›">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ROOMS.map((r) => (
              <MediaCard key={r.n} img="residence photo" imgHeight={64}>
                <span style={{ fontSize: 13 }}>{r.n}</span>
                <span className="sub">{r.a}</span>
                <div style={{ height: 4, background: 'var(--track)', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--green)', width: r.w }} />
                </div>
              </MediaCard>
            ))}
          </div>
        </Card>

        <Card title="Booking Sources">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Donut size={130} inner={96} gradient={conic(SOURCES.map((s) => [s.c, s.v]))}>
              <span className="serif" style={{ fontSize: 28 }}>
                124
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Bookings</span>
            </Donut>
            <div className="col" style={{ gap: 5, fontSize: 12, flex: 1 }}>
              {SOURCES.map((l) => (
                <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.c }} />
                  <span style={{ flex: 1 }}>{l.l}</span>
                  <span style={{ color: 'var(--text-3)' }}>{l.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-cols">
        <Card title="Recent Bookings" link="View All ›" gap={2} headGap={6}>
          {RECENT.map(([d, g, r, s]) => (
            <div key={g} className="row-line" style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 96px', gap: 8, alignItems: 'center', fontSize: 13, padding: '7px 0' }}>
              <span style={{ color: 'var(--text-3)' }}>{d}</span>
              <span>{g}</span>
              <span style={{ color: 'var(--text-3)' }}>{r}</span>
              <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card title="Packages & Offers" link="View All ›">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {PACKAGES.map((p) => (
              <MediaCard key={p.n} bodyGap={3}>
                <span style={{ fontSize: 13 }}>{p.n}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.d}</span>
                <span className="serif" style={{ fontSize: 18 }}>
                  {p.p}
                </span>
                <span className="cta-sm">Book Package</span>
              </MediaCard>
            ))}
          </div>
        </Card>

        <Card title="Group & Event Reservations" gap={4} headGap={6}>
          {GROUPS.map(([d, n, r, c, s]) => (
            <div key={n} className="row-line" style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{d}</span>
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">
                  {r} · {c} guests
                </span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
