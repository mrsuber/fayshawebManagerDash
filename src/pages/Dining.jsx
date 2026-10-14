import { useState } from 'react';
import { diningApi } from '../api';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import { Card, CardLink, Chip, Icon, KpiGrid, MediaCard, QuickActions, VenueTile } from '../components/ui';

// The floor plan comes from the API (see docs/API.md); the other panels are still sample data.
const SC = { Completed: '#1f9d55', Seated: '#2f6fe8', Upcoming: '#3a3f48', Confirmed: '#7c4ddb' };
const RESV = [
  ['12:30', 'Marie T.', 2, 'Pool Club', 'P-01', 'Completed'],
  ['13:00', 'David Kim', 4, 'Riviera', 'R-03', 'Seated'],
  ['13:15', 'James & Anna', 2, 'Pool Club', 'P-04', 'Seated'],
  ['19:30', 'Abba Abdouraman', 4, 'Riviera', 'R-01', 'Upcoming'],
  ['19:45', 'Sophie Laurent', 2, 'Private Dining', 'PD-01', 'Confirmed'],
  ['20:00', 'Michael Chen', 6, 'Riviera', 'R-05', 'Confirmed'],
  ['20:15', 'Elena Petrova', 2, 'Pool Club', 'P-07', 'Confirmed'],
  ['20:30', 'Richard Thompson', 2, 'In-Residence', 'IR-01', 'Confirmed'],
];
const TS = ['Available', 'Seated', 'Reserved', 'Cleaning'];
const TC = { Available: '#1f9d55', Seated: '#2f6fe8', Reserved: '#e8b84a', Cleaning: '#d94040' };
const VF = ['All', 'Riviera', 'Pool Club', 'Private Dining', 'In-Residence'];
const VENUES = [
  { img: 'riviera terrace', n: 'Riviera', d: 'Mediterranean · Ocean view' },
  { img: 'pool club', n: 'Pool Club', d: 'Light bites & bar' },
  { img: 'private dining room', n: 'Private Dining', d: 'Curated for you' },
  { img: 'in-residence dish', n: 'In-Residence Dining', d: 'Comfort. Privacy.' },
];
const KPIS = [
  { icon: 'restaurant', c: '#e8b84a', n: '42', l: 'Total Covers', d: '↑ 18%' },
  { icon: 'event_available', c: '#5b8ff0', n: '28', l: 'Reservations', d: '↑ 27%' },
  { icon: 'directions_walk', c: '#3fd283', n: '12', l: 'Walk-ins', d: '↑ 9%' },
  { icon: 'donut_large', c: '#9b7bf0', n: '92%', l: 'Table Utilization', d: '↑ 12%' },
  { icon: 'star', c: '#e8b84a', n: '9.5', l: 'Satisfaction', d: '↑ 6%' },
  { icon: 'payments', c: '#e8b84a', n: '$78', l: 'Avg Spend / Guest', d: '↑ 14%' },
];
const PREFS = [
  { icon: 'set_meal', c: '#4fc3f7', t: 'Cuisine', d: 'Seafood, Mediterranean, local' },
  { icon: 'no_food', c: '#e8b84a', t: 'Dietary', d: 'No restrictions' },
  { icon: 'deck', c: '#f06292', t: 'Setting', d: 'Ocean view, outdoor dining' },
  { icon: 'cake', c: '#f06292', t: 'Special Occasion', d: 'Birthday (Dec 5)' },
];
const ORDERS = [
  { id: '#D458', v: 'Pool Club', d: 'Grilled seafood platter · 12:42', s: 'Preparing', sc: '#e8c46a', f: '#1a1408' },
  { id: '#D457', v: 'Riviera', d: 'Mediterranean tasting menu · 20:15', s: 'Confirmed', sc: '#7c4ddb', f: '#fff' },
  { id: '#D456', v: 'In-Residence', d: 'Breakfast for 2 · Serenity 1', s: 'Delivered', sc: '#1f9d55', f: '#fff' },
];
const MENU = [
  { n: 'Grilled Lobster', v: 'Riviera', p: '$52' },
  { n: 'Mediterranean Tasting', v: 'Riviera', p: '$68' },
  { n: 'Fresh Catch of the Day', v: 'Pool Club', p: '$36' },
  { n: 'Signature Cocktail', v: 'Pool Club', p: '$18' },
];
const SPECIALS = [
  { n: 'Sunset Dinner', d: 'Riviera Terrace · Nov 29, 6 PM' },
  { n: 'Private Chef Experience', d: 'In-Residence · Nov 30, 7 PM' },
  { n: 'Wine Pairing Night', d: 'Riviera · Dec 5, 7:30 PM' },
];
const QUICK = [
  { icon: 'event_available', c: '#5b8ff0', l: 'New Reservation' },
  { icon: 'person_add', c: '#5b8ff0', l: 'Walk-in Guest' },
  { icon: 'room_service', c: '#e8b84a', l: 'New Order' },
  { icon: 'groups', c: '#f06292', l: 'Private Dining' },
  { icon: 'home', c: '#4fc3f7', l: 'In-Residence' },
  { icon: 'edit_note', c: '#9b7bf0', l: 'Dietary Request' },
];
const RESV_COLS = '44px 1fr 30px 1fr 46px 88px';

