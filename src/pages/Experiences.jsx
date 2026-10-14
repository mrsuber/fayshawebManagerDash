import { useState } from 'react';
import { Card, Chip, Icon, KpiGrid, Placeholder } from '../components/ui';

// Mock data — replace with API calls.
const EXPERIENCES = [
  ['yacht at sunset', 'Water', 'Sunset Yacht Experience', 'Private charter along the coast with canapés', '3 h', 'Up to 8', '$1,200'],
  ['desert dunes', 'Outdoor', 'Desert Dune Safari', '4×4 dunes, falconry and stargazing camp', '5 h', 'Up to 6', '$420'],
  ['golf course', 'Sport', 'Private Golf Experience', '18 holes with resident pro', '4 h', 'Up to 4', '$350'],
  ['old town market', 'Cultural', 'Old Town Heritage Walk', 'Guided souk & architecture tour', '2.5 h', 'Up to 10', '$90'],
  ['chef at table', 'Culinary', 'Private Chef Experience', 'Seven-course tasting in your residence', '3 h', 'Up to 6', '$680'],
  ['diving reef', 'Water', 'Reef Snorkel & Dive', 'Guided reef dive, all equipment included', '3 h', 'Up to 6', '$260'],
  ['sunrise yoga', 'Wellness', 'Sunrise Beach Yoga', 'Breathwork and flow at first light', '1 h', 'Up to 12', '$45'],
  ['kids club', 'Family', 'Young Explorers Club', 'Nature crafts and treasure hunt', '3 h', 'Ages 5–12', '$60'],
];
const CATS = ['All', 'Water', 'Outdoor', 'Cultural', 'Culinary', 'Sport', 'Wellness', 'Family'];
const KPIS = [
  { icon: 'sailing', c: '#4fc3f7', n: '14', l: 'Bookings Today' },
  { icon: 'groups', c: '#3fd283', n: '46', l: 'Participants' },
  { icon: 'payments', c: '#e8b84a', n: '$9,840', l: 'Experience Revenue' },
  { icon: 'star', c: '#e8b84a', n: '9.7', l: 'Avg Rating' },
  { icon: 'event_upcoming', c: '#9b7bf0', n: '22', l: 'Upcoming (7 days)' },
];
const BOOKINGS = [
  ['Nov 29, 7:00 AM', 'Sunrise Beach Yoga', 'Abba Abdouraman', '1', 'Confirmed'],
  ['Nov 29, 9:00 AM', 'Private Golf Experience', 'Michael Chen', '2', 'Confirmed'],
  ['Nov 29, 3:00 PM', 'Desert Dune Safari', 'James & Anna', '2', 'Pending'],
  ['Nov 30, 4:00 PM', 'Sunset Yacht Experience', 'Abba Abdouraman', '2', 'Pending'],
  ['Dec 1, 10:00 AM', 'Old Town Heritage Walk', 'Elena Petrova', '3', 'Confirmed'],
];
const SUGGEST = [
  { t: 'Abba A. — Private Golf Experience', d: 'Listed golf in preferences, nothing booked yet' },
  { t: 'James & Anna — Sunset Yacht', d: 'Asked about yacht availability via WhatsApp' },
  { t: 'Elena P. — Sunrise Yoga', d: 'Booked 2 wellness sessions this stay' },
];

export default function Experiences() {
  const [cat, setCat] = useState(0);
  const items = EXPERIENCES.filter((e) => cat === 0 || e[1] === CATS[cat]);
  return (
    <div className="stack">
      <KpiGrid items={KPIS} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATS.map((l, i) => (
          <Chip key={l} on={i === cat} onClick={() => setCat(i)} style={{ padding: '9px 16px', fontSize: 14 }}>
            {l}
          </Chip>
        ))}
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {items.map(([img, c, n, d, dur, cap, p]) => (
          <div key={n} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <Placeholder stripe={10} style={{ height: 150, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono-label">{img}</span>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(10,12,15,.8)', border: '1px solid rgba(232,184,74,.5)' }}>
                {c}
              </span>
            </Placeholder>
            <div className="col" style={{ padding: 14, gap: 6, flex: 1 }}>
              <span className="card-title">{n}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{d}</span>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)' }}>
                <span>{dur}</span>
                <span>{cap}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                <span className="serif" style={{ fontSize: 20 }}>
                  {p}
                </span>
                <span style={{ padding: '7px 16px', borderRadius: 5, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 13, cursor: 'pointer' }}>
                  Book
                </span>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid-cols">
        <Card title="Upcoming Bookings" gap={4} headGap={6}>
          {BOOKINGS.map(([when, n, g, pax, s]) => (
            <div
              key={when}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 70px auto', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 13 }}
            >
              <span style={{ color: 'var(--text-3)' }}>{when}</span>
              <span>{n}</span>
              <span style={{ color: 'var(--text-3)' }}>{g}</span>
              <span style={{ color: 'var(--muted)' }}>{pax} pax</span>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: s === 'Confirmed' ? '#7c4ddb' : '#2f6fe8' }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card title="FAY Suggests" gap={8}>
          {SUGGEST.map((s) => (
            <div key={s.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <Icon name="auto_awesome" size={20} color="var(--gold)" />
              <div className="col" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontSize: 14 }}>{s.t}</span>
                <span className="sub">{s.d}</span>
              </div>
              <span style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(232,184,74,.5)', fontSize: 12, cursor: 'pointer' }}>Offer</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
