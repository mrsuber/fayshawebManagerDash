import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import moment from 'moment';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { guestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import GuestPicker from '../components/GuestPicker';
import { Bar, Card, Chip, Icon, Placeholder, Toggle } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import { HistoryHeader, StayRow } from './guest360/cards';
import useGuestActions from './guest360/GuestActions';
import { BOOKING_TYPES, fmtDate, nights, slot } from './guest360/format';
import useNav from '../hooks/useNav';
import useGuestOptions from '../hooks/useGuestOptions';

const STAGES = [
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
/** Current stage index from the guest's status. */
const STAGE_BY_STATUS = { Upcoming: 1, Arriving: 2, 'In House': 4, 'Checked Out': 10 };
const SC = { Completed: '#1f9d55', Current: '#2f6fe8', Upcoming: '#2c3038', Cancelled: '#3a3f48' };
const CATEGORY_ICON = {
  Reservation: 'event_available',
  Communication: 'mail',
  Arrival: 'directions_car',
  Residence: 'key',
  'Smart Locker': 'deployed_code',
  'Service Request': 'room_service',
  Dining: 'restaurant',
  Wellness: 'spa',
  Experience: 'sailing',
  Transportation: 'directions_car',
  Departure: 'logout',
  Billing: 'payments',
  Note: 'sticky_note_2',
  Profile: 'manage_accounts',
};
const IMG = { wellness: 'spa treatment', dining: 'restaurant terrace', experience: 'yacht at sunset', transport: 'chauffeur car' };
const RECS = [
  { img: 'yoga', t: 'Yoga at Sunrise', d: 'Based on wellness preferences', cta: 'Book Now', type: 'wellness' },
  { img: 'pool club', t: 'Pool Club Lunch', d: 'Popular with similar guests', cta: 'Book Now', type: 'dining' },
  { img: 'golf course', t: 'Golf Tee Time', d: 'Curated for your stay', cta: 'Explore', type: 'experience' },
  { img: 'hammam', t: 'Hammam Ritual', d: 'Pairs well with thermal recovery', cta: 'Book Now', type: 'wellness' },
  { img: 'chef table', t: 'Chef’s Table', d: 'Seafood tasting · 6 courses', cta: 'Book Now', type: 'dining' },
  { img: 'snorkeling', t: 'Snorkeling Trip', d: 'Calm seas tomorrow morning', cta: 'Explore', type: 'experience' },
  { img: 'desert', t: 'Desert Safari', d: 'Sunset dunes & dinner', cta: 'Explore', type: 'experience' },
  { img: 'float pod', t: 'FAY FLOAT Session', d: 'Sleep optimisation', cta: 'Book Now', type: 'wellness' },
];
const SAT_AREAS = [
  ['Residence', 0.2, '#1f9d55'],
  ['Service', 0, '#3fd283'],
  ['Dining', -0.2, '#e8b84a'],
  ['Experiences', 0, '#9b7bf0'],
  ['Overall', 0, '#2f6fe8'],
];
const AUTOMATION_ICONS = [
  ['auto_awesome', 'Sparkle'],
  ['restaurant', 'Dining'],
  ['spa', 'Wellness'],
  ['thermostat', 'Climate'],
  ['cake', 'Celebration'],
  ['mail', 'Message'],
  ['logout', 'Checkout'],
];

function stageStyle(i, cur) {
  const done = i < cur;
  const current = i === cur;
  const next = i === cur + 1;
  return {
    border: done || next ? '#1f9d55' : current ? '#e8b84a' : '#3a3f48',
    bg: current ? 'rgba(232,184,74,.15)' : 'transparent',
    icon: i <= cur + 1 ? (current ? '#e8b84a' : '#3fd283') : '#8f897d',
    text: current ? '#e8b84a' : '#e6e0d4',
  };
}

const dayLabel = (iso) => {
  const m = moment(iso);
  return m.isSame(moment(), 'day') ? 'Today' : m.isSame(moment().add(1, 'day'), 'day') ? 'Tomorrow' : m.isSame(moment().subtract(1, 'day'), 'day') ? 'Yesterday' : m.format('MMM D');
};

/** Past timeline + current state + upcoming bookings and checkout, oldest first. */
function journeyEvents(guest, timeline, bookings) {
  const past = timeline.map((e) => ({ key: `t${e.id}`, at: e.at, icon: CATEGORY_ICON[e.category] || 'event', t: e.title, d: e.category, s: 'Completed' }));
  const future = bookings
    .filter((b) => new Date(b.startsAt) > new Date() && b.status !== 'Cancelled')
    .map((b) => ({ key: `b${b.id}`, at: b.startsAt, icon: BOOKING_TYPES[b.type]?.icon || 'event', t: b.title, d: `${BOOKING_TYPES[b.type]?.label || 'Booking'} · ${b.guests} guest${b.guests > 1 ? 's' : ''}`, s: 'Upcoming', booking: b }));
  const events = [...past, ...future];
  if (guest.status === 'In House') events.push({ key: 'now', at: new Date().toISOString(), icon: 'king_bed', t: 'In Residence', d: `Guest is settled in ${guest.residence}`, s: 'Current' });
  if (guest.status !== 'Checked Out') {
    events.push({ key: 'co', at: moment(`${guest.checkOut} 11:00`, 'YYYY-MM-DD HH:mm').toISOString(), icon: 'work', t: 'Check-Out', d: 'Express checkout and farewell message', s: 'Upcoming' });
  }
  return events.sort((a, b) => (a.at < b.at ? -1 : 1));
}

function EventRow(e) {
  return (
    <div
      key={e.key}
      className="row-line"
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 28px 72px minmax(0,1fr) auto',
        gap: 10,
        alignItems: 'center',
        padding: '8px 6px',
        borderRadius: 6,
        background: e.s === 'Current' ? 'rgba(47,111,232,.12)' : 'transparent',
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: e.s === 'Completed' ? '#1f9d55' : e.s === 'Current' ? '#2f6fe8' : '#3a3f48' }} />
      <Icon name={e.icon} size={22} color={e.s === 'Upcoming' ? '#e8b84a' : '#5b8ff0'} />
      <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>
        {dayLabel(e.at)}
        <br />
        {moment(e.at).format('h:mm A')}
      </span>
      <div className="col" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14 }}>{e.t}</span>
        <span className="sub">{e.d}</span>
      </div>
      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[e.s] }}>{e.s}</span>
    </div>
  );
}

