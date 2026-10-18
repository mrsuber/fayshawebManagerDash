import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import moment from 'moment';
import { useState } from 'react';
import FormDialog from '../components/FormDialog';
import { Avatar, Card, Chip, Icon, KpiGrid } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useCollection from '../hooks/useCollection';
import useGuestOptions from '../hooks/useGuestOptions';

const SC = { 'En Route': '#2f6fe8', Completed: '#1f9d55', Scheduled: '#3a3f48', Assigned: '#7c4ddb', Delayed: '#c43a3a', Cancelled: '#5c2b2b' };
const FLOW = ['Scheduled', 'Assigned', 'En Route', 'Completed'];
const KIND_ICON = { 'Airport arrival': 'flight_land', 'Airport departure': 'flight_takeoff', Resort: 'golf_course', Marina: 'sailing', Dining: 'restaurant', City: 'location_city', Wellness: 'spa' };
const FLEET_STATUS = { Available: '#3fd283', 'On Trip': '#5b8ff0', Assigned: '#9b7bf0', Active: '#3fd283', Booked: '#e8b84a', Maintenance: '#ff6b6b' };
const DRIVER_STATUS = { Available: '#3fd283', 'On Trip': '#5b8ff0', 'Off Duty': '#8f897d' };
const FLIGHT_STATUS = ['Scheduled', 'On Time', 'Delayed 25m', 'Landed', 'Departed'];
const flightColor = (s) => (s.startsWith('Delayed') ? '#ff6b6b' : s === 'On Time' || s === 'Landed' ? '#3fd283' : '#cfc8ba');
const PLACES = ['Airport', 'Marina', 'Pool Club', 'Riviera', 'Spa', 'Old Town', 'Golf Club', 'Serenity 1', 'Serenity 2', 'Serenity 3', 'Riviera 1', 'Riviera 2', 'Riviera 3', 'Riviera 4', 'Villa Spectra 1', 'Villa Spectra 2', 'Allure Penthouse 1', 'Allure Penthouse 2'];
/** Rough map positions (percent) for the live map. */
const POS = { Airport: [88, 18], Marina: [14, 78], 'Pool Club': [46, 62], Riviera: [58, 48], Spa: [40, 40], 'Old Town': [80, 72], 'Golf Club': [24, 30] };
const posOf = (place) => POS[place] || [30 + ((place.length * 7) % 40), 30 + ((place.length * 13) % 40)];
const cycleOf = (list, v) => list[(list.indexOf(v) + 1) % list.length];

