import moment from 'moment';
import { useCallback, useState } from 'react';
import { diningApi, guestsApi, serviceRequestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import GuestPicker from '../components/GuestPicker';
import { Card, Chip, Icon, KpiGrid, MediaCard, QuickActions, Toggle, VenueTile } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import useGuestOptions from '../hooks/useGuestOptions';
import useGuestActions from './guest360/GuestActions';
import { currencyCode, money } from './guest360/format';

const SC = { Completed: '#1f9d55', Seated: '#2f6fe8', Upcoming: '#3a3f48', Confirmed: '#7c4ddb', Cancelled: '#5c2b2b' };
const ORDER_STATUS = { Confirmed: ['#7c4ddb', '#fff'], Preparing: ['#e8c46a', '#1a1408'], Ready: ['#2f6fe8', '#fff'], Delivered: ['#1f9d55', '#fff'] };
const ORDER_FLOW = ['Confirmed', 'Preparing', 'Ready', 'Delivered'];
const TS = ['Available', 'Seated', 'Reserved', 'Cleaning'];
const TC = { Available: '#1f9d55', Seated: '#2f6fe8', Reserved: '#e8b84a', Cleaning: '#d94040' };
const VF = ['All', 'Riviera', 'Pool Club', 'Private Dining', 'In-Residence'];
const VENUES = [
  { img: 'riviera terrace', n: 'Riviera', d: 'Mediterranean · Ocean view' },
  { img: 'pool club', n: 'Pool Club', d: 'Light bites & bar' },
  { img: 'private dining room', n: 'Private Dining', d: 'Curated for you' },
  { img: 'in-residence dish', n: 'In-Residence', d: 'Comfort. Privacy.' },
];
const TABLE_PREFIX = { Riviera: 'R', 'Pool Club': 'P', 'Private Dining': 'PD', 'In-Residence': 'IR' };
const SPECIALS = [
  { n: 'Sunset Dinner', d: 'Riviera Terrace · 6 PM', venue: 'Riviera', time: '18:00', days: 1 },
  { n: 'Private Chef Experience', d: 'In-Residence · 7 PM', venue: 'In-Residence', time: '19:00', days: 2 },
  { n: 'Wine Pairing Night', d: 'Riviera · 7:30 PM', venue: 'Riviera', time: '19:30', days: 7 },
];
const DINING_PREFS = ['Dining', 'Special Occasions', 'Communication'];
const RESV_COLS = '44px 1fr 30px 1fr 46px 88px';
const TIMES = Array.from({ length: 26 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export default function Dining() {
  const toast = useToast();
  const { options: guestOptions, byId, firstId } = useGuestOptions();
  const [f, setF] = useState(0);
  const [form, setForm] = useState(null);
  const [viewAll, setViewAll] = useState(null);
  const [pickedId, setGuestId] = useState(null);
  const guestId = pickedId ?? firstId;
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((r) => r + 1), []);

  const tableQ = useApi(diningApi.tables, [], []);
  const tables = (tableQ.data || []).map((t) => ({ id: t.id, s: t.status, who: t.guestName }));
  const resv = useCollection('diningReservations');
  const orders = useCollection('diningOrders');
  const menu = useCollection('menuItems');
  const profile = useApi(() => (guestId ? guestsApi.get(guestId) : Promise.resolve(null)), [guestId, rev]);
  const guest = profile.data?.id === guestId ? profile.data : null;
  const { actions, dialogs } = useGuestActions(guest, refresh);

  const today = moment().format('YYYY-MM-DD');
  const todays = resv.items.filter((r) => r.date === today).sort((a, b) => (a.time < b.time ? -1 : 1));
  const rows = todays.filter((r) => f === 0 || r.venue === VF[f]);
  const live = todays.filter((r) => r.status !== 'Cancelled');
  const kpis = [
    { icon: 'restaurant', c: '#e8b84a', n: String(live.reduce((s, r) => s + Number(r.covers || 0), 0)), l: 'Total Covers' },
    { icon: 'event_available', c: '#5b8ff0', n: String(live.filter((r) => r.source !== 'Walk-in').length), l: 'Reservations' },
    { icon: 'directions_walk', c: '#3fd283', n: String(live.filter((r) => r.source === 'Walk-in').length), l: 'Walk-ins' },
    { icon: 'donut_large', c: '#9b7bf0', n: `${Math.round((tables.filter((t) => t.s !== 'Available').length / Math.max(1, tables.length)) * 100)}%`, l: 'Table Utilization' },
    { icon: 'receipt_long', c: '#e8b84a', n: String(orders.items.filter((o) => o.status !== 'Delivered').length), l: 'Open Orders' },
    { icon: 'payments', c: '#e8b84a', n: money(orders.items.reduce((s, o) => s + Number(o.total || 0), 0)), l: 'Orders Revenue' },
  ];

  const setTable = (id, changes) => {
    tableQ.setData((ts) => ts.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    return diningApi.setTable(id, changes).catch((e) => {
      toast(e.message, 'error');
      tableQ.reload();
    });
  };
  const cycle = (t) => setTable(t.id, { status: TS[(TS.indexOf(t.s) + 1) % TS.length], ...(t.s === 'Seated' ? { guestName: '' } : {}) });
  const short = (name) => {
    const p = (name || '').split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p[p.length - 1]}` : name;
  };

  /** Seat → table goes Seated; Complete → table goes Cleaning. */
  const advance = (r) => {
    const next = r.status === 'Confirmed' || r.status === 'Upcoming' ? 'Seated' : r.status === 'Seated' ? 'Completed' : null;
    if (!next) return;
    resv.update(r.id, { status: next }, `${r.guestName} ${next.toLowerCase()}`);
    if (tables.some((t) => t.id === r.table)) setTable(r.table, next === 'Seated' ? { status: 'Seated', guestName: short(r.guestName) } : { status: 'Cleaning', guestName: '' });
  };

  const nextTable = (venue) => {
    const used = new Set(todays.filter((r) => r.venue === venue).map((r) => r.table));
    const free = tables.find((t) => t.id.startsWith(`${TABLE_PREFIX[venue]}-`) && t.s === 'Available' && !used.has(t.id));
    if (free) return free.id;
    let n = 1;
    while (used.has(`${TABLE_PREFIX[venue]}-${String(n).padStart(2, '0')}`)) n += 1;
    return `${TABLE_PREFIX[venue]}-${String(n).padStart(2, '0')}`;
  };
  const openReservation = (preset = {}) =>
    setForm({ kind: 'reservation', guestId: preset.guestId || guestId, venue: preset.venue || 'Riviera', time: preset.time || '20:00', covers: preset.covers || 2, date: preset.date || today, notes: preset.notes || '', walkIn: preset.walkIn });
  const saveReservation = (v) => {
    const g = byId[v.guestId];
    const table = nextTable(v.venue);
    const walkIn = !!form?.walkIn;
    return resv
      .create(
        { date: v.date, time: v.time, guestId: Number(v.guestId), covers: Number(v.covers), venue: v.venue, table, status: walkIn ? 'Seated' : 'Confirmed', source: walkIn ? 'Walk-in' : 'Reservation', notes: v.notes },
        `${walkIn ? 'Walk-in seated' : 'Table booked'} – ${g?.name || 'guest'}, ${v.venue} ${v.time} (${table})`,
      )
      .then(() => {
        if (tables.some((t) => t.id === table) && v.date === today) setTable(table, walkIn ? { status: 'Seated', guestName: short(g?.name) } : { status: 'Reserved', guestName: short(g?.name) });
      });
  };
  const saveOrder = (v) => {
    const g = byId[v.guestId];
    const picked = menu.items.filter((m) => (v.items || []).includes(m.name));
    const number = `#D${Math.max(400, ...orders.items.map((o) => Number(String(o.number).replace(/\D/g, '')) || 0)) + 1}`;
    if (!picked.length) return Promise.reject(new Error('Pick at least one dish'));
    return orders.create(
      {
        number,
        venue: v.venue,
        items: picked.map((m) => m.name).join(', '),
        time: moment().format('HH:mm'),
        location: v.venue === 'In-Residence' ? g?.residence : v.location || v.venue,
        status: 'Confirmed',
        guestId: Number(v.guestId),
        total: picked.reduce((s, m) => s + m.price, 0),
      },
      `${number} sent to the kitchen`,
    );
  };

  const resvRow = (r) => (
    <div key={r.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: `${RESV_COLS} 30px`, gap: 8, alignItems: 'center', fontSize: 13, padding: '7px 0', opacity: r.status === 'Cancelled' ? 0.5 : 1 }}>
      <span style={{ color: 'var(--text-3)' }}>{r.time}</span>
      <span>
        {r.guestName}
        {r.date !== today && <span className="sub"> · {moment(r.date).format('MMM D')}</span>}
      </span>
      <span style={{ color: 'var(--text-3)' }}>{r.covers}</span>
      <span style={{ color: 'var(--text-3)' }}>{r.venue}</span>
      <span style={{ color: 'var(--muted)' }}>{r.table}</span>
      <button
        type="button"
        title={r.status === 'Seated' ? 'Complete' : ['Confirmed', 'Upcoming'].includes(r.status) ? 'Seat guest' : ''}
        onClick={() => advance(r)}
        style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[r.status], border: 0, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {r.status}
      </button>
      {['Confirmed', 'Upcoming'].includes(r.status) ? (
        <button type="button" className="mini-btn" title="Cancel" aria-label="Cancel" onClick={() => resv.update(r.id, { status: 'Cancelled' }, `${r.guestName} – reservation cancelled`)}>
          <Icon name="close" size={14} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
  const orderRow = (o) => {
    const [bg, fg] = ORDER_STATUS[o.status] || ['#3a3f48', '#fff'];
    return (
      <div key={o.id} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
        <Icon name="receipt_long" size={22} color="var(--gold)" />
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13 }}>
            {o.number} · {o.venue} · {money(o.total)}
          </span>
          <span className="sub">
            {o.items} · {o.location} · {o.time}
          </span>
        </div>
        <button
          type="button"
          title={o.status !== 'Delivered' ? 'Advance' : ''}
          onClick={() => o.status !== 'Delivered' && orders.update(o.id, { status: ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1] }, `${o.number} → ${ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1]}`)}
          style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: bg, color: fg, border: 0, cursor: o.status !== 'Delivered' ? 'pointer' : 'default', fontFamily: 'var(--sans)' }}
        >
          {o.status}
        </button>
      </div>
    );
  };
  const menuTile = (m) => (
    <MediaCard key={m.id} img="dish photo" imgHeight={80} bodyGap={2}>
      <span style={{ fontSize: 13 }}>{m.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
        {m.venue} · {m.category}
      </span>
      <span className="serif" style={{ fontSize: 18 }}>
        {money(m.price)}
      </span>
    </MediaCard>
  );
  const menuRow = (m) => (
    <div key={m.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 70px auto', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
      <span style={{ opacity: m.available ? 1 : 0.5 }}>
        {m.name}
        {m.popular && <Icon name="local_fire_department" size={16} color="var(--gold)" style={{ marginLeft: 4 }} />}
      </span>
      <span className="sub">{m.venue}</span>
      <span className="sub">{m.category}</span>
      <span>{money(m.price)}</span>
      <Toggle size="sm" on={m.available} label={`${m.name} available`} onClick={() => menu.update(m.id, { available: !m.available }, `${m.name} ${m.available ? '86’d (unavailable)' : 'back on the menu'}`)} />
    </div>
  );

  const quick = [
    { icon: 'event_available', c: '#5b8ff0', l: 'New Reservation', onClick: () => openReservation() },
    { icon: 'person_add', c: '#5b8ff0', l: 'Walk-in Guest', onClick: () => openReservation({ walkIn: true, time: moment().format('HH:mm'), venue: 'Pool Club' }) },
    { icon: 'room_service', c: '#e8b84a', l: 'New Order', onClick: () => setForm({ kind: 'order', guestId, venue: 'Pool Club', items: [] }) },
    { icon: 'groups', c: '#f06292', l: 'Private Dining', onClick: () => openReservation({ venue: 'Private Dining', time: '19:30', covers: 6 }) },
    { icon: 'home', c: '#4fc3f7', l: 'In-Residence', onClick: () => setForm({ kind: 'order', guestId, venue: 'In-Residence', items: [] }) },
    { icon: 'edit_note', c: '#9b7bf0', l: 'Dietary Request', onClick: () => setForm({ kind: 'dietary', guestId }) },
  ];
  const popular = menu.items.filter((m) => m.popular && m.available);

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="fay-btn-outline" onClick={() => setForm({ kind: 'order', guestId, venue: 'Riviera', items: [] })}>
          <Icon name="room_service" size={18} />
          New Order
        </button>
        <button type="button" className="btn-gold" onClick={() => openReservation()}>
          <Icon name="add" size={18} />
          New Reservation
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {VENUES.map((v) => (
          <VenueTile key={v.n} {...v} height={160} onClick={() => setViewAll({ kind: 'resv', venue: v.n })} />
        ))}
      </div>

      <KpiGrid items={kpis} min={160} iconSize={32} />

      <div className="grid-cols">
        <Card title={`Today's Reservations (${live.length})`} link="View All ›" onLink={() => setViewAll({ kind: 'resv' })} gap={2} headGap={8}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {VF.map((l, i) => (
              <Chip key={l} on={i === f} onClick={() => setF(i)} style={{ padding: '5px 12px', borderRadius: 4, fontSize: 12 }}>
                {l}
              </Chip>
            ))}
          </div>
          {rows.length ? rows.map(resvRow) : <span className="sub">No reservations.</span>}
        </Card>

        <Card
          title={
            <span className="col">
              <span className="card-title">Floor Plan – Riviera</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--sans)', fontWeight: 400 }}>Real-time table status · tap to change</span>
            </span>
          }
          link="All Venues ›"
          onLink={() => setViewAll({ kind: 'venues' })}
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
            {tables.map((t) => (
              <div
                key={t.id}
                onClick={() => cycle(t)}
                className="col"
                style={{ aspectRatio: '1', borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', background: 'var(--surface-3)', border: `2px solid ${TC[t.s]}` }}
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
          <Card title="Dining Preferences" link="Edit ›" onLink={() => actions.open('preferences')} gap={6}>
            <GuestPicker value={guestId} onChange={setGuestId} minWidth="100%" />
            {guest?.preferences
              .filter((p) => DINING_PREFS.includes(p.title))
              .map((p) => (
                <div key={p.key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '5px 0' }}>
                  <Icon name={p.icon} size={22} color={p.color} />
                  <div className="col">
                    <span style={{ fontSize: 14 }}>{p.title}</span>
                    <span className="sub">{p.detail}</span>
                  </div>
                </div>
              ))}
          </Card>
          <Card
            title={`Active Orders (${orders.items.filter((o) => o.status !== 'Delivered').length})`}
            gap={6}
            aside={
              <span style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="card-link" onClick={() => setForm({ kind: 'order', guestId, venue: 'Riviera', items: [] })}>
                  + New
                </button>
                <button type="button" className="card-link" onClick={() => setViewAll({ kind: 'orders' })}>
                  View All ›
                </button>
              </span>
            }
          >
            {orders.items.slice(0, 3).map(orderRow)}
          </Card>
        </div>
      </div>

      <div className="grid-cols">
        <Card title="Popular Menu Items" link="View Menu ›" onLink={() => setViewAll({ kind: 'menu' })}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>{popular.slice(0, 4).map(menuTile)}</div>
        </Card>
        <Card title="Upcoming Special Experiences">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {SPECIALS.map((s) => (
              <MediaCard key={s.n} bodyGap={3}>
                <span style={{ fontSize: 13 }}>{s.n}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {s.d} · {moment().add(s.days, 'days').format('MMM D')}
                </span>
                <button
                  type="button"
                  className="cta-sm"
                  onClick={() => openReservation({ venue: s.venue, time: s.time, date: moment().add(s.days, 'days').format('YYYY-MM-DD'), notes: s.n })}
                >
                  Book Now
                </button>
              </MediaCard>
            ))}
          </div>
        </Card>
        <Card title="Quick Actions">
          <QuickActions items={quick} />
        </Card>
      </div>

      <ViewAllDialog
        open={viewAll?.kind === 'resv'}
        onClose={() => setViewAll(null)}
        title={viewAll?.venue ? `${viewAll.venue} · Reservations` : 'Dining Reservations'}
        items={[...resv.items].filter((r) => !viewAll?.venue || r.venue === viewAll.venue).sort((a, b) => (`${a.date}${a.time}` < `${b.date}${b.time}` ? -1 : 1))}
        searchText={(r) => `${r.guestName} ${r.venue} ${r.table} ${r.notes || ''}`}
        filters={{ options: ['All', 'Confirmed', 'Seated', 'Completed', 'Cancelled'], get: (r) => r.status }}
        renderItem={resvRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => openReservation(viewAll?.venue ? { venue: viewAll.venue } : {})}>
            <Icon name="add" size={18} />
            New Reservation
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll?.kind === 'venues'}
        onClose={() => setViewAll(null)}
        title="All Venues"
        items={VENUES}
        renderItem={(v) => {
          const vr = live.filter((r) => r.venue === v.n);
          return (
            <div
              key={v.n}
              className="row-line hov-row"
              onClick={() => setViewAll({ kind: 'resv', venue: v.n })}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', padding: '12px 4px', cursor: 'pointer' }}
            >
              <div className="col">
                <span className="serif" style={{ fontSize: 20 }}>
                  {v.n}
                </span>
                <span className="sub">{v.d}</span>
              </div>
              <span className="sub">{vr.length} reservations today</span>
              <span className="sub">{vr.reduce((s, r) => s + Number(r.covers), 0)} covers</span>
            </div>
          );
        }}
      />
      <ViewAllDialog
        open={viewAll?.kind === 'orders'}
        onClose={() => setViewAll(null)}
        title="Dining Orders"
        items={orders.items}
        searchText={(o) => `${o.number} ${o.items} ${o.venue} ${o.location} ${o.guestName || ''}`}
        filters={{ options: ['All', ...ORDER_FLOW], get: (o) => o.status }}
        renderItem={orderRow}
      />
      <ViewAllDialog
        open={viewAll?.kind === 'menu'}
        onClose={() => setViewAll(null)}
        title="Menu"
        items={menu.items}
        searchText={(m) => `${m.name} ${m.venue} ${m.category}`}
        filters={{ options: ['All', 'Riviera', 'Pool Club', 'In-Residence'], get: (m) => m.venue }}
        renderItem={menuRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setForm({ kind: 'menu' })}>
            <Icon name="add" size={18} />
            Add Dish
          </button>
        }
      />

      <FormDialog
        open={form?.kind === 'reservation'}
        title={form?.walkIn ? 'Seat Walk-in Guest' : 'New Dining Reservation'}
        submitLabel={form?.walkIn ? 'Seat Guest' : 'Book Table'}
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'venue', label: 'Venue', type: 'select', options: VF.slice(1) },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'time', label: 'Time', type: 'select', options: Array.from(new Set([...TIMES, form?.time].filter(Boolean))).sort() },
          { name: 'covers', label: 'Covers', type: 'number', required: true },
          { name: 'notes', label: 'Notes (allergies, occasion…)', type: 'textarea', rows: 2 },
        ]}
        initial={form || {}}
        onSubmit={saveReservation}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'order'}
        title={form?.venue === 'In-Residence' ? 'In-Residence Order' : 'New Order'}
        submitLabel="Send to Kitchen"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'venue', label: 'Venue', type: 'select', options: VF.slice(1) },
          { name: 'items', label: 'Dishes', type: 'tags', options: menu.items.filter((m) => m.available).map((m) => m.name), helperText: 'Pick from the menu' },
          { name: 'location', label: 'Deliver to (table / cabana)', helperText: 'In-Residence orders go to the guest’s residence' },
        ]}
        initial={form || {}}
        onSubmit={saveOrder}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'menu'}
        title="Add Dish"
        submitLabel="Add to Menu"
        fields={[
          { name: 'name', label: 'Dish', required: true },
          { name: 'venue', label: 'Venue', type: 'select', options: ['Riviera', 'Pool Club', 'In-Residence'] },
          { name: 'category', label: 'Category', type: 'select', options: ['Starter', 'Main', 'Dessert', 'Drinks', 'Breakfast', 'Tasting menu'] },
          { name: 'price', label: `Price (${currencyCode()})`, type: 'number', required: true },
        ]}
        initial={{ venue: 'Riviera', category: 'Main' }}
        onSubmit={(v) => menu.create({ ...v, price: Number(v.price), available: true, popular: false }, `${v.name} added to the menu`)}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'dietary'}
        title="Dietary Request"
        subtitle="Creates a Dining request and a note on the guest profile"
        submitLabel="Send to Kitchen"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'request', label: 'Requirement', type: 'select', options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Nut allergy', 'Shellfish allergy', 'Halal', 'Kosher', 'Low sodium'] },
          { name: 'notes', label: 'Details', type: 'textarea', rows: 2 },
        ]}
        initial={form || {}}
        onSubmit={(v) => {
          const g = byId[v.guestId];
          const title = `Dietary: ${v.request}`;
          return Promise.all([
            serviceRequestsApi.create({ guestId: Number(v.guestId), title, department: 'Dining', priority: 'High', location: g?.residence || 'Kitchen', notes: v.notes }),
            guestsApi.addNote(v.guestId, `${title}${v.notes ? ` — ${v.notes}` : ''}`),
          ]).then(() => toast(`${title} sent to the kitchen for ${g?.name}`));
        }}
        onClose={() => setForm(null)}
      />
      {dialogs}
    </div>
  );
}