const smallBtn = (primary) => ({
  flex: 1,
  textAlign: 'center',
  padding: 6,
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--sans)',
  ...(primary ? { background: 'var(--gold)', color: 'var(--on-gold)', fontWeight: 500, border: 0 } : { border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: 'var(--text)' }),
});

export default function GuestJourney() {
  const toast = useToast();
  const navigate = useNav();
  const [params, setParams] = useSearchParams();
  const { firstId, loaded } = useGuestOptions();
  const guestId = Number(params.get('guest')) || firstId;
  const forGuest = (fn, empty) => () => (guestId ? fn() : Promise.resolve(empty));
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((r) => r + 1), []);
  const [view, setView] = useState(null);
  const [details, setDetails] = useState(null);
  const [newAutomation, setNewAutomation] = useState(false);

  const profile = useApi(forGuest(() => guestsApi.get(guestId), null), [guestId, rev]);
  const timeline = useApi(forGuest(() => guestsApi.timeline(guestId), []), [guestId, rev], []);
  const bookings = useApi(forGuest(() => guestsApi.bookings(guestId), []), [guestId, rev], []);
  const stays = useApi(forGuest(() => guestsApi.stays(guestId), []), [guestId, rev], []);
  const automations = useCollection('automations');
  const guest = profile.data?.id === guestId ? profile.data : null;
  const { actions, dialogs } = useGuestActions(guest, refresh);

  if (loaded && !guestId) {
    return (
      <div className="card" style={{ padding: 24, gap: 8 }}>
        <span className="serif" style={{ fontSize: 22 }}>No guests yet</span>
        <span className="sub">Guests appear here once they have a reservation — from the website, the guest app or Reservations → New Reservation.</span>
      </div>
    );
  }
  if (!guest) return <div style={{ padding: 40, color: 'var(--muted)' }}>{profile.error ? profile.error.message : 'Loading journey…'}</div>;

  const cur = STAGE_BY_STATUS[guest.status] ?? 0;
  const pct = Math.round(((cur + 1) / STAGES.length) * 100);
  const events = journeyEvents(guest, timeline.data, bookings.data);
  const upcoming = bookings.data.filter((b) => new Date(b.endsAt) > new Date() && b.status !== 'Cancelled');
  const overall = guest.value.satisfaction ?? 9.5;
  const sat = SAT_AREAS.map(([l, delta, c]) => ({ l, c, v: Math.min(10, Math.round((overall + delta) * 10) / 10) }));
  const cancel = (b) =>
    guestsApi
      .updateBooking(guest.id, b.id, { status: 'Cancelled' })
      .then(() => {
        toast(`${b.title} cancelled`);
        setDetails(null);
        refresh();
      })
      .catch((e) => toast(e.message, 'error'));

  const automationRow = (a) => (
    <div key={a.id} className="row-line" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <Icon name={a.icon} size={22} color="var(--gold)" />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>{a.title}</span>
        <span className="sub">{a.detail}</span>
      </div>
      <Toggle on={a.enabled} onClick={() => automations.update(a.id, { enabled: !a.enabled }, `${a.title} ${a.enabled ? 'paused' : 'enabled'}`)} label={a.title} />
    </div>
  );

  const milestone = (b) => (
    <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: 8, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8 }}>
      <Placeholder label={IMG[b.type]} style={{ borderRadius: 6, minHeight: 96, padding: 6 }} />
      <div className="col" style={{ gap: 3 }}>
        <span className="sub">{slot(b.startsAt, b.endsAt)}</span>
        <span className="serif" style={{ fontSize: 19 }}>
          {b.title}
        </span>
        <span className="sub">
          {BOOKING_TYPES[b.type]?.label} · {b.status}
        </span>
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <button type="button" style={smallBtn(true)} onClick={() => setDetails(b)}>
            View Details
          </button>
          <button type="button" style={smallBtn(false)} onClick={() => actions.open('reschedule', { booking: b })}>
            Modify
          </button>
        </div>
      </div>
    </div>
  );

  const rec = (r) => (
    <div key={r.t} className="col" style={{ gap: 4, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden' }}>
      <Placeholder label={r.img} labelSize={9} style={{ height: 70, padding: 5 }} />
      <div className="col" style={{ padding: '4px 8px 8px', gap: 4 }}>
        <span style={{ fontSize: 13 }}>{r.t}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.d}</span>
        <button type="button" className="cta-sm" style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }} onClick={() => actions.open('booking', { type: r.type, title: r.t })}>
          {r.cta}
        </button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        <GuestPicker value={guestId} onChange={(id) => setParams({ guest: String(id) })} />
        <button type="button" className="fay-btn-outline" style={{ background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }} onClick={() => navigate(`/guest360?guest=${guestId}`)}>
          <Icon name="person" size={18} />
          Open Guest 360
        </button>
      </div>

      {/* Profile banner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <Placeholder label="guest portrait" style={{ width: 150, height: 130, borderRadius: 8, display: 'flex', alignItems: 'flex-end', padding: 8 }} />
        <div className="col" style={{ gap: 6, flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="serif" style={{ fontSize: 32, fontWeight: 600 }}>
              {guest.name}
            </span>
            {guest.vip && <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>VIP</span>}
            <span style={{ background: guest.status === 'In House' ? 'var(--green)' : '#3a3f48', padding: '2px 10px', borderRadius: 4, fontSize: 13 }}>{guest.status}</span>
          </div>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            {guest.collection} · {guest.residence}
          </span>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            {fmtDate(guest.checkIn)} – {fmtDate(guest.checkOut)} ({nights(guest)} nights)
          </span>
        </div>
        <div className="col" style={{ gap: 6, padding: '0 20px', borderLeft: '1px solid var(--border)', fontSize: 14 }}>
          <span>{guest.contact.phone}</span>
          <span>{guest.contact.email}</span>
          <span>
            {guest.contact.country} · {guest.contact.language}
          </span>
          <span style={{ color: 'var(--muted)' }}>Local Time {moment().format('HH:mm')}</span>
        </div>
        <div className="col" style={{ flex: '1 1 240px', padding: 14, border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Journey Progress</span>
          <span className="serif" style={{ fontSize: 26, color: 'var(--green-bright)' }}>
            {STAGES[cur][0] === 'Stay' ? 'In House' : STAGES[cur][0]}
          </span>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1f9d55,#3fd283)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
            <span>
              Stage {cur + 1} of {STAGES.length}
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Stage stepper */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
        {STAGES.map(([label, icon], i) => {
          const s = stageStyle(i, cur);
          return (
            <div key={label} className="col" style={{ alignItems: 'center', gap: 8, minWidth: 74 }}>
              <span
                className="icon"
                style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: `2px solid ${s.border}`, background: s.bg, color: s.icon }}
              >
                {icon}
              </span>
              <span style={{ fontSize: 13, color: s.text }}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid-cols">
        <Card title="Journey Timeline" link="View All Events ›" onLink={() => setView('events')} gap={0} headGap={10}>
          {events.slice(-11).map(EventRow)}
        </Card>

        <div className="stack">
          <Card
            title="Upcoming Milestones"
            aside={
              <span style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="card-link" onClick={() => actions.open('booking', { type: 'wellness' })}>
                  + Book
                </button>
                <button type="button" className="card-link" onClick={() => setView('milestones')}>
                  View All ›
                </button>
              </span>
            }
          >
            {upcoming.length ? upcoming.slice(0, 3).map(milestone) : <span className="sub">Nothing booked yet — use “+ Book” or a recommendation.</span>}
          </Card>
          <Card title="Personalized Recommendations" link="View All ›" onLink={() => setView('recs')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>{RECS.slice(0, 3).map(rec)}</div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Automations" link="Manage ›" onLink={() => setView('automations')} gap={8}>
            {automations.items.slice(0, 5).map(automationRow)}
          </Card>
          <Card title="Guest Satisfaction" link="View Details ›" onLink={() => setView('satisfaction')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
              <div className="col" style={{ alignItems: 'center', padding: '14px 18px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }}>
                <span className="serif" style={{ fontSize: 32 }}>
                  {overall}
                  <span style={{ fontSize: 18, color: 'var(--muted)' }}> / 10</span>
                </span>
                <span style={{ fontSize: 14, color: overall >= 9 ? 'var(--green-bright)' : 'var(--gold)' }}>{overall >= 9 ? 'Excellent' : 'Good'}</span>
              </div>
              <div className="col" style={{ gap: 7 }}>
                {sat.map((s) => (
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

      <ViewAllDialog
        open={view === 'events'}
        onClose={() => setView(null)}
        title={`Journey Timeline · ${guest.name}`}
        items={[...events].reverse()}
        searchText={(e) => `${e.t} ${e.d}`}
        filters={{ options: ['All', 'Completed', 'Current', 'Upcoming'], get: (e) => e.s }}
        renderItem={EventRow}
      />
      <ViewAllDialog
        open={view === 'milestones'}
        onClose={() => setView(null)}
        title={`Bookings · ${guest.name}`}
        items={bookings.data}
        searchText={(b) => b.title}
        filters={{ options: ['All', 'Wellness', 'Dining', 'Experience', 'Transport'], get: (b) => BOOKING_TYPES[b.type]?.label }}
        renderItem={(b) => (
          <div key={b.id} style={{ marginBottom: 8 }}>
            {milestone(b)}
          </div>
        )}
      />
      <ViewAllDialog
        open={view === 'recs'}
        onClose={() => setView(null)}
        title={`Recommendations for ${guest.name}`}
        items={RECS}
        searchText={(r) => `${r.t} ${r.d}`}
        filters={{ options: ['All', 'Wellness', 'Dining', 'Experience'], get: (r) => BOOKING_TYPES[r.type].label }}
        renderItem={(r) => (
          <div key={r.t} style={{ display: 'inline-block', width: 'calc(33.3% - 8px)', minWidth: 180, margin: 4, verticalAlign: 'top' }}>
            {rec(r)}
          </div>
        )}
      />
      <ViewAllDialog
        open={view === 'automations'}
        onClose={() => setView(null)}
        title="Journey Automations"
        items={automations.items}
        searchText={(a) => `${a.title} ${a.detail}`}
        filters={{ options: ['All', 'Enabled', 'Paused'], get: (a) => (a.enabled ? 'Enabled' : 'Paused') }}
        renderItem={automationRow}
        action={
          <button type="button" className="btn-gold" style={{ border: 0, fontSize: 14, fontFamily: 'var(--sans)' }} onClick={() => setNewAutomation(true)}>
            <Icon name="add" size={18} />
            New Automation
          </button>
        }
      />
      <ViewAllDialog
        open={view === 'satisfaction'}
        onClose={() => setView(null)}
        title={`Satisfaction · ${guest.name}`}
        items={stays.data}
        header={
          <div className="col" style={{ gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sat.map((s) => (
                <Chip key={s.l} on={s.l === 'Overall'} style={{ padding: '6px 12px', fontSize: 13, cursor: 'default' }}>
                  {s.l}: {s.v}
                </Chip>
              ))}
            </div>
            <span className="sub">Scores per stay (post-stay and in-stay pulse surveys):</span>
            <HistoryHeader />
          </div>
        }
        renderItem={StayRow}
      />

      <Dialog open={!!details} onClose={() => setDetails(null)} fullWidth maxWidth="xs">
        {details && (
          <>
            <DialogTitle sx={{ fontFamily: 'var(--serif)', fontSize: 26 }}>{details.title}</DialogTitle>
            <DialogContent>
              <div className="col" style={{ gap: 8, fontSize: 14 }}>
                <span>
                  <Icon name={BOOKING_TYPES[details.type]?.icon} size={18} color={BOOKING_TYPES[details.type]?.color} /> {BOOKING_TYPES[details.type]?.label}
                </span>
                <span>{slot(details.startsAt, details.endsAt)}</span>
                <span>
                  {details.guests} guest{details.guests > 1 ? 's' : ''} · {details.status}
                </span>
                {details.notes && <span className="sub">{details.notes}</span>}
              </div>
            </DialogContent>
            <DialogActions>
              {details.status !== 'Cancelled' && (
                <Button color="error" onClick={() => cancel(details)}>
                  Cancel Booking
                </Button>
              )}
              <Button
                onClick={() => {
                  actions.open('reschedule', { booking: details });
                  setDetails(null);
                }}
              >
                Modify
              </Button>
              <Button variant="contained" onClick={() => setDetails(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <FormDialog
        open={newAutomation}
        title="New Automation"
        submitLabel="Create"
        fields={[
          { name: 'title', label: 'Name', required: true, autoFocus: true, helperText: 'e.g. Late checkout offer' },
          { name: 'detail', label: 'When / how', required: true, helperText: 'e.g. Day before departure at 6 PM via WhatsApp' },
          { name: 'icon', label: 'Icon', type: 'select', options: AUTOMATION_ICONS },
        ]}
        initial={{ icon: 'auto_awesome' }}
        onSubmit={(v) => automations.create({ ...v, enabled: true }, `${v.title} created`)}
        onClose={() => setNewAutomation(false)}
      />
      {dialogs}
    </div>
  );
}