export default function Transportation() {
  const toast = useToast();
  const { options: guestOptions, byId } = useGuestOptions();
  const transfers = useCollection('transfers');
  const fleet = useCollection('fleet');
  const drivers = useCollection('drivers');
  const flights = useCollection('flights');
  const [filter, setFilter] = useState('Today');
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const [viewAll, setViewAll] = useState(null);

  const today = moment().format('YYYY-MM-DD');
  const sorted = [...transfers.items].sort((a, b) => (`${a.date}${a.time}` < `${b.date}${b.time}` ? -1 : 1));
  const todays = sorted.filter((t) => t.date === today);
  const shown = filter === 'Today' ? todays : filter === 'Upcoming' ? sorted.filter((t) => t.date > today) : sorted;
  const enRoute = todays.filter((t) => t.status === 'En Route' || t.status === 'Delayed');
  const kpis = [
    { icon: 'local_taxi', c: '#e8b84a', n: String(todays.filter((t) => t.status !== 'Cancelled').length), l: 'Transfers Today' },
    { icon: 'route', c: '#5b8ff0', n: String(todays.filter((t) => t.status === 'En Route').length), l: 'En Route' },
    { icon: 'check_circle', c: '#3fd283', n: String(todays.filter((t) => t.status === 'Completed').length), l: 'Completed' },
    { icon: 'directions_car', c: '#3fd283', n: `${fleet.items.filter((v) => v.status === 'Available').length} / ${fleet.items.length}`, l: 'Vehicles Available' },
    { icon: 'badge', c: '#4fc3f7', n: `${drivers.items.filter((d) => d.status === 'Available').length} / ${drivers.items.length}`, l: 'Chauffeurs Available' },
    { icon: 'report', c: '#ff6b6b', n: String(todays.filter((t) => t.status === 'Delayed').length + flights.items.filter((f) => f.status.startsWith('Delayed')).length), l: 'Delays' },
  ];

  const openForm = (preset = {}) =>
    setForm({
      guestId: preset.guestId || guestOptions[0]?.[0] || '',
      kind: preset.kind || 'Resort',
      from: preset.from || byId[preset.guestId]?.residence || 'Serenity 1',
      to: preset.to || 'Pool Club',
      date: preset.date || today,
      time: preset.time || moment().add(1, 'hour').startOf('hour').format('HH:mm'),
      vehicle: fleet.items.find((v) => v.status === 'Available')?.name || fleet.items[0]?.name,
      driver: drivers.items.find((d) => d.status === 'Available')?.name || '—',
    });
  const book = (v) => transfers.create({ ...v, guestId: Number(v.guestId), status: v.driver && v.driver !== '—' ? 'Assigned' : 'Scheduled' }, `Transfer booked – ${byId[v.guestId]?.name}, ${v.from} → ${v.to} at ${v.time}`);
  const pickupFromFlight = (f) => {
    const g = byId[f.guestId];
    const t = f.direction === 'Arrival' ? moment(f.time).add(30, 'minutes') : moment(f.time).subtract(3, 'hours');
    openForm({ guestId: f.guestId, kind: f.direction === 'Arrival' ? 'Airport arrival' : 'Airport departure', from: f.direction === 'Arrival' ? 'Airport' : g?.residence, to: f.direction === 'Arrival' ? g?.residence : 'Airport', date: t.format('YYYY-MM-DD'), time: t.format('HH:mm') });
  };
  const advance = (t) => {
    const next = t.status === 'Delayed' ? 'En Route' : FLOW[FLOW.indexOf(t.status) + 1];
    if (!next || t.status === 'Cancelled') return;
    transfers.update(t.id, { status: next }, `${t.guestName} · ${t.from} → ${t.to}: ${next}`);
  };

  const transferRow = (t) => (
    <div
      key={t.id}
      className="row-line hov-row"
      onClick={() => setOpen(t)}
      style={{ display: 'grid', gridTemplateColumns: '56px 26px 1fr 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', cursor: 'pointer', opacity: t.status === 'Cancelled' ? 0.5 : 1 }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.3 }}>
        {t.time}
        {t.date !== today && (
          <>
            <br />
            {moment(t.date).format('MMM D')}
          </>
        )}
      </span>
      <Icon name={KIND_ICON[t.kind] || 'directions_car'} size={22} color="var(--gold)" />
      <div className="col">
        <span style={{ fontSize: 14 }}>{t.guestName}</span>
        <span className="sub">
          {t.from} → {t.to}
        </span>
      </div>
      <div className="col" style={{ fontSize: 12, color: 'var(--text-3)' }}>
        <span>{t.vehicle}</span>
        <span style={{ color: 'var(--muted)' }}>{t.driver}</span>
      </div>
      <button
        type="button"
        title="Click to advance status"
        onClick={(e) => {
          e.stopPropagation();
          advance(t);
        }}
        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[t.status], border: 0, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {t.status}
      </button>
    </div>
  );
  const fleetRow = (v) => (
    <div key={v.id} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '7px 0' }}>
      <Icon name={v.icon} size={24} color="var(--gold)" />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>{v.name}</span>
        <span className="sub">{v.detail}</span>
      </div>
      <button
        type="button"
        title="Click to change"
        onClick={() => fleet.update(v.id, { status: cycleOf(['Available', 'On Trip', 'Assigned', 'Booked', 'Maintenance'], v.status) })}
        style={{ fontSize: 12, color: FLEET_STATUS[v.status], background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {v.status}
      </button>
    </div>
  );
  const driverRow = (d) => (
    <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto auto', gap: 10, alignItems: 'center', padding: '2px 0' }}>
      <Avatar size={36} />
      <div className="col">
        <span style={{ fontSize: 14 }}>{d.name}</span>
        <span className="sub">
          {d.area} · {transfers.items.filter((t) => t.driver === d.name && t.date === today && t.status !== 'Completed').length} trips left today
        </span>
      </div>
      <button type="button" className="mini-btn" title={`Call ${d.phone}`} aria-label={`Call ${d.phone}`} onClick={() => toast(`Calling ${d.name} (${d.phone})…`, 'info')}>
        <Icon name="call" size={16} />
      </button>
      <button
        type="button"
        onClick={() => drivers.update(d.id, { status: cycleOf(Object.keys(DRIVER_STATUS), d.status) })}
        style={{ fontSize: 12, color: DRIVER_STATUS[d.status], background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--sans)', minWidth: 60, textAlign: 'right' }}
      >
        {d.status}
      </button>
    </div>
  );
  const flightRow = (f) => (
    <div key={f.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
      <span style={{ fontSize: 13 }}>{f.flight}</span>
      <div className="col">
        <span style={{ fontSize: 14 }}>{f.guestName}</span>
        <span className="sub">
          {f.direction === 'Arrival' ? `${f.airport} · ETA ${moment(f.time).format('HH:mm')}` : `Departs ${moment(f.time).format(moment(f.time).isSame(moment(), 'day') ? 'HH:mm' : 'MMM D, HH:mm')}`}
        </span>
      </div>
      <button
        type="button"
        title="Click to update"
        onClick={() => flights.update(f.id, { status: cycleOf(FLIGHT_STATUS, f.status) })}
        style={{ fontSize: 12, color: flightColor(f.status), background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {f.status}
      </button>
      <button type="button" className="mini-btn" title="Book pickup / drop-off" aria-label="Book pickup / drop-off" onClick={() => pickupFromFlight(f)}>
        <Icon name="local_taxi" size={16} />
      </button>
    </div>
  );

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="fay-btn-outline" onClick={() => setForm({ kind: 'flight' })}>
          <Icon name="flight" size={18} />
          Track Flight
        </button>
        <button type="button" className="btn-gold" onClick={() => openForm()}>
          <Icon name="add" size={18} />
          Book Transfer
        </button>
      </div>

      <KpiGrid items={kpis} />

      <div className="grid-cols">
        <Card title={`Transfers (${shown.length})`} link="View All ›" onLink={() => setViewAll('transfers')} gap={4} headGap={6}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Today', 'Upcoming', 'All'].map((x) => (
              <Chip key={x} on={x === filter} onClick={() => setFilter(x)} style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12 }}>
                {x}
              </Chip>
            ))}
          </div>
          {shown.length ? shown.slice(0, 8).map(transferRow) : <span className="sub">No transfers.</span>}
        </Card>

        <Card title="Live Fleet Map" aside={<span style={{ fontSize: 12, color: 'var(--green-bright)' }}>● Live · {enRoute.length} on the road</span>}>
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 320,
              borderRadius: 8,
              background: 'radial-gradient(circle at 30% 70%, rgba(79,195,247,.10), transparent 40%), repeating-linear-gradient(135deg,#14171d 0 12px,#121519 12px 24px)',
              border: '1px solid rgba(255,255,255,.06)',
              overflow: 'hidden',
            }}
          >
            {Object.entries(POS).map(([name, [x, y]]) => (
              <span key={name} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', fontSize: 10, color: 'var(--faint)', fontFamily: 'monospace' }}>
                ◦ {name}
              </span>
            ))}
            {enRoute.map((t) => {
              const [x1, y1] = posOf(t.from);
              const [x2, y2] = posOf(t.to);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpen(t)}
                  title={`${t.vehicle} · ${t.guestName}`}
                  style={{
                    position: 'absolute',
                    left: `${(x1 + x2) / 2}%`,
                    top: `${(y1 + y2) / 2}%`,
                    transform: 'translate(-50%,-50%)',
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    background: SC[t.status],
                    color: 'var(--text)',
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  <Icon name={KIND_ICON[t.kind] || 'directions_car'} size={14} />
                  {t.vehicle}
                </button>
              );
            })}
            {!enRoute.length && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--faint)' }}>No vehicles on the road</span>}
          </div>
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Fleet" link="View All ›" onLink={() => setViewAll('fleet')} gap={6}>
          {fleet.items.slice(0, 6).map(fleetRow)}
        </Card>
        <Card title="Chauffeurs" link="View All ›" onLink={() => setViewAll('drivers')} gap={8}>
          {drivers.items.map(driverRow)}
        </Card>
        <Card title="Flight Watch" link="View All ›" onLink={() => setViewAll('flights')} gap={6}>
          {flights.items.slice(0, 4).map(flightRow)}
        </Card>
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} fullWidth maxWidth="xs">
        {open && (
          <>
            <DialogTitle sx={{ fontFamily: 'var(--serif)', fontSize: 24 }}>
              {open.guestName}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)' }}>
                {open.kind} · {open.from} → {open.to} · {moment(open.date).format('MMM D')} {open.time}
              </div>
            </DialogTitle>
            <DialogContent>
              <div className="col" style={{ gap: 16, paddingTop: 8 }}>
                {[
                  ['status', 'Status', [...FLOW, 'Delayed', 'Cancelled']],
                  ['vehicle', 'Vehicle', fleet.items.map((v) => v.name)],
                  ['driver', 'Chauffeur', ['—', ...drivers.items.map((d) => d.name)]],
                ].map(([key, label, options]) => (
                  <TextField
                    key={key}
                    select
                    label={label}
                    value={open[key]}
                    onChange={(e) => {
                      transfers.update(open.id, { [key]: e.target.value }, `${label} → ${e.target.value}`);
                      setOpen({ ...open, [key]: e.target.value });
                    }}
                  >
                    {options.map((o) => (
                      <MenuItem key={o} value={o}>
                        {o}
                      </MenuItem>
                    ))}
                  </TextField>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setOpen(null)}>
                Done
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ViewAllDialog
        open={viewAll === 'transfers'}
        onClose={() => setViewAll(null)}
        title="All Transfers"
        items={sorted}
        searchText={(t) => `${t.guestName} ${t.from} ${t.to} ${t.vehicle} ${t.driver}`}
        filters={{ options: ['All', ...FLOW, 'Delayed', 'Cancelled'], get: (t) => t.status }}
        renderItem={transferRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => openForm()}>
            <Icon name="add" size={18} />
            Book Transfer
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll === 'fleet'}
        onClose={() => setViewAll(null)}
        title="Fleet"
        items={fleet.items}
        searchText={(v) => `${v.name} ${v.detail}`}
        filters={{ options: ['All', 'Available', 'On Trip', 'Assigned', 'Booked', 'Maintenance'], get: (v) => v.status }}
        renderItem={fleetRow}
      />
      <ViewAllDialog open={viewAll === 'drivers'} onClose={() => setViewAll(null)} title="Chauffeurs" items={drivers.items} searchText={(d) => `${d.name} ${d.area}`} renderItem={driverRow} />
      <ViewAllDialog
        open={viewAll === 'flights'}
        onClose={() => setViewAll(null)}
        title="Flight Watch"
        items={flights.items}
        searchText={(f) => `${f.flight} ${f.guestName}`}
        filters={{ options: ['All', 'Arrival', 'Departure'], get: (f) => f.direction }}
        renderItem={flightRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setForm({ kind: 'flight' })}>
            <Icon name="add" size={18} />
            Track Flight
          </button>
        }
      />

      <FormDialog
        open={!!form && form.kind !== 'flight'}
        title="Book Transfer"
        submitLabel="Book"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'kind', label: 'Type', type: 'select', options: Object.keys(KIND_ICON) },
          { name: 'from', label: 'From', type: 'select', options: Array.from(new Set([form?.from, ...PLACES].filter(Boolean))) },
          { name: 'to', label: 'To', type: 'select', options: Array.from(new Set([form?.to, ...PLACES].filter(Boolean))) },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'time', label: 'Pickup time', type: 'time', required: true },
          { name: 'vehicle', label: 'Vehicle', type: 'select', options: fleet.items.map((v) => v.name) },
          { name: 'driver', label: 'Chauffeur', type: 'select', options: ['—', ...drivers.items.map((d) => d.name)] },
        ]}
        initial={form || {}}
        onSubmit={(v) => (v.from === v.to ? Promise.reject(new Error('Pick a different destination')) : book(v))}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'flight'}
        title="Track Flight"
        submitLabel="Track"
        fields={[
          { name: 'flight', label: 'Flight number', required: true, helperText: 'e.g. EK 203' },
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'direction', label: 'Direction', type: 'select', options: ['Arrival', 'Departure'] },
          { name: 'airport', label: 'Airport', type: 'select', options: ['DXB', 'AUH', 'DWC', 'SHJ'] },
          { name: 'time', label: 'Scheduled time', type: 'datetime', required: true },
        ]}
        initial={{ guestId: guestOptions[0]?.[0] || '', direction: 'Arrival', airport: 'DXB', time: moment().add(1, 'day').format('YYYY-MM-DDT14:00') }}
        onSubmit={(v) => flights.create({ ...v, flight: v.flight.toUpperCase(), guestId: Number(v.guestId), time: new Date(v.time).toISOString(), status: 'Scheduled' }, `Tracking ${v.flight.toUpperCase()}`)}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
