import { useState } from 'react';
import { Bar, Card, Icon, Placeholder, Toggle } from '../components/ui';

// Mock data — replace with API calls.
const STAGES: [string, string][] = [
  ['Booking', 'check'],
  ['Pre-Arrival', 'flight_land'],
  ['Arrival', 'luggage'],
  ['Welcome', 'home'],
  ['Stay', 'king_bed'],
  ['Wellness', 'spa'],
  ['Dining', 'restaurant'],
  ['Experiences', 'sailing'],
  ['FAY Assistance', 'smart_toy'],
  ['Checkout', 'logout'],
  ['Stay Recap', 'summarize'],
  ['Return', 'favorite'],
];
/** Index of the stage after the current one (stage 5 of 12 is index 4 → current = 4-1). */
const CUR = 4;

type EventStatus = 'Completed' | 'Current' | 'Upcoming';
const SC: Record<EventStatus, string> = { Completed: '#1f9d55', Current: '#2f6fe8', Upcoming: '#2c3038' };

const EVENTS: [string, string, string, string, string, EventStatus][] = [
  ['Nov 27', '10:12 AM', 'event_available', 'Booking Confirmed', 'Reservation #FYH7832 confirmed for Serenity 1', 'Completed'],
  ['Nov 27', '12:34 PM', 'description', 'Guest Information Received', 'Personal details, preferences and special requests', 'Completed'],
  ['Nov 27', '3:21 PM', 'mail', 'Pre-Arrival Message Sent', 'Arrival details and digital access', 'Completed'],
  ['Nov 28', '12:00 PM', 'home', 'Residence Readiness Confirmed', 'Housekeeping, maintenance and amenities verified', 'Completed'],
  ['Nov 28', '3:05 PM', 'directions_car', 'Guest Arrived', 'Arrived at Faysha. Parking confirmed.', 'Completed'],
  ['Nov 28', '3:12 PM', 'star', 'Welcome Message Sent', 'Warm welcome and orientation information', 'Completed'],
  ['Nov 28', '3:30 PM', 'key', 'Residence Access Activated', 'Digital key activated for Residence 1', 'Completed'],
  ['Nov 28', '4:00 PM', 'king_bed', 'In Residence', 'Guest is now settled in Serenity 1', 'Current'],
  ['Tomorrow', '10:00 AM', 'spa', 'FAY Thermal Recovery', 'Wellness booking at Spa', 'Upcoming'],
  ['Tomorrow', '7:30 PM', 'restaurant', 'Dinner at Riviera', 'Table for 2', 'Upcoming'],
  ['Nov 30', '11:00 AM', 'work', 'Check-Out', 'Express checkout and farewell message', 'Upcoming'],
];

const AUTOMATIONS: [string, string, string][] = [
  ['auto_awesome', 'Morning wellness nudge', 'Daily at 8:00 AM via WhatsApp'],
  ['restaurant', 'Dinner reminder', '2 hours before reservation'],
  ['thermostat', 'Pre-cool residence', 'When guest leaves spa'],
  ['cake', 'Birthday surprise', 'Dec 5 · Notify dining team'],
  ['logout', 'Express checkout link', 'Nov 30 at 8:00 AM'],
];

const MILESTONES = [
  { img: 'spa treatment', when: 'Tomorrow, 10:00 – 11:30 AM', t: 'FAY Thermal Recovery', d: 'Spa · Recovery · Wellness' },
  { img: 'restaurant terrace', when: 'Tomorrow, 7:30 – 9:30 PM', t: 'Dinner at Riviera', d: 'Mediterranean Cuisine' },
  { img: 'yacht at sunset', when: 'Nov 30, 4:00 – 7:00 PM', t: 'Sunset Yacht Experience', d: 'Private Charter · Ocean View' },
];
const RECS = [
  { img: 'yoga', t: 'Morning Movement Session', d: 'Based on wellness preferences', cta: 'Book Now' },
  { img: 'pool club', t: 'Pool Club Lunch', d: 'Popular with similar guests', cta: 'Book Now' },
  { img: 'golf course', t: 'Private Golf Experience', d: 'Curated for your stay', cta: 'Explore' },
];
const SAT = [
  { l: 'Residence', v: 9.8, c: '#1f9d55' },
  { l: 'Service', v: 9.6, c: '#3fd283' },
  { l: 'Dining', v: 9.4, c: '#e8b84a' },
  { l: 'Experiences', v: 9.6, c: '#9b7bf0' },
  { l: 'Overall', v: 9.6, c: '#2f6fe8' },
];

function stageStyle(i: number) {
  const done = i < CUR - 1;
  const current = i === CUR - 1;
  const next = i === CUR;
  return {
    border: done || next ? '#1f9d55' : current ? '#e8b84a' : '#3a3f48',
    bg: current ? 'rgba(232,184,74,.15)' : 'transparent',
    icon: i <= CUR ? (current ? '#e8b84a' : '#3fd283') : '#8f897d',
    text: current ? '#e8b84a' : '#e6e0d4',
  };
}

