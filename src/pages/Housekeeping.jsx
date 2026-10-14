import { housekeepingApi } from '../api';
import { Avatar, Bar, Card, Icon, KpiGrid } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';

// The status board comes from the API (see docs/API.md); the other panels are still sample data.
const FLOW = ['Dirty', 'Cleaning', 'Inspect', 'Ready'];
const C = { Dirty: '#e05858', Cleaning: '#e8b84a', Inspect: '#9b7bf0', Ready: '#3fd283', Occupied: '#2f6fe8' };
const KPIS = [
  { icon: 'cleaning_services', c: '#e8b84a', n: '14', l: 'Tasks Today' },
  { icon: 'check_circle', c: '#3fd283', n: '8', l: 'Completed' },
  { icon: 'pending', c: '#5b8ff0', n: '4', l: 'In Progress' },
  { icon: 'event_available', c: '#3fd283', n: '3', l: 'Ready for Arrival' },
  { icon: 'groups', c: '#9b7bf0', n: '18 / 20', l: 'Staff on Shift' },
  { icon: 'timer', c: '#e8b84a', n: '42 min', l: 'Avg Turnaround' },
];
const TASKS = [
  ['08:30', 'Departure clean', 'Villa Spectra 2', 'Lucien P.', 'In Progress'],
  ['09:00', 'Extra towels', 'Serenity 1', 'Team A', 'In Progress'],
  ['10:00', 'Arrival prep', 'Serenity 2', 'Maya R.', 'Completed'],
  ['11:00', 'Deep clean', 'Allure Penthouse 2', 'Amara K.', 'In Progress'],
  ['14:00', 'Daily service', 'Riviera 3', 'Team B', 'Scheduled'],
  ['16:00', 'Laundry return', 'Smart Locker 03', 'Team A', 'Scheduled'],
  ['20:00', 'Turndown service', 'Riviera 1', 'Team C', 'Scheduled'],
];
const taskColor = (s) => (s === 'Completed' ? '#1f9d55' : s === 'In Progress' ? '#2f6fe8' : '#3a3f48');
const STAFF = [
  ['Maya R.', 'Serenity Collection', '85%', '5'],
  ['Lucien P.', 'Villa Spectra', '70%', '4'],
  ['Amara K.', 'Allure Penthouse', '60%', '3'],
  ['Team B', 'Riviera Collection', '50%', '4'],
  ['Team C', 'Evening turndown', '20%', '6'],
];
const STOCK = [
  ['Bath towels', '82%'],
  ['Bed linen sets', '64%'],
  ['Bathrobes', '48%'],
  ['Toiletry kits', '28%'],
  ['Slippers', '71%'],
];
const stockColor = (w) => (parseInt(w) < 35 ? '#e05858' : parseInt(w) < 55 ? '#e8b84a' : '#3fd283');
const NOTES = [
  { icon: 'bed', r: 'Serenity 1 · Abba A.', t: 'Hypoallergenic pillows, 4 extra towels, no turndown chocolates' },
  { icon: 'do_not_disturb_on', r: 'Riviera 1 · Elena P.', t: 'Service only after 11 AM' },
  { icon: 'eco', r: 'Villa Spectra 1 · James & Anna', t: 'Eco mode — linen change every 3 days' },
  { icon: 'cake', r: 'Serenity 2 · Richard T.', t: 'Anniversary — rose petal setup on arrival' },
];

export default function Housekeeping() {
  const toast = useToast();
  const { data, setData } = useApi(housekeepingApi.rooms, [], []);
  const rooms = data || [];
  const patch = ({ id, ...changes }) => setData((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  useSocketEvent('housekeeping:updated', patch);

  /** Occupied residences are locked; others advance Dirty → Cleaning → Inspect → Ready → Dirty. */
  const advance = (room) => {
    if (room.status === 'Occupied') return;
    const next = FLOW[(FLOW.indexOf(room.status) + 1) % FLOW.length];
    patch({ id: room.id, status: next });
    housekeepingApi.setStatus(room.id, next).catch((e) => {
      patch({ id: room.id, status: room.status });
      toast(e.message, 'error');
    });
  };
  return (
    <div className="stack">
      <KpiGrid items={KPIS} />

      <div className="grid-cols">
        <Card
          title="Residence Status Board"
          gap={12}
          aside={
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
              {['Occupied', 'Dirty', 'Cleaning', 'Inspect', 'Ready'].map((l) => (
                <span key={l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: C[l] }} />
                  {l}
                </span>
              ))}
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {rooms.map((room) => {
              const { id, residence: n, note: who, status: s } = room;
              return (
                <div
                  key={id}
                  onClick={() => advance(room)}
                  className="col"
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    borderTop: `3px solid ${C[s]}`,
                    background: 'var(--surface-2)',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{n}</span>
                  <span style={{ fontSize: 12, color: C[s] }}>{s}</span>
                  <span className="sub">{who}</span>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Tap a residence to advance its status.</span>
        </Card>

        <Card title="Today's Tasks" link="View All ›" gap={6} headGap={4}>
          {TASKS.map(([time, t, r, who, s]) => (
            <div
              key={time + t}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{time}</span>
              <div className="col">
                <span style={{ fontSize: 14 }}>{t}</span>
                <span className="sub">
                  {r} · {who}
                </span>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: taskColor(s) }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Team on Shift" gap={8}>
          {STAFF.map(([n, z, w, t]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <Avatar size={36} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">{z}</span>
              </div>
              <Bar value={w} />
              <span style={{ color: 'var(--text-3)' }}>{t}</span>
            </div>
          ))}
        </Card>

        <Card title="Linen & Amenities" gap={8}>
          {STOCK.map(([n, w]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 50px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{n}</span>
              <Bar value={w} color={stockColor(w)} />
              <span style={{ color: 'var(--text-3)', textAlign: 'right' }}>{w}</span>
            </div>
          ))}
        </Card>

        <Card title="Guest Preferences to Note" gap={6}>
          {NOTES.map((n) => (
            <div key={n.r} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
              <Icon name={n.icon} size={20} color="var(--gold)" />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n.r}</span>
                <span className="sub">{n.t}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
