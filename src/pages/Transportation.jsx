import { Avatar, Card, Icon, KpiGrid } from '../components/ui';

// Mock data — replace with API calls.
const SC = { 'En Route': '#2f6fe8', Completed: '#1f9d55', Scheduled: '#3a3f48', Assigned: '#7c4ddb', Delayed: '#c43a3a' };
const KPIS = [
  { icon: 'local_taxi', c: '#e8b84a', n: '16', l: 'Transfers Today' },
  { icon: 'route', c: '#5b8ff0', n: '3', l: 'En Route' },
  { icon: 'check_circle', c: '#3fd283', n: '7', l: 'Completed' },
  { icon: 'directions_car', c: '#3fd283', n: '9 / 12', l: 'Vehicles Available' },
  { icon: 'golf_course', c: '#4fc3f7', n: '6', l: 'Golf Carts Active' },
  { icon: 'timer', c: '#e8b84a', n: '4 min', l: 'Avg Pickup Wait' },
];
const TRIPS = [
  ['09:30', 'flight_land', 'David Kim', 'Airport → Riviera 1', 'Mercedes S-Class', 'Karim A.', 'Completed'],
  ['11:00', 'flight_takeoff', 'Carlos Mendez', 'Riviera 2 → Airport', 'Range Rover', 'Yusuf B.', 'Completed'],
  ['14:00', 'golf_course', 'Marie T.', 'Serenity 2 → Pool Club', 'Golf Cart 04', '—', 'En Route'],
  ['15:30', 'flight_land', 'Richard Thompson', 'Airport → Serenity 2', 'Mercedes V-Class', 'Karim A.', 'Delayed'],
  ['16:00', 'sailing', 'James & Anna', 'Villa Spectra 1 → Marina', 'Range Rover', 'Yusuf B.', 'Assigned'],
  ['19:15', 'restaurant', 'Abba Abdouraman', 'Serenity 1 → Riviera', 'Golf Cart 02', '—', 'Scheduled'],
  ['21:00', 'location_city', 'Elena Petrova', 'Riviera 1 → Old Town', 'Mercedes S-Class', 'Leon F.', 'Scheduled'],
];
const FLEET = [
  ['directions_car', 'Mercedes S-Class ×2', '1 on trip · 1 available', 'Available', '#3fd283'],
  ['airport_shuttle', 'Mercedes V-Class', 'Airport pickup 15:30', 'On Trip', '#5b8ff0'],
  ['directions_car', 'Range Rover ×2', 'Marina transfer 16:00', 'Assigned', '#9b7bf0'],
  ['golf_course', 'Golf Carts ×8', '6 active · 2 charging', 'Active', '#3fd283'],
  ['electric_bike', 'E-Bikes ×10', '4 checked out', 'Available', '#3fd283'],
  ['directions_boat', 'Yacht “Serenity”', 'Sunset charter Nov 30', 'Booked', '#e8b84a'],
];
const DRIVERS = [
  ['Karim A.', 'Airport route', 'On Trip', '#5b8ff0'],
  ['Yusuf B.', 'Resort', 'Available', '#3fd283'],
  ['Leon F.', 'Evening shift from 18:00', 'Off Duty', '#8f897d'],
  ['Sara M.', 'Resort', 'Available', '#3fd283'],
];
const FLIGHTS = [
  ['EK 203', 'Richard Thompson', 'DXB · ETA 15:10', 'Delayed 25m', '#ff6b6b'],
  ['QR 1012', 'Grace N.', 'Departs 18:40', 'On Time', '#3fd283'],
  ['BA 107', 'Sophie Laurent', 'Departs Nov 30', 'Scheduled', '#cfc8ba'],
  ['EY 451', 'Abba Abdouraman', 'Departs Nov 30, 14:20', 'Scheduled', '#cfc8ba'],
];

export default function Transportation() {
  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="btn-gold">
          <Icon name="add" size={18} />
          Book Transfer
        </div>
      </div>

      <KpiGrid items={KPIS} />

      <div className="grid-cols">
        <Card title="Today's Transfers" link="View All ›" gap={4} headGap={6}>
          {TRIPS.map(([time, icon, g, route, v, d, s]) => (
            <div
              key={time}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '56px 26px 1fr 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{time}</span>
              <Icon name={icon} size={22} color="var(--gold)" />
              <div className="col">
                <span style={{ fontSize: 14 }}>{g}</span>
                <span className="sub">{route}</span>
              </div>
              <div className="col" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                <span>{v}</span>
                <span style={{ color: 'var(--muted)' }}>{d}</span>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, minWidth: 84, textAlign: 'center', background: SC[s] }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card title="Live Fleet Map" aside={<span style={{ fontSize: 12, color: 'var(--green-bright)' }}>● Live</span>}>
          <div
            style={{
              flex: 1,
              minHeight: 320,
              borderRadius: 8,
              background: 'repeating-linear-gradient(135deg,#14171d 0 12px,#121519 12px 24px)',
              border: '1px solid rgba(255,255,255,.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--faint)',
            }}
          >
            map embed — vehicle GPS positions
          </div>
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Fleet" gap={6}>
          {FLEET.map(([icon, n, d, s, c]) => (
            <div
              key={n}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 0' }}
            >
              <Icon name={icon} size={22} color={c} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">{d}</span>
              </div>
              <span style={{ fontSize: 12, color: c }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card title="Chauffeurs" gap={8}>
          {DRIVERS.map(([n, l, s, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center' }}>
              <Avatar size={36} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">{l}</span>
              </div>
              <span style={{ fontSize: 12, color: c }}>{s}</span>
            </div>
          ))}
        </Card>

        <Card title="Flight Watch" gap={6}>
          {FLIGHTS.map(([no, g, r, s, c]) => (
            <div
              key={no}
              className="row-line"
              style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 13 }}
            >
              <span>{no}</span>
              <div className="col">
                <span>{g}</span>
                <span className="sub">{r}</span>
              </div>
              <span style={{ color: c }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
