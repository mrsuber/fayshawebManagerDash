import moment from 'moment';
import { useCallback, useState } from 'react';
import { guestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import GuestPicker from '../components/GuestPicker';
import { Avatar, Card, Chip, Donut, Icon, KpiGrid, MediaCard, QuickActions, VenueTile } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import useGuestOptions from '../hooks/useGuestOptions';
import useGuestActions from './guest360/GuestActions';

const SC = { Completed: '#1f9d55', 'In Progress': '#2f6fe8', Upcoming: '#3a3f48', Confirmed: '#7c4ddb', Pending: '#2f6fe8', Cancelled: '#5c2b2b' };
const FLOW = ['Upcoming', 'In Progress', 'Completed'];
const VENUES = [
  { img: 'thermal suite photo', n: 'FAY Thermal Recovery Suite', d: 'Heat. Cool. Recover.', rooms: ['Recovery Suite'], ring: 'Recovery Suite', c: '#2f6fe8' },
  { img: 'gym photo', n: 'Signature Wellness Club', d: 'Move. Energize. Thrive.', rooms: ['Wellness Club'], ring: 'Wellness Club', c: '#1f9d55' },
  { img: 'treatment room photo', n: 'Spa Treatments', d: 'Rejuvenate. Restore. Renew.', rooms: ['Treatment Room 1', 'Treatment Room 2', 'Treatment Room 3'], ring: 'Spa', c: '#3fd283' },
  { img: 'float pool photo', n: 'FAY FLOAT', d: 'Floating meditation experience', rooms: ['FAY FLOAT'], ring: 'FAY FLOAT', c: '#e8b84a' },
];
const ROOMS = VENUES.flatMap((v) => v.rooms);
/** [treatment, default room, minutes] */
const TREATMENTS = [
  ['Deep Tissue Massage', 'Treatment Room 1', 60],
  ['Signature Facial', 'Treatment Room 2', 60],
  ['Hot Stone Massage', 'Treatment Room 3', 60],
  ['Couples Massage', 'Treatment Room 1', 60],
  ['FAY Thermal Recovery', 'Recovery Suite', 90],
  ['Red Light Therapy', 'Recovery Suite', 60],
  ['Yoga & Breathwork', 'Wellness Club', 60],
  ['Personal Training', 'Wellness Club', 60],
  ['Meditation Float', 'FAY FLOAT', 60],
];
const OPEN_HOURS = Array.from({ length: 12 }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
const RECS = [
  { t: 'Morning Recovery Session', d: 'Based on wellness preferences and activity level', treatment: 'FAY Thermal Recovery' },
  { t: 'Sunset Float Experience', d: 'Popular with guests this week', treatment: 'Meditation Float' },
  { t: 'Signature Massage', d: 'Available this evening', treatment: 'Deep Tissue Massage' },
];
const dotColor = (s) => (s === 'Completed' ? '#e8b84a' : s === 'In Progress' ? '#2f6fe8' : '#5c6270');
const mins = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function Wellness() {
  const toast = useToast();
  const { options: guestOptions, byId, firstId } = useGuestOptions();
  const schedule = useCollection('wellnessSchedule');
  const packages = useCollection('wellnessPackages');
  const [pickedId, setGuestId] = useState(null);
  const guestId = pickedId ?? firstId;
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((r) => r + 1), []);
  const profile = useApi(() => (guestId ? guestsApi.get(guestId) : Promise.resolve(null)), [guestId, rev]);
  const guest = profile.data?.id === guestId ? profile.data : null;
  const { actions, dialogs } = useGuestActions(guest, refresh);
  const [form, setForm] = useState(null);
  const [viewAll, setViewAll] = useState(null);

  const today = moment().format('YYYY-MM-DD');
  const todays = schedule.items.filter((x) => x.date === today).sort((a, b) => (a.start < b.start ? -1 : 1));
  const live = todays.filter((x) => x.status !== 'Cancelled');
  const count = (s) => todays.filter((x) => x.status === s).length;
  const bookedMinutes = (rooms) => live.filter((x) => rooms.includes(x.room)).reduce((s, x) => s + (mins(x.end) - mins(x.start)), 0);
  const rings = VENUES.map((v) => {
    const cap = v.rooms.length * OPEN_HOURS.length * 60;
    const used = bookedMinutes(v.rooms);
    return { n: v.ring, c: v.c, v: `${Math.round((used / cap) * 100)}%`, d: `${Math.round(used / 60)}/${v.rooms.length * OPEN_HOURS.length} hrs` };
  });
  const utilization = Math.round((live.reduce((s, x) => s + (mins(x.end) - mins(x.start)), 0) / (ROOMS.length * OPEN_HOURS.length * 60)) * 100);
  const kpis = [
    { icon: 'event_note', c: '#3fd283', n: String(live.length), l: 'Bookings Today' },
    { icon: 'person', c: '#5b8ff0', n: String(count('In Progress')), l: 'In Progress' },
    { icon: 'verified', c: '#3fd283', n: String(count('Completed')), l: 'Completed Today' },
    { icon: 'hourglass_top', c: '#9b7bf0', n: String(count('Upcoming')), l: 'Upcoming' },
    { icon: 'speed', c: '#e8b84a', n: `${utilization}%`, l: 'Facility Utilization' },
    { icon: 'star', c: '#e8b84a', n: '9.6', l: 'Guest Satisfaction', d: '↑ 4%' },
  ];

  /** Book a treatment (rejects when the room is taken at that time). */
  const book = (v) => {
    const [, , length] = TREATMENTS.find(([t]) => t === v.treatment) || [null, null, 60];
    const start = mins(v.start);
    const end = toHHMM(start + Number(v.duration || length));
    const clash = schedule.items.find((x) => x.date === v.date && x.room === v.room && x.status !== 'Cancelled' && mins(x.start) < mins(end) && start < mins(x.end));
    if (clash) return Promise.reject(new Error(`${v.room} is booked ${clash.start}–${clash.end} (${clash.guestName})`));
    return schedule.create({ date: v.date, start: v.start, end, treatment: v.treatment, guestId: Number(v.guestId), room: v.room, status: 'Upcoming' }, `${v.treatment} booked ${v.start}–${end}`);
  };
  const openBooking = (preset = {}) => {
    const [treatment, room, length] = TREATMENTS.find(([t]) => t === preset.treatment) || TREATMENTS.find(([, r]) => r === preset.room) || TREATMENTS[0];
    setForm({ guestId: preset.guestId || guestId, treatment, room: preset.room || room, date: today, start: preset.start || '15:00', duration: length });
  };
  const advance = (x) => x.status !== 'Cancelled' && schedule.update(x.id, { status: FLOW[(FLOW.indexOf(x.status) + 1) % FLOW.length] }, `${x.treatment} · ${x.guestName}`);

  const scheduleRow = (x) => (
    <div key={x.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '14px 44px 40px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 0', opacity: x.status === 'Cancelled' ? 0.5 : 1 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${dotColor(x.status)}` }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.3 }}>
        {x.start}
        <br />
        {x.end}
      </span>
      <Avatar size={40} style={{ borderRadius: 6 }} />
      <div className="col" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14 }}>{x.treatment}</span>
        <span className="sub">
          {x.guestName} · {x.room}
          {x.date !== today ? ` · ${moment(x.date).format('MMM D')}` : ''}
        </span>
      </div>
      <button
        type="button"
        title="Click to advance status"
        onClick={() => advance(x)}
        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[x.status], border: 0, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {x.status}
      </button>
      {x.status === 'Upcoming' ? (
        <button type="button" className="mini-btn" title="Cancel booking" aria-label="Cancel booking" onClick={() => schedule.update(x.id, { status: 'Cancelled' }, `${x.treatment} cancelled`)}>
          <Icon name="close" size={16} />
        </button>
      ) : (
        <span style={{ width: 30 }} />
      )}
    </div>
  );
  const packageRow = (p) => (
    <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
      <Icon name="spa" size={26} color="var(--purple)" />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>{p.title}</span>
        <span className="sub">
          {p.guestName} · {moment(p.date).format('MMM D')}, {p.start} – {p.end}
        </span>
      </div>
      <button
        type="button"
        title={p.status === 'Pending' ? 'Confirm' : ''}
        onClick={() => p.status === 'Pending' && packages.update(p.id, { status: 'Confirmed' }, `${p.title} confirmed`)}
        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[p.status], border: 0, color: 'var(--text)', cursor: p.status === 'Pending' ? 'pointer' : 'default', fontFamily: 'var(--sans)' }}
      >
        {p.status}
      </button>
    </div>
  );
  const recommend = (r) => {
    if (!guest) return;
    guestsApi
      .sendMessage(guest.id, { channel: 'whatsapp', body: `Hi ${guest.name.split(' ')[0]}, we think you'd love our ${r.t.toLowerCase()} — ${r.d.toLowerCase()}. Shall I reserve a slot for you?` })
      .then(() => toast(`Recommendation sent to ${guest.name}`))
      .catch((e) => toast(e.message, 'error'));
  };
  const quick = [
    { icon: 'spa', c: '#9b7bf0', l: 'Book Treatment', onClick: () => openBooking({ treatment: 'Deep Tissue Massage' }) },
    { icon: 'hot_tub', c: '#4fc3f7', l: 'Book Recovery', onClick: () => openBooking({ treatment: 'FAY Thermal Recovery' }) },
    { icon: 'pool', c: '#4fc3f7', l: 'Book FAY FLOAT', onClick: () => openBooking({ treatment: 'Meditation Float' }) },
    { icon: 'redeem', c: '#f06292', l: 'Packages', onClick: () => setViewAll({ kind: 'packages' }) },
    { icon: 'event_available', c: '#5b8ff0', l: 'Availability', onClick: () => setViewAll({ kind: 'availability' }) },
    { icon: 'edit_calendar', c: '#e6e0d4', l: 'Manage Booking', onClick: () => setViewAll({ kind: 'schedule' }) },
  ];
  const wellnessPrefs = guest ? guest.preferences.filter((p) => ['Wellness & Recovery', 'Experiences', 'Special Occasions'].includes(p.title)) : [];
  const freeSlots = (room) => OPEN_HOURS.filter((h) => !live.some((x) => x.room === room && mins(x.start) < mins(h) + 60 && mins(h) < mins(x.end)));

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="fay-btn-outline" onClick={() => setViewAll({ kind: 'availability' })}>
          <Icon name="event_available" size={18} />
          Availability
        </button>
        <button type="button" className="btn-gold" onClick={() => openBooking()}>
          <Icon name="add" size={18} />
          New Booking
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {VENUES.map((v) => (
          <VenueTile key={v.n} img={v.img} n={v.n} d={v.d} height={170} onClick={() => setViewAll({ kind: 'venue', venue: v })} />
        ))}
      </div>

      <KpiGrid items={kpis} min={160} iconSize={32} />

      <div className="grid-cols">
        <Card title={`Today's Schedule (${live.length})`} link="View Full Schedule ›" onLink={() => setViewAll({ kind: 'schedule' })} gap={2} headGap={8}>
          {todays.slice(0, 9).map(scheduleRow)}
        </Card>

        <div className="stack">
          <Card title="Facility Utilization (today)" gap={12}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {rings.map((r) => (
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
          <Card title="FAY AI Wellness Recommendations" gap={8} aside={<span className="sub">Sends to the selected guest</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {RECS.map((r) => (
                <MediaCard key={r.t}>
                  <span style={{ fontSize: 13 }}>{r.t}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{r.d}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="cta-sm" style={{ flex: 1 }} onClick={() => recommend(r)}>
                      Recommend
                    </button>
                    <button type="button" className="mini-btn" title="Book now" aria-label="Book now" onClick={() => openBooking({ treatment: r.treatment })}>
                      <Icon name="add" size={16} />
                    </button>
                  </div>
                </MediaCard>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Guest Wellness Profile" link="Edit ›" onLink={() => actions.open('preferences')} gap={6}>
            <GuestPicker value={guestId} onChange={setGuestId} minWidth="100%" />
            {wellnessPrefs.map((p) => (
              <div key={p.key} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                <Icon name={p.icon} size={22} color={p.color} />
                <div className="col">
                  <span style={{ fontSize: 14 }}>{p.title}</span>
                  <span className="sub">{p.detail}</span>
                </div>
              </div>
            ))}
            {guest && (
              <span className="sub">
                {schedule.items.filter((x) => x.guestId === guest.id && x.status !== 'Cancelled').length} wellness bookings ·{' '}
                <button type="button" className="card-link" onClick={() => setViewAll({ kind: 'guest' })}>
                  view
                </button>
              </span>
            )}
          </Card>
          <Card
            title="Upcoming Packages"
            gap={6}
            aside={
              <span style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="card-link" onClick={() => setForm({ kind: 'package' })}>
                  + Add
                </button>
                <button type="button" className="card-link" onClick={() => setViewAll({ kind: 'packages' })}>
                  View All ›
                </button>
              </span>
            }
          >
            {packages.items.slice(0, 3).map(packageRow)}
          </Card>
          <Card title="Quick Actions">
            <QuickActions items={quick} />
          </Card>
        </div>
      </div>

      <ViewAllDialog
        open={['schedule', 'venue', 'guest'].includes(viewAll?.kind)}
        onClose={() => setViewAll(null)}
        title={viewAll?.kind === 'venue' ? viewAll.venue.n : viewAll?.kind === 'guest' ? `Wellness · ${guest?.name}` : 'Wellness Schedule'}
        items={[...schedule.items]
          .filter((x) => (viewAll?.kind === 'venue' ? viewAll.venue.rooms.includes(x.room) : viewAll?.kind === 'guest' ? x.guestId === guest?.id : true))
          .sort((a, b) => (`${a.date}${a.start}` < `${b.date}${b.start}` ? -1 : 1))}
        searchText={(x) => `${x.treatment} ${x.guestName} ${x.room}`}
        filters={{ options: ['All', 'Upcoming', 'In Progress', 'Completed', 'Cancelled'], get: (x) => x.status }}
        renderItem={scheduleRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => openBooking(viewAll?.kind === 'venue' ? { room: viewAll.venue.rooms[0] } : {})}>
            <Icon name="add" size={18} />
            New Booking
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll?.kind === 'packages'}
        onClose={() => setViewAll(null)}
        title="Wellness Packages"
        items={packages.items}
        searchText={(p) => `${p.title} ${p.guestName}`}
        filters={{ options: ['All', 'Confirmed', 'Pending'], get: (p) => p.status }}
        renderItem={packageRow}
      />
      <ViewAllDialog
        open={viewAll?.kind === 'availability'}
        onClose={() => setViewAll(null)}
        title="Availability Today"
        items={ROOMS}
        searchText={(r) => r}
        renderItem={(room) => (
          <div key={room} className="row-line" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 14 }}>{room}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {OPEN_HOURS.map((h) => {
                const free = freeSlots(room).includes(h);
                return (
                  <Chip key={h} on={false} onClick={free ? () => openBooking({ room, start: h }) : undefined} style={{ padding: '3px 8px', fontSize: 12, borderRadius: 4, opacity: free ? 1 : 0.35, cursor: free ? 'pointer' : 'default', textDecoration: free ? 'none' : 'line-through' }}>
                    {h}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
        header={<span className="sub">Tap a free slot to book it.</span>}
      />

      <FormDialog
        open={!!form && form.kind !== 'package'}
        title="Book Wellness"
        submitLabel="Book"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'treatment', label: 'Treatment', type: 'select', options: TREATMENTS.map(([t]) => t) },
          { name: 'room', label: 'Room', type: 'select', options: ROOMS },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'start', label: 'Start', type: 'time', required: true },
          { name: 'duration', label: 'Duration (min)', type: 'select', options: [30, 45, 60, 90, 120] },
        ]}
        initial={form || {}}
        onSubmit={book}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'package'}
        title="Add Wellness Package"
        submitLabel="Add"
        fields={[
          { name: 'title', label: 'Package', type: 'select', options: ['FAY Recovery Package', 'Couples Wellness Ritual', 'Sleep Reset (3 days)', 'Detox & Glow', 'Athlete Recovery'] },
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'start', label: 'Start', type: 'time', required: true },
          { name: 'end', label: 'End', type: 'time', required: true },
        ]}
        initial={{ title: 'FAY Recovery Package', guestId, date: moment().add(1, 'day').format('YYYY-MM-DD'), start: '10:00', end: '12:00' }}
        onSubmit={(v) => packages.create({ ...v, guestId: Number(v.guestId), guestName: byId[v.guestId]?.name, status: 'Pending' }, `${v.title} added`)}
        onClose={() => setForm(null)}
      />
      {dialogs}
    </div>
  );
}
