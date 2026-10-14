import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import moment from 'moment';
import { useState } from 'react';
import FormDialog from '../components/FormDialog';
import { Avatar, Bar, Card, Chip, Icon, KpiGrid } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import useCollection from '../hooks/useCollection';

const SC = { Open: '#c43a3a', 'In Progress': '#2f6fe8', Scheduled: '#3a3f48', Completed: '#1f9d55', 'Awaiting Parts': '#6b5a3a' };
const STATUSES = Object.keys(SC);
const PC = { High: '#ff6b6b', Medium: '#e8b84a', Low: '#3fd283' };
const TECH_STATUS = { Available: '#3fd283', 'On job': '#5b8ff0', 'Off shift': '#8f897d' };
const LOCATIONS = ['Serenity 1', 'Serenity 2', 'Serenity 3', 'Riviera 1', 'Riviera 2', 'Riviera 3', 'Villa Spectra 1', 'Villa Spectra 2', 'Allure Penthouse 1', 'Allure Penthouse 2', 'Wellness Club', 'Riviera Restaurant', 'Pool Club', 'Smart Locker Hub', 'Plant Room'];
const COLS = '60px 1.4fr 1.2fr 70px 1fr 110px';
const healthColor = (h) => (h >= 95 ? '#3fd283' : h >= 85 ? '#e8b84a' : '#ff6b6b');

