import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import moment from 'moment';
import { useCallback, useState } from 'react';
import { reservationsApi } from '../api';
import BookingCalendar from '../components/BookingCalendar';
import FormDialog from '../components/FormDialog';
import PaymentDialog from '../components/PaymentDialog';
import { Avatar, Card, Chip, Donut, Icon, KpiGrid, MediaCard, conic } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import useGuestOptions from '../hooks/useGuestOptions';
import { money } from './guest360/format';

const SC = {
  Expected: '#1f7a48',
  'Checked In': '#2f6fe8',
  'Checked Out': '#2f4d8f',
  'In Progress': '#2f6fe8',
  Pending: '#6b5a3a',
  Confirmed: '#1f7a48',
  Inquiry: '#6b5a3a',
  Cancelled: '#5c2b2b',
};
const TABS = ['Overview', 'Calendar', 'Booking List', 'Availability & Rates', 'Room Types', 'Packages', 'Groups & Events', 'Cancellations', 'Analytics'];
const VIEWS = ['month', 'week', 'day'];
const LEGEND = [
  { l: 'Serenity', c: '#2f6fe8' },
  { l: 'Villa Spectra', c: '#e8c46a' },
  { l: 'Allure Penthouse', c: '#e05858' },
  { l: 'Riviera', c: '#4fbf7a' },
  { l: 'Blocked', c: '#5c6270' },
];
const SOURCE_COLORS = { 'Direct Website': '#2f6fe8', 'Repeat Guests': '#1f9d55', 'Travel Partners': '#9b7bf0', Corporate: '#f06292', 'Events & Groups': '#e8b84a', 'Walk-in / Other': '#8f897d' };
const SOURCES = Object.keys(SOURCE_COLORS);
const SHORT = { 'Serenity Collection': 'Serenity', 'Riviera Collection': 'Riviera', 'Villa Spectra': 'Villa Spectra', 'Allure Penthouse': 'Allure Penthouse' };
const PREFIX = { 'Serenity Collection': 'Serenity', 'Riviera Collection': 'Riviera', 'Villa Spectra': 'Villa Spectra', 'Allure Penthouse': 'Allure Penthouse' };
const collectionOfResidence = (name) => Object.keys(PREFIX).find((c) => name.startsWith(PREFIX[c]));
const today = () => moment().format('YYYY-MM-DD');
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const range = (r) => `${moment(r.checkIn).format('MMM D')} – ${moment(r.checkOut).format('MMM D')}`;

function MovementRow({ m, kind, onAction }) {
  const next = kind === 'arrivals' ? (m.status === 'Expected' ? 'Checked In' : null) : ['Pending', 'In Progress'].includes(m.status) ? 'Checked Out' : null;
  return (
    <div key={m.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '62px 36px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.time}</span>
      <Avatar size={36} />
      <div className="col">
        <span style={{ fontSize: 14 }}>{m.guestName}</span>
        <span className="sub">
          {m.residence} · {m.guests} guests
        </span>
      </div>
      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[m.status] }}>{m.status}</span>
      {next ? (
        <button type="button" className="mini-btn" title={next === 'Checked In' ? 'Check in' : 'Check out'} aria-label={next === 'Checked In' ? 'Check in' : 'Check out'} onClick={() => onAction(m, next)}>
          <Icon name={next === 'Checked In' ? 'login' : 'logout'} size={18} />
        </button>
      ) : (
        <span style={{ width: 30 }} />
      )}
    </div>
  );
}

function BookingRow({ r, onOpen }) {
  return (
    <div
      key={r.id}
      className="row-line hov-row"
      onClick={() => onOpen(r)}
      style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1.2fr 1fr 80px 96px', gap: 8, alignItems: 'center', fontSize: 13, padding: '8px 4px', cursor: 'pointer' }}
    >
      <span style={{ color: 'var(--text-3)' }}>{r.number}</span>
      <span>{r.guestName}</span>
      <span style={{ color: 'var(--text-3)' }}>{r.residence}</span>
      <span style={{ color: 'var(--text-3)' }}>{range(r)}</span>
      <span>{money(r.totalAmount)}</span>
      <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[r.status] }}>{r.status}</span>
    </div>
  );
}
const BookingHeader = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1.2fr 1fr 80px 96px', gap: 8, fontSize: 12, color: 'var(--dim)', padding: '0 4px 6px', borderBottom: '1px solid var(--border)' }}>
    <span>Booking</span>
    <span>Guest</span>
    <span>Residence</span>
    <span>Dates</span>
    <span>Total</span>
    <span>Status</span>
  </div>
);

