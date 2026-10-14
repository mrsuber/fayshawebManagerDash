import { useState } from 'react';
import { Bar, Card, Chip, Donut, conic } from '../components/ui';

// Mock data — replace with API calls.
const RANGES = ['7 days', '30 days', 'Year to date', 'Custom'];
const KPIS = [
  { l: 'Total Revenue', n: '$412,800', d: '↑ 18%' },
  { l: 'Avg Occupancy', n: '72%', d: '↑ 8%' },
  { l: 'RevPAR', n: '$486', d: '↑ 11%' },
  { l: 'Guest Satisfaction', n: '9.6 / 10', d: '↑ 0.3' },
  { l: 'Repeat Guests', n: '24%', d: '↑ 5%' },
];

/** Month, stays revenue, services revenue (in $k; chart scale is 0–100). */
const MONTHS = [
  ['Jan', 52, 14],
  ['Feb', 58, 16],
  ['Mar', 64, 18],
  ['Apr', 60, 17],
  ['May', 55, 15],
  ['Jun', 48, 12],
  ['Jul', 44, 11],
  ['Aug', 46, 12],
  ['Sep', 58, 15],
  ['Oct', 70, 20],
  ['Nov', 78, 24],
];
const MIX = [
  { l: 'Residences', v: 58, c: '#e8b84a' },
  { l: 'Wellness & Spa', v: 14, c: '#9b7bf0' },
  { l: 'Dining', v: 14, c: '#3fd283' },
  { l: 'Experiences', v: 9, c: '#4fc3f7' },
  { l: 'Other', v: 5, c: '#8f897d' },
];
const OCC = [
  ['Serenity Collection', '78%'],
  ['Villa Spectra', '64%'],
  ['Allure Penthouse', '82%'],
  ['Riviera Collection', '68%'],
];
const SAT = [
  ['Residence', 9.8, '#1f9d55'],
  ['Housekeeping', 9.5, '#3fd283'],
  ['Dining', 9.4, '#e8b84a'],
  ['Wellness', 9.6, '#9b7bf0'],
  ['Experiences', 9.7, '#4fc3f7'],
  ['Transportation', 9.2, '#2f6fe8'],
];
const TOP = [
  ['FAY Thermal Recovery', '142 bookings', '$28,400'],
  ['Riviera Tasting Menu', '118 covers', '$8,024'],
  ['Sunset Yacht', '26 charters', '$31,200'],
  ['Signature Massage', '96 bookings', '$17,280'],
  ['Private Chef', '18 dinners', '$12,240'],
];

function LegendSwatch({ c, children }) {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
      {children}
    </span>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(2);
  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {RANGES.map((l, i) => (
          <Chip key={l} on={i === range} onClick={() => setRange(i)} style={{ padding: '8px 16px', fontSize: 14 }}>
            {l}
          </Chip>
        ))}
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {KPIS.map((k) => (
          <div key={k.l} className="card" style={{ gap: 4 }}>
            <span className="kpi-l">{k.l}</span>
            <span className="kpi-n" style={{ fontSize: 32 }}>
              {k.n}
            </span>
            <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>{k.d} vs last period</span>
          </div>
        ))}
      </div>

      <div className="grid-cols">
        <Card
          title="Revenue by Month"
          gap={12}
          aside={
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              <LegendSwatch c="#e8b84a">Stays</LegendSwatch>
              <LegendSwatch c="#2f6fe8">Services</LegendSwatch>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 240, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            {MONTHS.map(([l, r, s]) => (
              <div key={l} className="col" style={{ flex: 1, justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                <div style={{ borderRadius: '3px 3px 0 0', background: 'var(--blue)', height: `${s}%` }} />
                <div style={{ background: 'var(--gold)', height: `${r}%` }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--dim)' }}>
            {MONTHS.map(([l]) => (
              <span key={l} style={{ flex: 1, textAlign: 'center' }}>
                {l}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Revenue Mix">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Donut size={140} inner={104} gradient={conic(MIX.map((m) => [m.c, m.v]))}>
              <span className="serif" style={{ fontSize: 24 }}>
                $412K
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>YTD</span>
            </Donut>
            <div className="col" style={{ gap: 6, fontSize: 13, flex: 1 }}>
              {MIX.map((l) => (
                <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.c }} />
                  <span style={{ flex: 1 }}>{l.l}</span>
                  <span style={{ color: 'var(--text-3)' }}>{l.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Occupancy by Collection" gap={8}>
          {OCC.map(([n, v]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{n}</span>
              <Bar value={v} color="var(--green-bright)" height={8} />
              <span style={{ color: 'var(--text-3)' }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card title="Satisfaction by Department" gap={8}>
          {SAT.map(([n, v, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 30px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{n}</span>
              <Bar value={`${v * 10}%`} color={c} height={8} />
              <span style={{ color: 'var(--text-3)' }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card title="Top Services" gap={4} headGap={6}>
          {TOP.map(([n, c, v], i) => (
            <div
              key={n}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 12, alignItems: 'center', padding: '6px 0', fontSize: 13 }}
            >
              <span style={{ color: 'var(--gold)' }}>{i + 1}</span>
              <span>{n}</span>
              <span style={{ color: 'var(--muted)' }}>{c}</span>
              <span>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
