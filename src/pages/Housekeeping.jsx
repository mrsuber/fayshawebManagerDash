import { useState } from 'react';
import { housekeepingApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Avatar, Bar, Card, Icon, KpiGrid } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import useCollection from '../hooks/useCollection';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';

// Everything on this page comes from the API (see docs/API.md).
const FLOW = ['Dirty', 'Cleaning', 'Inspect', 'Ready'];
const C = { Dirty: '#e05858', Cleaning: '#e8b84a', Inspect: '#9b7bf0', Ready: '#3fd283', Occupied: '#2f6fe8' };
const TASK_FLOW = ['Scheduled', 'In Progress', 'Completed'];
const taskColor = (s) => (s === 'Completed' ? '#1f9d55' : s === 'In Progress' ? '#2f6fe8' : '#3a3f48');
const stockColor = (w) => (w < 35 ? '#e05858' : w < 55 ? '#e8b84a' : '#3fd283');
const NOTE_ICONS = [
  ['bed', 'Bedding'],
  ['do_not_disturb_on', 'Do not disturb'],
  ['eco', 'Eco'],
  ['cake', 'Celebration'],
  ['pets', 'Pet'],
  ['allergy', 'Allergy'],
];

export default function Housekeeping() {
  const toast = useToast();
  const { data, setData } = useApi(housekeepingApi.rooms, [], []);
  const rooms = data || [];
  const patch = ({ id, ...changes }) => setData((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  useSocketEvent('housekeeping:updated', patch);
  const tasks = useCollection('housekeepingTasks');
  const staff = useCollection('housekeepingStaff');
  const stock = useCollection('linenStock');
  const notes = useCollection('guestNotes');
  const [viewAll, setViewAll] = useState(null);
  const [form, setForm] = useState(null);

  const sortedTasks = [...tasks.items].sort((a, b) => (a.time < b.time ? -1 : 1));
  const count = (st) => tasks.items.filter((t) => t.status === st).length;
  const kpis = [
    { icon: 'cleaning_services', c: '#e8b84a', n: String(tasks.items.length), l: 'Tasks Today' },
    { icon: 'check_circle', c: '#3fd283', n: String(count('Completed')), l: 'Completed' },
    { icon: 'pending', c: '#5b8ff0', n: String(count('In Progress')), l: 'In Progress' },
    { icon: 'event_available', c: '#3fd283', n: String(rooms.filter((r) => r.status === 'Ready').length), l: 'Ready for Arrival' },
    { icon: 'groups', c: '#9b7bf0', n: String(staff.items.length), l: 'Teams on Shift' },
    { icon: 'inventory_2', c: stock.items.some((x) => x.level < 35) ? '#ff6b6b' : '#e8b84a', n: String(stock.items.filter((x) => x.level < 35).length), l: 'Low Stock Items' },
  ];
  const openFor = (name) => tasks.items.filter((t) => t.assignee === name && t.status !== 'Completed').length;
  const advanceTask = (t) => {
    const next = TASK_FLOW[(TASK_FLOW.indexOf(t.status) + 1) % TASK_FLOW.length];
    tasks.update(t.id, { status: next }, `${t.title} · ${t.location} → ${next}`);
  };

  const taskRow = (t) => (
    <div key={t.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{t.time}</span>
      <div className="col">
        <span style={{ fontSize: 14 }}>{t.title}</span>
        <span className="sub">
          {t.location} · {t.assignee}
        </span>
      </div>
      <button
        type="button"
        title="Click to advance status"
        onClick={() => advanceTask(t)}
        style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: taskColor(t.status), border: 0, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
      >
        {t.status}
      </button>
    </div>
  );
  const staffRow = (m) => {
    const n = openFor(m.name);
    return (
      <div
        key={m.id}
        className="hov-row"
        onClick={() => setViewAll({ kind: 'staff', name: m.name })}
        style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 40px', gap: 10, alignItems: 'center', fontSize: 13, cursor: 'pointer', padding: '2px 0' }}
      >
        <Avatar size={36} />
        <div className="col">
          <span style={{ fontSize: 14 }}>{m.name}</span>
          <span className="sub">
            {m.zone} · {m.shift}
          </span>
        </div>
        <Bar value={`${Math.min(100, n * 34)}%`} />
        <span style={{ color: 'var(--text-3)' }}>{n} open</span>
      </div>
    );
  };
  const stockRow = (x) => (
    <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 44px 30px', gap: 10, alignItems: 'center', fontSize: 13 }}>
      <span>{x.item}</span>
      <Bar value={`${x.level}%`} color={stockColor(x.level)} />
      <span style={{ color: 'var(--text-3)', textAlign: 'right' }}>{x.level}%</span>
      <button type="button" className="mini-btn" title={`Restock ${x.item}`} aria-label={`Restock ${x.item}`} disabled={x.level >= 100} onClick={() => stock.update(x.id, { level: 100 }, `${x.item} restocked to par (${x.par})`)}>
        <Icon name="add_shopping_cart" size={16} />
      </button>
    </div>
  );
  const noteRow = (n) => (
    <div key={n.id} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
      <Icon name={n.icon} size={20} color="var(--gold)" />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>
          {n.residence} · {n.guest}
        </span>
        <span className="sub">{n.text}</span>
      </div>
      <button type="button" className="mini-btn" title="Remove note" aria-label="Remove note" onClick={() => notes.remove(n.id, 'Note removed')}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
  const residenceOptions = rooms.map((r) => r.residence);

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
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" onClick={() => setForm('note')}>
          <Icon name="sticky_note_2" size={18} />
          Add Guest Note
        </button>
        <button type="button" className="btn-gold" onClick={() => setForm('task')}>
          <Icon name="add" size={18} />
          New Task
        </button>
      </div>

      <KpiGrid items={kpis} />

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

        <Card title={`Today's Tasks (${tasks.items.length})`} link="View All ›" onLink={() => setViewAll({ kind: 'tasks' })} gap={6} headGap={4}>
          {sortedTasks.slice(0, 7).map(taskRow)}
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Team on Shift" link="View All ›" onLink={() => setViewAll({ kind: 'team' })} gap={8}>
          {staff.items.slice(0, 5).map(staffRow)}
        </Card>

        <Card title="Linen & Amenities" link="View All ›" onLink={() => setViewAll({ kind: 'stock' })} gap={8}>
          {stock.items.slice(0, 5).map(stockRow)}
        </Card>

        <Card
          title="Guest Preferences to Note"
          gap={6}
          aside={
            <span style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="card-link" onClick={() => setForm('note')}>
                + Add
              </button>
              <button type="button" className="card-link" onClick={() => setViewAll({ kind: 'notes' })}>
                View All ›
              </button>
            </span>
          }
        >
          {notes.items.slice(0, 4).map(noteRow)}
        </Card>
      </div>

      <ViewAllDialog
        open={viewAll?.kind === 'tasks' || viewAll?.kind === 'staff'}
        onClose={() => setViewAll(null)}
        title={viewAll?.kind === 'staff' ? `Tasks · ${viewAll.name}` : "Today's Housekeeping Tasks"}
        items={viewAll?.kind === 'staff' ? sortedTasks.filter((t) => t.assignee === viewAll.name) : sortedTasks}
        searchText={(t) => `${t.title} ${t.location} ${t.assignee}`}
        filters={{ options: ['All', ...TASK_FLOW], get: (t) => t.status }}
        renderItem={taskRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setForm('task')}>
            <Icon name="add" size={18} />
            New Task
          </button>
        }
      />
      <ViewAllDialog open={viewAll?.kind === 'team'} onClose={() => setViewAll(null)} title="Team on Shift" items={staff.items} searchText={(m) => `${m.name} ${m.zone}`} renderItem={staffRow} />
      <ViewAllDialog
        open={viewAll?.kind === 'stock'}
        onClose={() => setViewAll(null)}
        title="Linen & Amenities"
        items={stock.items}
        searchText={(x) => x.item}
        filters={{ options: ['All', 'Low', 'OK'], get: (x) => (x.level < 35 ? 'Low' : 'OK') }}
        renderItem={(x) => (
          <div key={x.id} style={{ padding: '6px 0' }}>
            {stockRow(x)}
          </div>
        )}
      />
      <ViewAllDialog
        open={viewAll?.kind === 'notes'}
        onClose={() => setViewAll(null)}
        title="Guest Preferences to Note"
        items={notes.items}
        searchText={(n) => `${n.residence} ${n.guest} ${n.text}`}
        renderItem={noteRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => setForm('note')}>
            <Icon name="add" size={18} />
            Add Note
          </button>
        }
      />
      <FormDialog
        open={form === 'task'}
        title="New Housekeeping Task"
        submitLabel="Create Task"
        fields={[
          { name: 'title', label: 'Task', required: true, helperText: 'e.g. Turndown service, Deep clean' },
          { name: 'location', label: 'Residence / area', type: 'select', options: [...residenceOptions, 'Pool Club', 'Spa', 'Lobby', 'Smart Locker Hub'], required: true },
          { name: 'assignee', label: 'Assign to', type: 'select', options: staff.items.map((m) => m.name) },
          { name: 'time', label: 'Time', type: 'time', required: true },
        ]}
        initial={{ location: residenceOptions[0], assignee: staff.items[0]?.name, time: '15:00' }}
        onSubmit={(v) => tasks.create({ ...v, status: 'Scheduled' }, `${v.title} scheduled for ${v.time}`)}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form === 'note'}
        title="Guest Preference to Note"
        submitLabel="Add Note"
        fields={[
          { name: 'residence', label: 'Residence', type: 'select', options: residenceOptions, required: true },
          { name: 'guest', label: 'Guest', required: true },
          { name: 'text', label: 'Preference / instruction', type: 'textarea', rows: 3, required: true },
          { name: 'icon', label: 'Type', type: 'select', options: NOTE_ICONS },
        ]}
        initial={{ residence: residenceOptions[0], icon: 'bed' }}
        onSubmit={(v) => notes.create(v, 'Note added for the team')}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