export default function GuestJourney() {
  const [autos, setAutos] = useState([true, true, true, false, true]);
  const flip = (i: number) => setAutos((a) => a.map((v, j) => (j === i ? !v : v)));

  return (
    <div className="stack">
      {/* Profile banner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <Placeholder label="guest portrait" style={{ width: 150, height: 130, borderRadius: 8, display: 'flex', alignItems: 'flex-end', padding: 8 }} />
        <div className="col" style={{ gap: 6, flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="serif" style={{ fontSize: 32, fontWeight: 600 }}>
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
        </div>
        <div className="col" style={{ gap: 6, padding: '0 20px', borderLeft: '1px solid var(--border)', fontSize: 14 }}>
          <span>+971 50 123 4567</span>
          <span>abba@domain.com</span>
          <span>UAE · English</span>
          <span style={{ color: 'var(--muted)' }}>Local Time 18:42</span>
        </div>
        <div className="col" style={{ flex: '1 1 240px', padding: 14, border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Journey Progress</span>
          <span className="serif" style={{ fontSize: 26, color: 'var(--green-bright)' }}>
            In House
          </span>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}>
            <div style={{ width: '42%', height: '100%', background: 'linear-gradient(90deg,#1f9d55,#3fd283)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
            <span>Stage {CUR + 1} of {STAGES.length}</span>
            <span>42%</span>
          </div>
        </div>
      </div>

      {/* Stage stepper */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
        {STAGES.map(([label, icon], i) => {
          const s = stageStyle(i);
          return (
            <div key={label} className="col" style={{ alignItems: 'center', gap: 8, minWidth: 74 }}>
              <span className="icon" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: `2px solid ${s.border}`, background: s.bg, color: s.icon }}>
                {icon}
              </span>
              <span style={{ fontSize: 13, color: s.text }}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid-cols">
        <Card title="Journey Timeline" link="View All Events ›" gap={0} headGap={10}>
          {EVENTS.map(([date, time, icon, t, d, s]) => (
            <div
              key={t}
              className="row-line"
              style={{
                display: 'grid',
                gridTemplateColumns: '16px 28px 72px minmax(0,1fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: '8px 6px',
                borderRadius: 6,
                background: s === 'Current' ? 'rgba(47,111,232,.12)' : 'transparent',
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: s === 'Completed' ? '#1f9d55' : s === 'Current' ? '#2f6fe8' : '#3a3f48' }} />
              <Icon name={icon} size={22} color={s === 'Upcoming' ? '#e8b84a' : '#5b8ff0'} />
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>
                {date}
                <br />
                {time}
              </span>
              <div className="col" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14 }}>{t}</span>
                <span className="sub">{d}</span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>

        <div className="stack">
          <Card title="Upcoming Milestones" link="View All ›">
            {MILESTONES.map((m) => (
              <div key={m.t} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: 8, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8 }}>
                <Placeholder label={m.img} style={{ borderRadius: 6, minHeight: 96, padding: 6 }} />
                <div className="col" style={{ gap: 3 }}>
                  <span className="sub">{m.when}</span>
                  <span className="serif" style={{ fontSize: 19 }}>
                    {m.t}
                  </span>
                  <span className="sub">{m.d}</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <span style={{ flex: 1, textAlign: 'center', padding: 6, borderRadius: 4, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>View Details</span>
                    <span style={{ flex: 1, textAlign: 'center', padding: 6, borderRadius: 4, border: '1px solid rgba(255,255,255,.15)', fontSize: 12, cursor: 'pointer' }}>Modify</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>
          <Card title="Personalized Recommendations" link="View All ›">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {RECS.map((r) => (
                <div key={r.t} className="col" style={{ gap: 4, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden' }}>
                  <Placeholder label={r.img} labelSize={9} style={{ height: 70, padding: 5 }} />
                  <div className="col" style={{ padding: '4px 8px 8px', gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{r.t}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.d}</span>
                    <span className="cta-sm">{r.cta}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Automations" link="Manage ›" gap={8}>
            {AUTOMATIONS.map(([icon, t, d], i) => (
              <div key={t} className="row-line" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                <Icon name={icon} size={22} color="var(--gold)" />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 14 }}>{t}</span>
                  <span className="sub">{d}</span>
                </div>
                <Toggle on={autos[i]} onClick={() => flip(i)} label={t} />
              </div>
            ))}
          </Card>
          <Card title="Guest Satisfaction" link="View Details ›">
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
              <div className="col" style={{ alignItems: 'center', padding: '14px 18px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }}>
                <span className="serif" style={{ fontSize: 32 }}>
                  9.6<span style={{ fontSize: 18, color: 'var(--muted)' }}> / 10</span>
                </span>
                <span style={{ fontSize: 14, color: 'var(--green-bright)' }}>Excellent</span>
              </div>
              <div className="col" style={{ gap: 7 }}>
                {SAT.map((s) => (
                  <div key={s.l} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 28px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>{s.l}</span>
                    <Bar value={`${s.v * 10}%`} color={s.c} />
                    <span>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
