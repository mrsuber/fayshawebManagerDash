import { useState } from 'react';
import { Bar, Card, Chip, Donut, Field, Icon, KpiGrid, conic } from '../components/ui';

// Mock data — replace with API calls.
const SC: Record<string, string> = { 'In Progress': '#2f6fe8', Completed: '#1f9d55', Scheduled: '#2f6fe8', Escalated: '#c43a3a', 'On Hold': '#7c4ddb' };
const PC: Record<string, string> = { High: '#ff6b6b', Normal: '#3fd283', Low: '#e8b84a' };
const R: [string, string, string, string, string, string, string, string][] = [
  ['#1386', '18:20', 'Abba A.', 'Delivery', 'Smart Locker 07', 'Normal', 'In Progress', 'Concierge'],
  ['#1385', '17:10', 'Abba A.', 'Extra towels', 'Serenity 1', 'High', 'In Progress', 'Housekeeping'],
  ['#1384', '16:42', 'Sophie L.', 'Private dining setup', 'Riviera 1', 'Normal', 'Completed', 'Dining'],
  ['#1383', '15:20', 'James & Anna', 'Yacht transfer', 'Marina', 'Normal', 'Scheduled', 'Transportation'],
  ['#1382', '14:35', 'Michael C.', 'AC temperature', 'Allure Penthouse 1', 'High', 'Escalated', 'Maintenance'],
  ['#1381', '13:15', 'Elena P.', 'Massage room setup', 'Spa', 'Normal', 'Completed', 'Wellness'],
  ['#1380', '11:22', 'Linda E.', 'Laundry collection', 'Smart Locker 03', 'Normal', 'In Progress', 'Housekeeping'],
  ['#1379', '10:18', 'Grace N.', 'Grocery delivery', 'Smart Locker 05', 'Normal', 'Completed', 'Concierge'],
  ['#1378', '09:40', 'Marie T.', 'Pool cabana setup', 'Pool Club', 'Low', 'Completed', 'Experiences'],
  ['#1377', '08:15', 'David K.', 'Golf cart pickup', 'Residence Drive', 'Normal', 'On Hold', 'Transportation'],
];
const CATS = ['All Requests', 'Housekeeping', 'Maintenance', 'Dining', 'Wellness', 'Transportation', 'Experiences', 'Concierge'];
const KPIS = [
  { icon: 'list_alt', c: '#3fd283', n: 18, l: 'Total Requests', d: '↑ 12%' },
  { icon: 'fiber_new', c: '#5b8ff0', n: 3, l: 'New', d: '↑ 0%' },
  { icon: 'pending', c: '#e8b84a', n: 7, l: 'In Progress', d: '↑ 40%' },
  { icon: 'verified', c: '#3fd283', n: 6, l: 'Completed', d: '↑ 25%' },
  { icon: 'pause_circle', c: '#9b7bf0', n: 1, l: 'On Hold', d: '—', dc: '#8f897d' },
  { icon: 'report', c: '#ff6b6b', n: 1, l: 'Escalated', d: '↑ 0%', dc: '#ff6b6b' },
  { icon: 'timer', c: '#5b8ff0', n: '24 min', l: 'Avg Response', d: '↓ 35%' },
];
const UPDATES = [
  { t: '17:10', d: 'Request created', by: 'FAY', c: '#e8b84a' },
  { t: '17:12', d: 'Assigned to Housekeeping', by: 'System', c: '#e8b84a' },
  { t: '17:12', d: 'Acknowledged by Team A', by: 'Lucien', c: '#e8b84a' },
  { t: '—', d: 'Completion & guest confirmation', by: 'Pending', c: '#3a3f48' },
];
const LEGEND = [
  { l: 'Completed', v: '6 · 33%', c: '#1f9d55' },
  { l: 'In Progress', v: '7 · 39%', c: '#2f6fe8' },
  { l: 'New', v: '3 · 17%', c: '#e8b84a' },
  { l: 'On Hold', v: '1 · 6%', c: '#d38b5d' },
  { l: 'Escalated', v: '1 · 6%', c: '#d94040' },
];
const TEAMS = [
  { icon: 'cleaning_services', c: '#e8b84a', l: 'Housekeeping', w: '85%' },
  { icon: 'build', c: '#9b7bf0', l: 'Maintenance', w: '60%' },
  { icon: 'restaurant', c: '#e8b84a', l: 'Dining', w: '75%' },
  { icon: 'spa', c: '#9b7bf0', l: 'Wellness & Spa', w: '50%' },
  { icon: 'directions_car', c: '#4fc3f7', l: 'Transportation', w: '80%' },
  { icon: 'sailing', c: '#3fd283', l: 'Experiences', w: '70%' },
];
const BARS = [[24, 30], [25, 52], [26, 40], [27, 22], [28, 48], [29, 26], [30, 44]].map(([d, v]) => ({ d: `Nov ${d}`, h: `${(v / 60) * 100}%` }));

const COLS = '50px 46px 76px 1.2fr 1.2fr 56px 92px 1fr';

