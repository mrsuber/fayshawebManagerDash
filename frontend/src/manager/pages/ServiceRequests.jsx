import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material';
import moment from 'moment';
import { useState } from 'react';

import { serviceRequestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Bar, Card, Chip, Donut, Field, Icon, KpiGrid, conic } from '../components/ui';
import useGuestOptions from '../hooks/useGuestOptions';
import { DEPARTMENTS, DEPARTMENT_ICON } from './guest360/format';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';
import useNav from '../hooks/useNav';

// Presentational config; requests come from the API (see docs/API.md).
const SC = { New: '#b8862e', 'In Progress': '#2f6fe8', Completed: '#1f9d55', Scheduled: '#2f6fe8', Escalated: '#c43a3a', 'On Hold': '#7c4ddb' };
const PC = { High: '#ff6b6b', Normal: '#3fd283', Low: '#e8b84a' };
const CATS = ['All Requests', 'Housekeeping', 'Maintenance', 'Dining', 'Wellness', 'Transportation', 'Experiences', 'Concierge'];
const STATUSES = ['New', 'In Progress', 'Scheduled', 'On Hold', 'Escalated', 'Completed'];
const STATUS_COLOR = { Completed: '#1f9d55', 'In Progress': '#2f6fe8', New: '#e8b84a', Scheduled: '#5b8ff0', 'On Hold': '#d38b5d', Escalated: '#d94040' };
const RANGES = [
  ['All dates', null],
  ['Today', 0],
  ['Last 7 days', 6],
  ['Last 30 days', 29],
];
const SLA = { High: 15, Normal: 30, Low: 60 };
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/** Status history shown in Request Details, derived from the request. */
function updatesFor(r) {
  const created = moment(r.createdAt);
  const rows = [
    { t: created.format('HH:mm'), d: 'Request created', by: 'FAY', c: '#e8b84a' },
    { t: created.clone().add(2, 'minutes').format('HH:mm'), d: `Assigned to ${r.department}`, by: 'System', c: '#e8b84a' },
  ];
  if (r.status !== 'New') rows.push({ t: created.clone().add(4, 'minutes').format('HH:mm'), d: `${r.status === 'Completed' ? 'Completed' : r.status} · ${r.department}`, by: 'Team', c: STATUS_COLOR[r.status] });
  if (r.status !== 'Completed') rows.push({ t: '—', d: 'Completion & guest confirmation', by: 'Pending', c: '#3a3f48' });
  return rows;
}

const BARS = [
  [24, 30],
  [25, 52],
  [26, 40],
  [27, 22],
  [28, 48],
  [29, 26],
  [30, 44],
].map(([d, v]) => ({ d: `Nov ${d}`, h: `${(v / 60) * 100}%` }));
const COLS = '50px 46px 76px 1.2fr 1.2fr 56px 92px 1fr';