export default function Dining() {
  const [f, setF] = useState(0);
  const toast = useToast();
  const { data, setData } = useApi(diningApi.tables, [], []);
  const tables = (data || []).map((t) => ({ id: t.id, s: t.status, who: t.guestName }));
  const setStatus = (id, status) => setData((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  const cycle = (i) => {
    const { id, s: prev } = tables[i];
    const next = TS[(TS.indexOf(prev) + 1) % TS.length];
    setStatus(id, next);
    diningApi.setTableStatus(id, next).catch((e) => {
      setStatus(id, prev);
      toast(e.message, 'error');
    });
  };
  const rows = RESV.filter((r) => f === 0 || r[3] === VF[f]);
  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {VENUES.map((v) => (
          <VenueTile key={v.n} {...v} height={160} />
        ))}
      </div>

      <KpiGrid items={KPIS} min={160} iconSize={32} />

      <div className="grid-cols">
        <Card title="Today's Reservations" link="View All ›" gap={2} headGap={8}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {VF.map((l, i) => (
              <Chip key={l} on={i === f} onClick={() => setF(i)} style={{ padding: '5px 12px', borderRadius: 4, fontSize: 12 }}>
                {l}
              </Chip>
            ))}
          </div>
          {rows.map(([t, g, p, v, tb, s]) => (
            <div
              key={tb}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: RESV_COLS, gap: 8, alignItems: 'center', fontSize: 13, padding: '7px 0' }}
            >
              <span style={{ color: 'var(--text-3)' }}>{t}</span>
              <span>{g}</span>
              <span style={{ color: 'var(--text-3)' }}>{p}</span>
              <span style={{ color: 'var(--text-3)' }}>{v}</span>
              <span style={{ color: 'var(--muted)' }}>{tb}</span>
              <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card
          title={
            <span className="col">
              <span className="card-title">Floor Plan – Riviera</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--sans)', fontWeight: 400 }}>Real-time table status · tap to change</span>
            </span>
          }
          aside={<CardLink>All Venues ›</CardLink>}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 14,
              padding: 22,
              borderRadius: 8,
              background: 'repeating-linear-gradient(45deg,#14171d 0 14px,#121519 14px 28px)',
              border: '1px solid rgba(255,255,255,.06)',
            }}
          >
            {tables.map((t, i) => (
              <div
                key={t.id}
                onClick={() => cycle(i)}
                className="col"
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  background: 'var(--surface-3)',
                  border: `2px solid ${TC[t.s]}`,
                }}
              >
                <span style={{ fontSize: 14 }}>{t.id}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.who || t.s}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
            {TS.map((l) => (
              <span key={l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: TC[l] }} />
                {l} ({tables.filter((t) => t.s === l).length})
              </span>
            ))}
          </div>
        </Card>

        <div className="stack">
          <Card title="Dining Preferences" link="Edit ›" gap={6}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Abba Abdouraman · VIP</span>
            {PREFS.map((p) => (
              <div key={p.t} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '5px 0' }}>
                <Icon name={p.icon} size={22} color={p.c} />
                <div className="col">
                  <span style={{ fontSize: 14 }}>{p.t}</span>
                  <span className="sub">{p.d}</span>
                </div>
              </div>
            ))}
          </Card>
          <Card title="Active Orders" link="View All ›" gap={6}>
            {ORDERS.map((o) => (
              <div key={o.id} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                <Icon name="receipt_long" size={22} color="var(--gold)" />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 13 }}>
                    {o.id} · {o.v}
                  </span>
                  <span className="sub">{o.d}</span>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: o.sc, color: o.f }}>{o.s}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <div className="grid-cols">
        <Card title="Popular Menu Items" link="View Menu ›">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {MENU.map((m) => (
              <MediaCard key={m.n} img="dish photo" imgHeight={80} bodyGap={2}>
                <span style={{ fontSize: 13 }}>{m.n}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.v}</span>
                <span className="serif" style={{ fontSize: 18 }}>
                  {m.p}
                </span>
              </MediaCard>
            ))}
          </div>
        </Card>
        <Card title="Upcoming Special Experiences">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {SPECIALS.map((s) => (
              <MediaCard key={s.n} bodyGap={3}>
                <span style={{ fontSize: 13 }}>{s.n}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.d}</span>
                <span className="cta-sm">Book Now</span>
              </MediaCard>
            ))}
          </div>
        </Card>
        <Card title="Quick Actions">
          <QuickActions items={QUICK} />
        </Card>
      </div>
    </div>
  );
}