export default function Maintenance() {
  const orders = useCollection('workOrders');
  const systems = useCollection('systems');
  const preventive = useCollection('preventive');
  const alerts = useCollection('maintenanceAlerts');
  const techs = useCollection('technicians');
  const [filter, setFilter] = useState('Active');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const [viewAll, setViewAll] = useState(null);

  const active = orders.items.filter((o) => o.status !== 'Completed');
  const query = q.trim().toLowerCase();
  const shown = orders.items
    .filter((o) => (filter === 'All' ? true : filter === 'Active' ? o.status !== 'Completed' : o.status === filter))
    .filter((o) => !query || `${o.number} ${o.title} ${o.location} ${o.technician}`.toLowerCase().includes(query));
  const weekEnd = moment().add(7, 'days').format('YYYY-MM-DD');
  const avgHealth = systems.items.length ? (systems.items.reduce((s, x) => s + x.health, 0) / systems.items.length).toFixed(1) : '—';
  const kpis = [
    { icon: 'build', c: '#e8b84a', n: String(active.length), l: 'Open Work Orders' },
    { icon: 'report', c: '#ff6b6b', n: String(active.filter((o) => o.priority === 'High').length), l: 'High Priority' },
    { icon: 'engineering', c: '#5b8ff0', n: String(orders.items.filter((o) => o.status === 'In Progress').length), l: 'In Progress' },
    { icon: 'event_repeat', c: '#9b7bf0', n: String(preventive.items.filter((p) => p.status === 'Planned' && p.date <= weekEnd).length), l: 'Preventive This Week' },
    { icon: 'notifications_active', c: '#ff6b6b', n: String(alerts.items.filter((a) => a.status === 'Open').length), l: 'Open Device Alerts' },
    { icon: 'devices', c: '#3fd283', n: `${avgHealth}%`, l: 'System Health' },
  ];
  const nextNumber = () => `WO-${Math.max(400, ...orders.items.map((o) => Number(String(o.number).replace(/\D/g, '')) || 0)) + 1}`;

  const orderRow = (o) => (
    <div
      key={o.id}
      className="row-line hov-row"
      onClick={() => setOpen(o)}
      style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', fontSize: 13, padding: '9px 6px', minWidth: 620, cursor: 'pointer' }}
    >
      <span>{o.number}</span>
      <span>{o.title}</span>
      <span style={{ color: 'var(--text-3)' }}>{o.location}</span>
      <span style={{ color: PC[o.priority] }}>{o.priority}</span>
      <span style={{ color: 'var(--text-3)' }}>{o.technician}</span>
      <span style={{ padding: '3px 6px', borderRadius: 3, fontSize: 12, textAlign: 'center', background: SC[o.status] }}>{o.status}</span>
    </div>
  );
  const header = (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, fontSize: 12, color: 'var(--dim)', padding: 6, borderBottom: '1px solid var(--border)', minWidth: 620 }}>
      <span>ID</span>
      <span>Issue</span>
      <span>Location</span>
      <span>Priority</span>
      <span>Technician</span>
      <span>Status</span>
    </div>
  );
  const preventiveRow = (p) => (
    <div key={p.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 0', opacity: p.status === 'Done' ? 0.55 : 1 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{moment(p.date).format('MMM D')}</span>
      <div className="col">
        <span style={{ fontSize: 14, textDecoration: p.status === 'Done' ? 'line-through' : 'none' }}>{p.title}</span>
        <span className="sub">{p.location}</span>
      </div>
      <span className="sub">{p.duration}</span>
      {p.status === 'Done' ? (
        <Icon name="check_circle" size={20} color="var(--green-bright)" />
      ) : (
        <button type="button" className="mini-btn" title="Mark done" aria-label="Mark done" onClick={() => preventive.update(p.id, { status: 'Done' }, `${p.title} completed`)}>
          <Icon name="check" size={16} />
        </button>
      )}
    </div>
  );
  const alertRow = (a) => (
    <div key={a.id} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0' }}>
      <Icon name={a.icon} size={22} color={a.status === 'Open' ? PC[a.severity] : 'var(--faint)'} />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>{a.title}</span>
        <span className="sub">{a.status === 'Open' ? a.detail : `Work order ${a.workOrder} created`}</span>
      </div>
      {a.status === 'Open' ? (
        <button
          type="button"
          onClick={() => setForm({ fromAlert: a, title: a.title.split(' · ')[1] ? `${a.title.split(' · ')[1]} – ${a.detail}` : a.detail, location: a.location, priority: a.severity })}
          style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, border: '1px solid rgba(232,184,74,.5)', cursor: 'pointer', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--sans)' }}
        >
          Create WO
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>{a.workOrder}</span>
      )}
    </div>
  );
  const techRow = (t) => {
    const jobs = active.filter((o) => o.technician === t.name).length;
    const states = Object.keys(TECH_STATUS);
    return (
      <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center', padding: '2px 0' }}>
        <Avatar size={36} />
        <div className="col hov-row" style={{ cursor: 'pointer' }} onClick={() => setViewAll({ kind: 'tech', name: t.name })}>
          <span style={{ fontSize: 14 }}>{t.name}</span>
          <span className="sub">
            {t.skill} · {jobs} open job{jobs === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          title="Click to change"
          onClick={() => techs.update(t.id, { status: states[(states.indexOf(t.status) + 1) % states.length] })}
          style={{ fontSize: 12, color: TECH_STATUS[t.status], background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }}
        >
          {t.status}
        </button>
      </div>
    );
  };

  const createOrder = (v) =>
    orders
      .create({ ...v, number: nextNumber(), status: 'Open' }, `${v.title} – work order created`)
      .then((o) => form?.fromAlert && alerts.update(form.fromAlert.id, { status: 'Converted', workOrder: o.number }));

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn-outline" onClick={() => setForm({ kind: 'preventive' })}>
          <Icon name="event_repeat" size={18} />
          Schedule Preventive
        </button>
        <button type="button" className="btn-gold" onClick={() => setForm({})}>
          <Icon name="add" size={18} />
          New Work Order
        </button>
      </div>

      <KpiGrid items={kpis} />

      <div className="grid-cols">
        <section className="card" style={{ overflowX: 'auto', gap: 8 }}>
          <div className="card-head">
            <span className="card-title">Work Orders ({shown.length})</span>
            <button type="button" className="card-link" onClick={() => setViewAll({ kind: 'orders' })}>
              View All ›
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {['Active', 'All', ...STATUSES].map((f) => (
              <Chip key={f} on={f === filter} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12 }}>
                {f}
              </Chip>
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search work orders…"
              aria-label="Search work orders"
              style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, outline: 0 }}
            />
          </div>
          {header}
          {shown.length ? shown.map(orderRow) : <span className="sub" style={{ padding: 12 }}>No work orders match.</span>}
        </section>

        <Card title="System Health" aside={<span className="sub">Tap a system to run diagnostics</span>}>
          {systems.items.map((x) => (
            <div
              key={x.id}
              className="hov-row"
              title={`Last check ${moment(x.checkedAt).fromNow()}`}
              onClick={() => systems.update(x.id, { checkedAt: new Date().toISOString(), health: Math.min(100, x.health + (x.health < 95 ? 2 : 0)) }, `${x.name} diagnostics complete`)}
              style={{ display: 'grid', gridTemplateColumns: '26px 1fr 100px 40px', gap: 10, alignItems: 'center', fontSize: 13, cursor: 'pointer', padding: '2px 0' }}
            >
              <Icon name={x.icon} size={22} color={healthColor(x.health)} />
              <span>{x.name}</span>
              <Bar value={`${x.health}%`} color={healthColor(x.health)} />
              <span style={{ color: 'var(--text-3)' }}>{x.health}%</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Preventive Schedule" link="View All ›" onLink={() => setViewAll({ kind: 'preventive' })} gap={6}>
          {[...preventive.items]
            .filter((p) => p.status === 'Planned')
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .slice(0, 5)
            .map(preventiveRow)}
        </Card>

        <Card title="Smart Home Device Alerts" link="View All ›" onLink={() => setViewAll({ kind: 'alerts' })} gap={6}>
          {alerts.items.filter((a) => a.status === 'Open').length ? alerts.items.filter((a) => a.status === 'Open').slice(0, 4).map(alertRow) : <span className="sub">No open alerts.</span>}
        </Card>

        <Card title="Technicians" link="View All ›" onLink={() => setViewAll({ kind: 'techs' })} gap={8}>
          {techs.items.map(techRow)}
        </Card>
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} fullWidth maxWidth="xs">
        {open && (
          <>
            <DialogTitle sx={{ fontFamily: 'var(--serif)', fontSize: 24 }}>
              {open.number} · {open.title}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)' }}>
                {open.location} · opened {moment(open.createdAt).fromNow()}
              </div>
            </DialogTitle>
            <DialogContent>
              <div className="col" style={{ gap: 16, paddingTop: 8 }}>
                {[
                  ['status', 'Status', STATUSES],
                  ['priority', 'Priority', Object.keys(PC)],
                  ['technician', 'Technician', techs.items.map((t) => t.name)],
                ].map(([key, label, options]) => (
                  <TextField
                    key={key}
                    select
                    label={label}
                    value={open[key]}
                    onChange={(e) => {
                      orders.update(open.id, { [key]: e.target.value }, `${open.number} ${label.toLowerCase()} → ${e.target.value}`);
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
              {open.status !== 'Completed' && (
                <Button
                  onClick={() => {
                    orders.update(open.id, { status: 'Completed' }, `${open.number} completed`);
                    setOpen(null);
                  }}
                >
                  Mark Completed
                </Button>
              )}
              <Button variant="contained" onClick={() => setOpen(null)}>
                Done
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ViewAllDialog
        open={viewAll?.kind === 'orders' || viewAll?.kind === 'tech'}
        onClose={() => setViewAll(null)}
        title={viewAll?.kind === 'tech' ? `Work Orders · ${viewAll.name}` : 'All Work Orders'}
        items={viewAll?.kind === 'tech' ? orders.items.filter((o) => o.technician === viewAll.name) : orders.items}
        searchText={(o) => `${o.number} ${o.title} ${o.location} ${o.technician}`}
        filters={{ options: ['All', ...STATUSES], get: (o) => o.status }}
        header={header}
        renderItem={orderRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setForm({})}>
            <Icon name="add" size={18} />
            New Work Order
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll?.kind === 'preventive'}
        onClose={() => setViewAll(null)}
        title="Preventive Schedule"
        items={[...preventive.items].sort((a, b) => (a.date < b.date ? -1 : 1))}
        searchText={(p) => `${p.title} ${p.location}`}
        filters={{ options: ['All', 'Planned', 'Done'], get: (p) => p.status }}
        renderItem={preventiveRow}
      />
      <ViewAllDialog
        open={viewAll?.kind === 'alerts'}
        onClose={() => setViewAll(null)}
        title="Smart Home Device Alerts"
        items={alerts.items}
        searchText={(a) => `${a.title} ${a.detail}`}
        filters={{ options: ['All', 'Open', 'Converted'], get: (a) => a.status }}
        renderItem={alertRow}
      />
      <ViewAllDialog open={viewAll?.kind === 'techs'} onClose={() => setViewAll(null)} title="Technicians" items={techs.items} searchText={(t) => `${t.name} ${t.skill}`} renderItem={techRow} />

      <FormDialog
        open={!!form && form.kind !== 'preventive'}
        title={form?.fromAlert ? `Work Order from Alert` : 'New Work Order'}
        subtitle={form?.fromAlert?.title}
        submitLabel="Create Work Order"
        fields={[
          { name: 'title', label: 'Issue', required: true },
          { name: 'location', label: 'Location', type: 'select', options: LOCATIONS, required: true },
          { name: 'priority', label: 'Priority', type: 'select', options: Object.keys(PC) },
          { name: 'technician', label: 'Technician', type: 'select', options: techs.items.map((t) => t.name) },
        ]}
        initial={{ priority: 'Medium', location: LOCATIONS[0], technician: techs.items.find((t) => t.status === 'Available')?.name || techs.items[0]?.name, ...(form || {}) }}
        onSubmit={({ title, location, priority, technician }) => createOrder({ title, location, priority, technician })}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'preventive'}
        title="Schedule Preventive Maintenance"
        submitLabel="Schedule"
        fields={[
          { name: 'title', label: 'Task', required: true },
          { name: 'location', label: 'Location', required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'duration', label: 'Duration', type: 'select', options: ['1 h', '2 h', '3 h', '4 h', '6 h', '8 h'] },
        ]}
        initial={{ date: moment().add(1, 'day').format('YYYY-MM-DD'), duration: '2 h' }}
        onSubmit={(v) => preventive.create({ ...v, status: 'Planned' }, `${v.title} scheduled`)}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