export default function ServiceRequests() {
  const [sel, setSel] = useState(1);
  const [cat, setCat] = useState(0);
  const [done, setDone] = useState<Record<number, boolean>>({});

  const all = R.map(([id, time, guest, c, loc, pri, s, team], i) => ({ i, id, time, guest, cat: c, loc, pri, s: done[i] ? 'Completed' : s, team }));
  const rows = all.filter((r) => cat === 0 || r.team === CATS[cat]);
  const cur = rows.find((r) => r.i === sel) ?? rows[0];

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div className="btn-outline">
          <Icon name="calendar_month" size={18} />
          Nov 28 – Nov 30, 2025 ▾
        </div>
        <div className="btn-gold">
          <Icon name="add" size={18} />
          New Request
        </div>
      </div>

      <KpiGrid items={KPIS} min={150} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATS.map((c, i) => (
          <Chip key={c} on={i === cat} onClick={() => setCat(i)} style={{ padding: '9px 14px', fontSize: 14 }}>
            {c}
          </Chip>
        ))}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13, color: 'var(--dim)' }}>
          <Icon name="search" size={18} />
          Search requests…
        </div>
      </div>

      <div className="grid-cols">
        <section className="card" style={{ padding: 14, overflowX: 'auto' }}>
          <span className="card-title" style={{ marginBottom: 10 }}>
            Requests List ({rows.length})
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, fontSize: 12, color: 'var(--dim)', padding: 6, borderBottom: '1px solid var(--border)', minWidth: 680 }}>
            <span>ID</span><span>Time</span><span>Guest</span><span>Category</span><span>Location</span><span>Priority</span><span>Status</span><span>Assigned</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="hov-row row-line"
              onClick={() => setSel(r.i)}
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', fontSize: 13, padding: '8px 6px', cursor: 'pointer', minWidth: 680, background: r.i === cur?.i ? 'rgba(47,111,232,.18)' : 'transparent' }}
            >
              <span>{r.id}</span>
              <span>{r.time}</span>
              <span>{r.guest}</span>
              <span>{r.cat}</span>
              <span style={{ color: 'var(--text-3)' }}>{r.loc}</span>
              <span style={{ color: PC[r.pri] }}>{r.pri}</span>
              <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[r.s] }}>{r.s}</span>
              <span style={{ color: 'var(--text-3)' }}>{r.team}</span>
            </div>
          ))}
        </section>

        {cur && (
          <Card title="Request Details" aside={<span style={{ fontSize: 14, color: 'var(--text-3)' }}>{cur.id}</span>} gap={12}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon name="room_service" size={38} color="var(--gold)" />
              <div className="col" style={{ flex: 1 }}>
                <span className="serif" style={{ fontSize: 24 }}>
                  {cur.cat}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{cur.team}</span>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 13, background: SC[cur.s] }}>{cur.s}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 14, padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <Field label="Guest">{cur.guest}</Field>
              <Field label="Location">{cur.loc}</Field>
              <Field label="Requested">Nov 28, 2025 · {cur.time}</Field>
              <Field label="SLA">30 minutes</Field>
              <Field label="Priority">
                <span style={{ color: PC[cur.pri] }}>{cur.pri}</span>
              </Field>
              <Field label="Assigned To">{cur.team}</Field>
            </div>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Updates</span>
            {UPDATES.map((u, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 44px 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${u.c}` }} />
                <span style={{ color: 'var(--text-3)' }}>{u.t}</span>
                <span>{u.d}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10 }}>{u.by}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <div onClick={() => setDone((d) => ({ ...d, [cur.i]: true }))} style={{ flex: 1, textAlign: 'center', padding: 11, borderRadius: 6, background: 'var(--gold)', color: 'var(--on-gold)', fontWeight: 500, cursor: 'pointer' }}>
                Mark as Completed
              </div>
              <div style={{ padding: '11px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }}>More ▾</div>
            </div>
          </Card>
        )}

        <div className="stack">
          <Card title="Request Status" gap={8}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Donut size={120} inner={86} gradient={conic([['#1f9d55', 33], ['#2f6fe8', 39], ['#e8b84a', 17], ['#d38b5d', 6], ['#d94040', 5]])}>
                <span className="serif" style={{ fontSize: 28 }}>
                  18
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Total</span>
              </Donut>
              <div className="col" style={{ gap: 5, fontSize: 12, flex: 1 }}>
                {LEGEND.map((l) => (
                  <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: l.c }} />
                    <span style={{ flex: 1 }}>{l.l}</span>
                    <span style={{ color: 'var(--text-3)' }}>{l.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="Department Load" gap={8}>
            {TEAMS.map((t) => (
              <div key={t.l} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 36px', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <Icon name={t.icon} size={20} color={t.c} />
                <span>{t.l}</span>
                <Bar value={t.w} />
                <span style={{ color: 'var(--text-3)' }}>{t.w}</span>
              </div>
            ))}
          </Card>
          <Card title="Response Time (min)" gap={8}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, borderBottom: '1px solid rgba(255,255,255,.1)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: '50%', borderTop: '1px dashed var(--gold)' }} />
              {BARS.map((b) => (
                <div key={b.d} className="col" style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: 'var(--blue)', height: b.h }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--dim)' }}>
              {BARS.map((b) => (
                <span key={b.d} style={{ flex: 1, textAlign: 'center' }}>
                  {b.d}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