export default function Reservations() {
  const toast = useToast();
  const { options: guestOptions, byId } = useGuestOptions();
  const [tab, setTab] = useState(0);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(() => new Date());
  const [paying, setPaying] = useState(null);
  const [open, setOpen] = useState(null);
  const [viewAll, setViewAll] = useState(null);
  const [form, setForm] = useState(null);
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((r) => r + 1), []);

  const all = useApi(() => reservationsApi.list(), [rev], []);
  const movements = useApi(reservationsApi.today, [rev], { arrivals: [], departures: [] });
  const roomTypes = useCollection('roomTypes');
  const packages = useCollection('packages');
  const groups = useCollection('groups');

  const reservations = all.data || [];
  const active = reservations.filter((r) => r.status !== 'Cancelled');
  const cancelled = reservations.filter((r) => r.status === 'Cancelled');
  const { arrivals, departures } = movements.data || { arrivals: [], departures: [] };
  const shift = (dir) => setDate((d) => moment(d).add(dir, view).toDate());

  // Inventory: every residence of every room type, and what is occupied tonight.
  const residences = roomTypes.items.flatMap((t) => Array.from({ length: t.units }, (_, i) => ({ name: `${PREFIX[t.collection]} ${i + 1}`, type: t })));
  const t0 = today();
  const tonight = active.filter((r) => r.checkIn <= t0 && r.checkOut > t0);
  // Occupied tonight = stays on the calendar + guests checked in (Guest 360), so every page agrees.
  const inHouse = Object.values(byId).filter((g) => g.status === 'In House');
  const busy = new Set([...tonight.map((r) => r.residence), ...inHouse.map((g) => g.residence)]);
  const rooms = roomTypes.items.map((t) => {
    const units = residences.filter((x) => x.type.id === t.id);
    const free = units.filter((x) => !busy.has(x.name)).length;
    return { ...t, free, w: `${pct(t.units - free, t.units)}%` };
  });
  const occupancy = pct(busy.size, residences.length);
  const next7 = moment().add(7, 'days').format('YYYY-MM-DD');
  const kpis = [
    { icon: 'bed', c: '#3fd283', n: `${occupancy}%`, l: 'Occupancy Tonight', d: `${busy.size} of ${residences.length} residences`, dc: '#8f897d' },
    { icon: 'groups', c: '#5b8ff0', n: String(active.length), l: 'Active Bookings' },
    { icon: 'payments', c: '#e8b84a', n: money(active.reduce((s, r) => s + (r.totalAmount || 0), 0)), l: 'Booking Revenue' },
    { icon: 'flight_land', c: '#9b7bf0', n: String(active.filter((r) => r.checkIn >= t0 && r.checkIn <= next7).length), l: 'Arrivals (7 days)' },
    { icon: 'logout', c: '#5b8ff0', n: String(active.filter((r) => r.checkOut >= t0 && r.checkOut <= next7).length), l: 'Departures (7 days)' },
  ];
  const sources = SOURCES.map((l) => ({ l, c: SOURCE_COLORS[l], n: active.filter((r) => r.source === l).length })).filter((s) => s.n);
  const recent = [...reservations].sort((a, b) => (a.bookedAt < b.bookedAt ? 1 : -1));

  const setMovement = (kind) => (m, status) =>
    reservationsApi
      .updateMovement(kind, m.id, status)
      .then(() => {
        toast(`${m.guestName} ${status.toLowerCase()}`);
        refresh();
      })
      .catch((e) => toast(e.message, 'error'));
  const setStatus = (r, status) =>
    reservationsApi
      .update(r.id, { status })
      .then(() => {
        toast(`${r.number} ${status.toLowerCase()}`);
        setOpen(null);
        refresh();
      })
      .catch((e) => toast(e.message, 'error'));

  const residenceOptions = residences.map((x) => [x.name, `${x.name} · ${money(x.type.rate)}/night`]);
  const newReservation = (preset = {}) => {
    const pkg = preset.package;
    const collection = pkg?.collection || roomTypes.items[0]?.collection;
    setForm({
      guestId: guestOptions[0]?.[0] || '',
      residence: residences.find((x) => x.type.collection === collection && !busy.has(x.name))?.name || residences[0]?.name,
      checkIn: moment().add(1, 'day').format('YYYY-MM-DD'),
      checkOut: moment()
        .add(1 + (pkg?.nights || 2), 'days')
        .format('YYYY-MM-DD'),
      guests: 2,
      source: 'Direct Website',
      packageId: pkg?.id || '',
    });
  };
  const createReservation = (v) => {
    const unit = residences.find((x) => x.name === v.residence);
    const nights = moment(v.checkOut).diff(moment(v.checkIn), 'days');
    if (nights < 1) return Promise.reject(new Error('Check-out must be after check-in'));
    const pkg = packages.items.find((p) => p.id === Number(v.packageId));
    const guest = byId[v.guestId];
    return reservationsApi
      .create({
        guestId: guest?.id,
        guestName: guest?.name || v.guestName,
        residence: v.residence,
        collection: SHORT[unit.type.collection],
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        guests: Number(v.guests),
        source: v.source,
        packageId: pkg?.id,
        package: pkg?.name,
        totalAmount: nights * (pkg ? pkg.price : unit.type.rate),
      })
      .then((r) => {
        toast(`${r.number} confirmed – ${r.guestName}, ${r.residence}`);
        setDate(moment(r.checkIn).toDate());
        refresh();
      });
  };

  const movementCard = (kind, title, rows) => (
    <Card title={`${title} (${rows.length})`} link="View All ›" onLink={() => setViewAll(kind)} gap={4} headGap={6}>
      {rows.slice(0, 5).map((m) => (
        <MovementRow key={m.id} m={m} kind={kind} onAction={setMovement(kind)} />
      ))}
    </Card>
  );

  const calendarCard = (extra = {}) => (
    <Card
      title="Booking Calendar"
      style={{ gridRow: 'span 2', ...extra }}
      aside={
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map((l) => (
            <Chip key={l} on={l === view} onClick={() => setView(l)} style={{ padding: '5px 14px', borderRadius: 4, fontSize: 13, textTransform: 'capitalize' }}>
              {l}
            </Chip>
          ))}
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 16 }}>
        <Icon name="chevron_left" style={{ cursor: 'pointer' }} onClick={() => shift(-1)} />
        {view === 'week' ? moment(date).startOf('week').format('[Week of] MMM D') : moment(date).format(view === 'day' ? 'ddd, MMM D, YYYY' : 'MMMM YYYY')}
        <Icon name="chevron_right" style={{ cursor: 'pointer' }} onClick={() => shift(1)} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Click a stay for details</span>
      </div>
      <BookingCalendar reservations={active} view={view} onView={setView} date={date} onNavigate={setDate} onSelect={setOpen} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
        {LEGEND.map((l) => (
          <span key={l.l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.c }} />
            {l.l}
          </span>
        ))}
      </div>
    </Card>
  );

  const roomsCard = (
    <Card title="Room Availability (tonight)" link="View All ›" onLink={() => setViewAll('rooms')}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {rooms.map((r) => (
          <MediaCard key={r.id} img="residence photo" imgHeight={64}>
            <span style={{ fontSize: 13 }}>{r.collection}</span>
            <span className="sub">
              {r.free} available / {r.units}
            </span>
            <div style={{ height: 4, background: 'var(--track)', borderRadius: 2 }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--green)', width: r.w }} />
            </div>
          </MediaCard>
        ))}
      </div>
    </Card>
  );

  const sourcesCard = (
    <Card title="Booking Sources">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Donut size={130} inner={96} gradient={sources.length ? conic(sources.map((s) => [s.c, pct(s.n, active.length)])) : '#262a31'}>
          <span className="serif" style={{ fontSize: 28 }}>
            {active.length}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Bookings</span>
        </Donut>
        <div className="col" style={{ gap: 5, fontSize: 12, flex: 1 }}>
          {sources.map((l) => (
            <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.c }} />
              <span style={{ flex: 1 }}>{l.l}</span>
              <span style={{ color: 'var(--text-3)' }}>{pct(l.n, active.length)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  const recentCard = (
    <Card title="Recent Bookings" link="View All ›" onLink={() => setViewAll('bookings')} gap={2} headGap={6}>
      {recent.slice(0, 5).map((r) => (
        <div
          key={r.id}
          className="row-line hov-row"
          onClick={() => setOpen(r)}
          style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 96px', gap: 8, alignItems: 'center', fontSize: 13, padding: '7px 0', cursor: 'pointer' }}
        >
          <span style={{ color: 'var(--text-3)' }}>{moment(r.bookedAt).format('MMM D')}</span>
          <span>{r.guestName}</span>
          <span style={{ color: 'var(--text-3)' }}>{r.residence}</span>
          <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[r.status] }}>{r.status}</span>
        </div>
      ))}
    </Card>
  );

  const packageTile = (p) => (
    <MediaCard key={p.id} bodyGap={3}>
      <span style={{ fontSize: 13 }}>{p.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
        {p.detail} · {p.nights} nights
      </span>
      <span className="serif" style={{ fontSize: 18 }}>
        From {money(p.price)}
      </span>
      <button type="button" className="cta-sm" onClick={() => newReservation({ package: p })}>
        Book Package
      </button>
    </MediaCard>
  );
  const packagesCard = (full) => (
    <Card
      title="Packages & Offers"
      style={full ? { gridColumn: '1 / -1' } : undefined}
      aside={
        <span style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="card-link" onClick={() => setForm({ kind: 'package' })}>
            + New
          </button>
          {!full && (
            <button type="button" className="card-link" onClick={() => setViewAll('packages')}>
              View All ›
            </button>
          )}
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: full ? 'repeat(auto-fill,minmax(180px,1fr))' : 'repeat(3,1fr)', gap: 8 }}>{(full ? packages.items : packages.items.slice(0, 3)).map(packageTile)}</div>
    </Card>
  );

  const groupRow = (g) => (
    <div key={g.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{g.dates}</span>
      <div className="col">
        <span style={{ fontSize: 14 }}>{g.name}</span>
        <span className="sub">
          {g.residences} · {g.guests} guests · {g.contact}
        </span>
      </div>
      <button
        type="button"
        title="Click to advance status"
        onClick={() => groups.update(g.id, { status: g.status === 'Inquiry' ? 'Pending' : g.status === 'Pending' ? 'Confirmed' : 'Inquiry' }, `${g.name} updated`)}
        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: SC[g.status], border: 0, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {g.status}
      </button>
    </div>
  );
  const groupsCard = (full) => (
    <Card
      title="Group & Event Reservations"
      style={full ? { gridColumn: '1 / -1' } : undefined}
      gap={4}
      headGap={6}
      aside={
        <span style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="card-link" onClick={() => setForm({ kind: 'group' })}>
            + New
          </button>
          {!full && (
            <button type="button" className="card-link" onClick={() => setViewAll('groups')}>
              View All ›
            </button>
          )}
        </span>
      }
    >
      {(full ? groups.items : groups.items.slice(0, 4)).map(groupRow)}
    </Card>
  );

  const listCard = (title, items, full = true) => (
    <Card title={`${title} (${items.length})`} style={full ? { gridColumn: '1 / -1' } : undefined} gap={2}>
      <BookingHeader />
      {items.length ? items.map((r) => <BookingRow key={r.id} r={r} onOpen={setOpen} />) : <span className="sub" style={{ padding: 16 }}>None.</span>}
    </Card>
  );

  const ratesCard = (
    <Card title="Availability & Rates" style={{ gridColumn: '1 / -1' }} gap={4}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: 8, fontSize: 12, color: 'var(--dim)', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span>Room type</span>
        <span>Available tonight</span>
        <span>Occupancy</span>
        <span>Nightly rate</span>
        <span />
      </div>
      {rooms.map((r) => (
        <div key={r.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', fontSize: 14, padding: '10px 0' }}>
          <span>{r.collection}</span>
          <span>
            {r.free} / {r.units}
          </span>
          <span>{r.w}</span>
          <span className="serif" style={{ fontSize: 18 }}>
            {money(r.rate)}
          </span>
          <button type="button" className="mini-btn" title="Edit rate" aria-label="Edit rate" onClick={() => setForm({ kind: 'rate', roomType: r })}>
            <Icon name="edit" size={16} />
          </button>
        </div>
      ))}
    </Card>
  );

  const roomTypesCard = (
    <Card title="Room Types" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
        {rooms.map((r) => (
          <MediaCard key={r.id} img="residence photo" imgHeight={110}>
            <span className="serif" style={{ fontSize: 20 }}>
              {r.collection}
            </span>
            <span className="sub">
              {r.units} residences · {r.bedrooms} bedrooms · up to {r.capacity} guests
            </span>
            <span className="sub">{r.view}</span>
            <span style={{ fontSize: 14 }}>From {money(r.rate)} / night</span>
          </MediaCard>
        ))}
      </div>
    </Card>
  );

  const byCollection = roomTypes.items.map((t) => ({ l: t.collection, v: active.filter((r) => collectionOfResidence(r.residence) === t.collection).reduce((s, r) => s + (r.totalAmount || 0), 0) }));
  const maxRev = Math.max(1, ...byCollection.map((b) => b.v));
  const analyticsCard = (
    <Card title="Revenue by Room Type" gap={10}>
      {byCollection.map((b) => (
        <div key={b.l} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span>{b.l}</span>
          <div style={{ height: 10, background: 'var(--track)', borderRadius: 5 }}>
            <div style={{ height: '100%', width: `${(b.v / maxRev) * 100}%`, background: 'var(--gold)', borderRadius: 5 }} />
          </div>
          <span style={{ textAlign: 'right' }}>{money(b.v)}</span>
        </div>
      ))}
      <span className="sub">
        Cancellation rate: {pct(cancelled.length, reservations.length)}% · Average stay: {active.length ? (active.reduce((s, r) => s + moment(r.checkOut).diff(moment(r.checkIn), 'days'), 0) / active.length).toFixed(1) : 0} nights
      </span>
    </Card>
  );

  const content = {
    Overview: (
      <>
        <div className="grid-cols">
          {calendarCard()}
          {movementCard('arrivals', "Today's Arrivals", arrivals)}
          {movementCard('departures', "Today's Departures", departures)}
          {roomsCard}
          {sourcesCard}
        </div>
        <div className="grid-cols">
          {recentCard}
          {packagesCard(false)}
          {groupsCard(false)}
        </div>
      </>
    ),
    Calendar: <div style={{ display: 'grid' }}>{calendarCard({ gridRow: 'auto' })}</div>,
    'Booking List': <div style={{ display: 'grid' }}>{listCard('All Bookings', recent)}</div>,
    'Availability & Rates': (
      <div className="grid-cols">
        {ratesCard}
        {roomsCard}
        {sourcesCard}
      </div>
    ),
    'Room Types': <div style={{ display: 'grid' }}>{roomTypesCard}</div>,
    Packages: <div style={{ display: 'grid' }}>{packagesCard(true)}</div>,
    'Groups & Events': <div style={{ display: 'grid' }}>{groupsCard(true)}</div>,
    Cancellations: <div style={{ display: 'grid' }}>{listCard('Cancellations', cancelled)}</div>,
    Analytics: (
      <div className="grid-cols">
        {sourcesCard}
        {analyticsCard}
        {roomsCard}
      </div>
    ),
  }[TABS[tab]];

  const formFields = {
    reservation: [
      { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
      { name: 'residence', label: 'Residence', type: 'select', options: residenceOptions, required: true },
      { name: 'checkIn', label: 'Check-in', type: 'date', required: true },
      { name: 'checkOut', label: 'Check-out', type: 'date', required: true },
      { name: 'guests', label: 'Guests', type: 'number', required: true },
      { name: 'source', label: 'Source', type: 'select', options: SOURCES },
      { name: 'packageId', label: 'Package (optional)', type: 'select', options: [['', 'No package'], ...packages.items.map((p) => [p.id, `${p.name} · ${money(p.price)}/night`])] },
    ],
    package: [
      { name: 'name', label: 'Package name', required: true },
      { name: 'detail', label: 'What’s included', required: true, helperText: 'e.g. Stay · Spa · Dining' },
      { name: 'price', label: 'Price per night (USD)', type: 'number', required: true },
      { name: 'nights', label: 'Minimum nights', type: 'number', required: true },
      { name: 'collection', label: 'Room type', type: 'select', options: roomTypes.items.map((t) => t.collection) },
    ],
    group: [
      { name: 'name', label: 'Group / event', required: true },
      { name: 'dates', label: 'Dates', required: true, helperText: 'e.g. Dec 5–7' },
      { name: 'residences', label: 'Residences / venues', required: true },
      { name: 'guests', label: 'Guests', type: 'number', required: true },
      { name: 'contact', label: 'Contact person', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Inquiry', 'Pending', 'Confirmed'] },
    ],
    rate: [{ name: 'rate', label: 'Nightly rate (USD)', type: 'number', required: true }],
  };
  const kind = form ? form.kind || 'reservation' : null;
  const submitForm = (v) => {
    if (kind === 'package') return packages.create({ ...v, price: Number(v.price), nights: Number(v.nights) }, `${v.name} added`);
    if (kind === 'group') return groups.create({ ...v, guests: Number(v.guests) }, `${v.name} added`);
    if (kind === 'rate') return roomTypes.update(form.roomType.id, { rate: Number(v.rate) }, `${form.roomType.collection} rate updated`);
    return createReservation(v);
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setDate(new Date());
            setView('month');
            setTab(TABS.indexOf('Calendar'));
          }}
          title="Jump to this month"
        >
          <Icon name="calendar_month" size={18} />
          {moment(date).format('MMMM YYYY')} ▾
        </button>
        <button type="button" className="btn-gold" onClick={() => newReservation()}>
          <Icon name="add" size={18} />
          New Reservation
        </button>
      </div>

      <KpiGrid items={kpis} min={200} iconSize={40} numSize={30} padding={16} gap={14} labelSize={14} deltaSize={13} />

      <div className="tabs" role="tablist">
        {TABS.map((t, i) => (
          <div key={t} role="tab" aria-selected={i === tab} className={`tab${i === tab ? ' on' : ''}`} onClick={() => setTab(i)}>
            {t}
          </div>
        ))}
      </div>

      {content}

      {/* Reservation details */}
      <Dialog open={!!open} onClose={() => setOpen(null)} fullWidth maxWidth="xs">
        {open && (
          <>
            <DialogTitle sx={{ fontFamily: 'var(--serif)', fontSize: 26 }}>
              {open.guestName}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)' }}>
                {open.number} · {open.status}
              </div>
            </DialogTitle>
            <DialogContent>
              <div className="col" style={{ gap: 6, fontSize: 14 }}>
                <span>{open.residence}</span>
                <span>
                  {moment(open.checkIn).format('ddd, MMM D')} → {moment(open.checkOut).format('ddd, MMM D, YYYY')} ({moment(open.checkOut).diff(moment(open.checkIn), 'days')} nights)
                </span>
                <span>
                  {open.guests} guests · {open.source}
                  {open.package ? ` · ${open.package}` : ''}
                </span>
                <span className="serif" style={{ fontSize: 22 }}>
                  {money(open.totalAmount)}
                </span>
              </div>
            </DialogContent>
            <DialogActions>
              {open.status === 'Pending' && <Button onClick={() => setStatus(open, 'Confirmed')}>Confirm</Button>}
              {open.status !== 'Cancelled' && (
                <Button color="error" onClick={() => setStatus(open, 'Cancelled')}>
                  Cancel Booking
                </Button>
              )}
              {open.status !== 'Cancelled' && (
                <Button
                  variant="contained"
                  onClick={() => {
                    setPaying(open);
                    setOpen(null);
                  }}
                >
                  Collect Payment
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <ViewAllDialog
        open={viewAll === 'arrivals' || viewAll === 'departures'}
        onClose={() => setViewAll(null)}
        title={viewAll === 'arrivals' ? "Today's Arrivals" : "Today's Departures"}
        items={viewAll === 'departures' ? departures : arrivals}
        searchText={(m) => `${m.guestName} ${m.residence}`}
        filters={{ options: ['All', ...Array.from(new Set((viewAll === 'departures' ? departures : arrivals).map((m) => m.status)))], get: (m) => m.status }}
        renderItem={(m) => <MovementRow key={m.id} m={m} kind={viewAll} onAction={setMovement(viewAll)} />}
      />
      <ViewAllDialog
        open={viewAll === 'rooms'}
        onClose={() => setViewAll(null)}
        title="Residences – availability tonight"
        items={residences}
        searchText={(x) => `${x.name} ${x.type.collection}`}
        filters={{ options: ['All', 'Available', 'Occupied'], get: (x) => (busy.has(x.name) ? 'Occupied' : 'Available') }}
        renderItem={(x) => {
          const stay = tonight.find((r) => r.residence === x.name) || (() => {
            const g = inHouse.find((h) => h.residence === x.name);
            return g && { guestName: g.name, checkOut: g.checkOut };
          })();
          return (
            <div key={x.name} className="row-line" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
              <span>{x.name}</span>
              <span className="sub">{stay ? `${stay.guestName} · until ${moment(stay.checkOut).format('MMM D')}` : `${money(x.type.rate)} / night`}</span>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: stay ? '#2f6fe8' : '#1f9d55' }}>{stay ? 'Occupied' : 'Available'}</span>
            </div>
          );
        }}
      />
      <ViewAllDialog
        open={viewAll === 'bookings'}
        onClose={() => setViewAll(null)}
        title="All Bookings"
        items={recent}
        searchText={(r) => `${r.number} ${r.guestName} ${r.residence} ${r.source}`}
        filters={{ options: ['All', 'Confirmed', 'Pending', 'Cancelled'], get: (r) => r.status }}
        header={<BookingHeader />}
        renderItem={(r) => <BookingRow key={r.id} r={r} onOpen={setOpen} />}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => newReservation()}>
            <Icon name="add" size={18} />
            New Reservation
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll === 'packages'}
        onClose={() => setViewAll(null)}
        title="Packages & Offers"
        items={packages.items}
        searchText={(p) => `${p.name} ${p.detail} ${p.collection}`}
        renderItem={(p) => (
          <div key={p.id} style={{ display: 'inline-block', width: 'calc(33.3% - 8px)', minWidth: 180, margin: 4, verticalAlign: 'top' }}>
            {packageTile(p)}
          </div>
        )}
      />
      <ViewAllDialog
        open={viewAll === 'groups'}
        onClose={() => setViewAll(null)}
        title="Group & Event Reservations"
        items={groups.items}
        searchText={(g) => `${g.name} ${g.residences} ${g.contact}`}
        filters={{ options: ['All', 'Confirmed', 'Pending', 'Inquiry'], get: (g) => g.status }}
        renderItem={groupRow}
      />

      <FormDialog
        open={!!form}
        title={{ reservation: 'New Reservation', package: 'New Package', group: 'New Group / Event', rate: `Nightly rate · ${form?.roomType?.collection || ''}` }[kind]}
        submitLabel={kind === 'reservation' ? 'Confirm Reservation' : 'Save'}
        fields={kind ? formFields[kind] : []}
        initial={kind === 'rate' ? { rate: form.roomType.rate } : kind === 'reservation' ? form : { status: 'Inquiry', collection: roomTypes.items[0]?.collection }}
        onSubmit={submitForm}
        onClose={() => setForm(null)}
      />
      <PaymentDialog reservation={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