export default function ServiceRequests() {
  const toast = useToast();
  const navigate = useNav();
  const { options: guestOptions, byId } = useGuestOptions();
  const [sel, setSel] = useState(1385);
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const [range, setRange] = useState(0);
  const [creating, setCreating] = useState(false);
  const [moreMenu, setMoreMenu] = useState(null);
  const { data, setData } = useApi(serviceRequestsApi.list, [], []);
  const [, days] = RANGES[range];
  const inRange = (data || []).filter((r) => days == null || moment(r.createdAt).isSameOrAfter(moment().startOf('day').subtract(days, 'days')));
  const query = q.trim().toLowerCase();
  const all = inRange.map((r) => ({
    i: r.id,
    id: r.number || `#${r.id}`,
    time: moment(r.createdAt).format('HH:mm'),
    date: moment(r.createdAt).format('MMM D, YYYY'),
    guest: r.guestName,
    cat: r.title,
    loc: r.location,
    pri: r.priority,
    s: r.status,
    team: r.department,
  }));
  const rows = all.filter((r) => (cat === 0 || r.team === CATS[cat]) && (!query || `${r.id} ${r.guest} ${r.cat} ${r.loc} ${r.team}`.toLowerCase().includes(query)));
  const cur = rows.find((r) => r.i === sel) ?? rows[0];
  const curRaw = cur && inRange.find((r) => r.id === cur.i);

  const count = (s) => inRange.filter((r) => r.status === s).length;
  const total = inRange.length;
  const kpis = [
    { icon: 'list_alt', c: '#3fd283', n: total, l: 'Total Requests', d: RANGES[range][0], dc: '#8f897d' },
    { icon: 'fiber_new', c: '#5b8ff0', n: count('New'), l: 'New' },
    { icon: 'pending', c: '#e8b84a', n: count('In Progress') + count('Scheduled'), l: 'In Progress' },
    { icon: 'verified', c: '#3fd283', n: count('Completed'), l: 'Completed', d: `${pct(count('Completed'), total)}% done` },
    { icon: 'pause_circle', c: '#9b7bf0', n: count('On Hold'), l: 'On Hold' },
    { icon: 'report', c: '#ff6b6b', n: count('Escalated'), l: 'Escalated', dc: '#ff6b6b' },
    { icon: 'timer', c: '#5b8ff0', n: '24 min', l: 'Avg Response', d: '↓ 35%' },
  ];
  const legend = ['Completed', 'In Progress', 'New', 'Scheduled', 'On Hold', 'Escalated'].map((l) => ({ l, n: count(l), c: STATUS_COLOR[l] })).filter((x) => x.n);
  const active = inRange.filter((r) => r.status !== 'Completed');
  const teams = DEPARTMENTS.map((dept) => {
    const n = active.filter((r) => r.department === dept).length;
    const [icon, c] = DEPARTMENT_ICON[dept];
    return { icon, c, l: dept, n, w: `${Math.min(100, n * 25)}%` };
  });

  const setStatus = (id, status) => {
    const prev = data.find((r) => r.id === id);
    upsert({ id, status });
    serviceRequestsApi
      .update(id, { status })
      .then(() => toast(`${prev.number} → ${status}`))
      .catch((e) => {
        upsert(prev);
        toast(e.message, 'error');
      });
  };
  const setField = (id, changes, message) => {
    const prev = data.find((r) => r.id === id);
    upsert({ id, ...changes });
    serviceRequestsApi
      .update(id, changes)
      .then(() => toast(message))
      .catch((e) => {
        upsert(prev);
        toast(e.message, 'error');
      });
  };

  const upsert = (req) => setData((list) => (list.some((r) => r.id === req.id) ? list.map((r) => (r.id === req.id ? { ...r, ...req } : r)) : [req, ...list]));
  useSocketEvent('service-request:created', upsert);
  useSocketEvent('service-request:updated', upsert);

  const complete = (id) => setStatus(id, 'Completed');
  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="fay-btn-outline" onClick={() => setRange((r) => (r + 1) % RANGES.length)} title="Click to change range">
          <Icon name="calendar_month" size={18} />
          {RANGES[range][0]} ▾
        </button>
        <button type="button" className="btn-gold" onClick={() => setCreating(true)}>
          <Icon name="add" size={18} />
          New Request
        </button>
      </div>

      <KpiGrid items={kpis} min={150} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATS.map((c, i) => (
          <Chip key={c} on={i === cat} onClick={() => setCat(i)} style={{ padding: '9px 14px', fontSize: 14 }}>
            {c}
          </Chip>
        ))}
        <label
          style={{
            flex: 1,
            minWidth: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--dim)',
          }}
        >
          <Icon name="search" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search requests…"
            aria-label="Search requests"
            style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)' }}
          />
        </label>
      </div>

      <div className="grid-cols">
        <section className="card" style={{ padding: 14, overflowX: 'auto' }}>
          <span className="card-title" style={{ marginBottom: 10 }}>
            Requests List ({rows.length})
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
              minWidth: 680,
            }}
          >
            <span>ID</span>
            <span>Time</span>
            <span>Guest</span>
            <span>Category</span>
            <span>Location</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Assigned</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="hov-row row-line"
              onClick={() => setSel(r.i)}
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
                padding: '8px 6px',
                cursor: 'pointer',
                minWidth: 680,
                background: r.i === cur?.i ? 'rgba(47,111,232,.18)' : 'transparent',
              }}
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontSize: 14,
                padding: '10px 0',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Field label="Guest">{cur.guest}</Field>
              <Field label="Location">{cur.loc}</Field>
              <Field label="Requested">
                {cur.date} · {cur.time}
              </Field>
              <Field label="SLA">{SLA[cur.pri] || 30} minutes</Field>
              <Field label="Priority">
                <span style={{ color: PC[cur.pri] }}>{cur.pri}</span>
              </Field>
              <Field label="Assigned To">{cur.team}</Field>
            </div>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Updates</span>
            {updatesFor(curRaw).map((u, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 44px 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${u.c}` }} />
                <span style={{ color: 'var(--text-3)' }}>{u.t}</span>
                <span>{u.d}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10 }}>{u.by}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <div
                onClick={() => complete(cur.i)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: 11,
                  borderRadius: 6,
                  background: 'var(--gold)',
                  color: 'var(--on-gold)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Mark as Completed
              </div>
              <button
                type="button"
                onClick={(e) => setMoreMenu(e.currentTarget)}
                style={{ padding: '11px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--sans)' }}
              >
                More ▾
              </button>
            </div>
          </Card>
        )}

        <div className="stack">
          <Card title="Request Status" gap={8}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Donut size={120} inner={86} gradient={legend.length ? conic(legend.map((l) => [l.c, pct(l.n, total)])) : '#262a31'}>
                <span className="serif" style={{ fontSize: 28 }}>
                  {total}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Total</span>
              </Donut>
              <div className="col" style={{ gap: 5, fontSize: 12, flex: 1 }}>
                {legend.map((l) => (
                  <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: l.c }} />
                    <span style={{ flex: 1 }}>{l.l}</span>
                    <span style={{ color: 'var(--text-3)' }}>
                      {l.n} · {pct(l.n, total)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="Department Load (open requests)" gap={8}>
            {teams.map((t) => (
              <div
                key={t.l}
                onClick={() => setCat(CATS.indexOf(t.l))}
                className="hov-row"
                style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 36px', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}
              >
                <Icon name={t.icon} size={20} color={t.c} />
                <span>{t.l}</span>
                <Bar value={t.w} />
                <span style={{ color: 'var(--text-3)' }}>{t.n}</span>
              </div>
            ))}
          </Card>
          <Card title="Response Time (min)" gap={8}>
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, borderBottom: '1px solid rgba(255,255,255,.1)', position: 'relative' }}
            >
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
      <Menu anchorEl={moreMenu} open={!!moreMenu} onClose={() => setMoreMenu(null)} onClick={() => setMoreMenu(null)}>
        {cur &&
          STATUSES.filter((st) => st !== cur.s).map((st) => (
            <MenuItem key={st} onClick={() => setStatus(cur.i, st)}>
              <ListItemIcon>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR[st] }} />
              </ListItemIcon>
              Mark as {st}
            </MenuItem>
          ))}
        <Divider />
        {cur &&
          ['High', 'Normal', 'Low']
            .filter((p) => p !== cur.pri)
            .map((p) => (
              <MenuItem key={p} onClick={() => setField(cur.i, { priority: p }, `${cur.id} priority → ${p}`)}>
                <ListItemIcon>
                  <Icon name="flag" size={18} color={PC[p]} />
                </ListItemIcon>
                Set priority {p}
              </MenuItem>
            ))}
        <Divider />
        {cur &&
          DEPARTMENTS.filter((d) => d !== cur.team).map((d) => (
            <MenuItem key={d} onClick={() => setField(cur.i, { department: d }, `${cur.id} reassigned to ${d}`)}>
              <ListItemIcon>
                <Icon name={DEPARTMENT_ICON[d][0]} size={18} color={DEPARTMENT_ICON[d][1]} />
              </ListItemIcon>
              Reassign to {d}
            </MenuItem>
          ))}
        {curRaw?.guestId && <Divider />}
        {curRaw?.guestId && (
          <MenuItem onClick={() => navigate(`/guest360?guest=${curRaw.guestId}`)}>
            <ListItemIcon>
              <Icon name="person" size={18} />
            </ListItemIcon>
            Open Guest 360
          </MenuItem>
        )}
      </Menu>
      <FormDialog
        open={creating}
        title="New Service Request"
        submitLabel="Create Request"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'title', label: 'Request', required: true, helperText: 'e.g. Extra towels, AC check, Late checkout' },
          { name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
          { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Normal', 'Low'] },
          { name: 'location', label: 'Location', helperText: 'Leave empty to use the guest’s residence' },
          { name: 'notes', label: 'Notes for the team', type: 'textarea', rows: 2 },
        ]}
        initial={{ guestId: guestOptions[0]?.[0] || '', department: CATS[cat] !== 'All Requests' ? CATS[cat] : 'Housekeeping', priority: 'Normal' }}
        onSubmit={(v) =>
          serviceRequestsApi.create({ ...v, location: v.location || byId[v.guestId]?.residence || 'Front desk' }).then((r) => {
            upsert(r);
            setSel(r.id);
            setQ('');
            toast(`${r.number} created – ${r.title}`);
          })
        }
        onClose={() => setCreating(false)}
      />
    </div>
  );
}
