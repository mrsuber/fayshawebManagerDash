import { Avatar, Bar, Card, Icon, KpiGrid } from '../components/ui';

// Mock data — replace with API calls.
const SC = { Open: '#c43a3a', 'In Progress': '#2f6fe8', Scheduled: '#3a3f48', Completed: '#1f9d55', 'Awaiting Parts': '#6b5a3a' };
const PC = { High: '#ff6b6b', Medium: '#e8b84a', Low: '#3fd283' };
const KPIS = [
  { icon: 'build', c: '#e8b84a', n: '11', l: 'Open Work Orders' },
  { icon: 'report', c: '#ff6b6b', n: '2', l: 'High Priority' },
  { icon: 'engineering', c: '#5b8ff0', n: '5', l: 'In Progress' },
  { icon: 'event_repeat', c: '#9b7bf0', n: '6', l: 'Preventive This Week' },
  { icon: 'timer', c: '#3fd283', n: '1.8 h', l: 'Avg Resolution' },
  { icon: 'devices', c: '#3fd283', n: '99.4%', l: 'Device Uptime' },
];
const ORDERS = [
  ['WO-412', 'AC performance below optimal', 'Riviera 2', 'High', 'Omar S.', 'In Progress'],
  ['WO-411', 'Smart lock battery low', 'Villa Spectra 1', 'Medium', 'Ravi D.', 'Scheduled'],
  ['WO-410', 'Terrace sensor offline', 'Serenity 3', 'Medium', 'Ravi D.', 'Open'],
  ['WO-409', 'Pool heater pressure', 'Allure Penthouse 1', 'High', 'Omar S.', 'Awaiting Parts'],
  ['WO-408', 'Blind motor noise', 'Serenity 1', 'Low', 'Kenji T.', 'Scheduled'],
  ['WO-407', 'Spa steam room thermostat', 'Wellness Club', 'Medium', 'Kenji T.', 'In Progress'],
  ['WO-406', 'Kitchen extractor filter', 'Riviera Restaurant', 'Low', 'Team B', 'Completed'],
  ['WO-405', 'Locker 11 door alignment', 'Smart Locker Hub', 'Low', 'Ravi D.', 'Completed'],
];
const SYSTEMS = [
  ['ac_unit', 'HVAC', '92%', '#3fd283'],
  ['bolt', 'Power & Backup', '98%', '#3fd283'],
  ['water_drop', 'Water & Pools', '86%', '#e8b84a'],
  ['wifi', 'Network & IoT', '99%', '#3fd283'],
  ['lock', 'Access Control', '96%', '#3fd283'],
  ['videocam', 'Cameras', '100%', '#3fd283'],
];
const PREVENTIVE = [
  ['Nov 29', 'HVAC filter replacement', 'Serenity Collection', '3 h'],
  ['Nov 30', 'Generator test', 'Plant Room', '1 h'],
  ['Dec 1', 'Pool water treatment', 'All residences', '4 h'],
  ['Dec 2', 'Fire system inspection', 'Full property', '6 h'],
  ['Dec 3', 'Elevator service', 'Allure Penthouse', '2 h'],
];
const ALERTS = [
  { icon: 'ac_unit', c: '#ff6b6b', t: 'Riviera 2 · AC unit', d: 'Cooling 3° below setpoint for 40 min' },
  { icon: 'battery_alert', c: '#e8b84a', t: 'Villa Spectra 1 · Front lock', d: 'Battery at 15%' },
  { icon: 'sensors_off', c: '#ff6b6b', t: 'Serenity 3 · Motion sensor', d: 'Offline since 15:40' },
  { icon: 'water_damage', c: '#e8b84a', t: 'Allure Penthouse 2 · Leak sensor', d: 'Moisture detected — check required' },
];
const TECHS = [
  ['Omar S.', 'HVAC & Pools', 'On job', '#5b8ff0'],
  ['Ravi D.', 'Smart Home & IoT', 'Available', '#3fd283'],
  ['Kenji T.', 'Electrical', 'On job', '#5b8ff0'],
  ['Team B', 'General', 'Off shift', '#8f897d'],
];
const COLS = '60px 1.4fr 1.2fr 70px 1fr 100px';

export default function Maintenance() {
  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="btn-gold">
          <Icon name="add" size={18} />
          New Work Order
        </div>
      </div>

      <KpiGrid items={KPIS} />

      <div className="grid-cols">
        <section className="card" style={{ overflowX: 'auto' }}>
          <span className="card-title" style={{ marginBottom: 10 }}>
            Work Orders
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: 8,
              fontSize: 12,
              color: 'var(--dim)',
              padding: 6,
              borderBottom: '1px solid var(--border)',
              minWidth: 620,
            }}
          >
            <span>ID</span>
            <span>Issue</span>
            <span>Location</span>
            <span>Priority</span>
            <span>Technician</span>
            <span>Status</span>
          </div>
          {ORDERS.map(([id, t, l, p, who, s]) => (
            <div
              key={id}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', fontSize: 13, padding: '9px 6px', minWidth: 620 }}
            >
              <span>{id}</span>
              <span>{t}</span>
              <span style={{ color: 'var(--text-3)' }}>{l}</span>
              <span style={{ color: PC[p] }}>{p}</span>
              <span style={{ color: 'var(--text-3)' }}>{who}</span>
              <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </section>

        <Card title="System Health">
          {SYSTEMS.map(([icon, n, w, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 100px 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <Icon name={icon} size={22} color={c} />
              <span>{n}</span>
              <Bar value={w} color={c} />
              <span style={{ color: 'var(--text-3)' }}>{w}</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Preventive Schedule" gap={6}>
          {PREVENTIVE.map(([d, t, l, dur]) => (
            <div
              key={t}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{d}</span>
              <div className="col">
                <span style={{ fontSize: 14 }}>{t}</span>
                <span className="sub">{l}</span>
              </div>
              <span className="sub">{dur}</span>
            </div>
          ))}
        </Card>

        <Card title="Smart Home Device Alerts" gap={6}>
          {ALERTS.map((a) => (
            <div key={a.t} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0' }}>
              <Icon name={a.icon} size={22} color={a.c} />
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 14 }}>{a.t}</span>
                <span className="sub">{a.d}</span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, border: '1px solid rgba(232,184,74,.5)', cursor: 'pointer' }}>Create WO</span>
            </div>
          ))}
        </Card>

        <Card title="Technicians" gap={8}>
          {TECHS.map(([n, sk, s, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center' }}>
              <Avatar size={36} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">{sk}</span>
              </div>
              <span style={{ fontSize: 12, color: c }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
