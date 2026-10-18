import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { residencesApi } from '../api';
import PanoramaDialog from '../components/PanoramaDialog';
import { Card, Donut, Icon, KpiGrid, Placeholder, Toggle } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import ViewAllDialog from '../components/ViewAllDialog';
import moment from 'moment';

// Residences come from the API (see docs/API.md); room/device layout and the side panels are still sample data.
const SC = { Occupied: '#1f7a48', Arriving: '#2f6fe8', Maintenance: '#c43a3a', Cleaning: '#6b5a3a', Vacant: '#3a3f48', Ready: '#1f9d55' };
const SCENES = [
  ['Welcome', 'waving_hand'],
  ['Relax', 'spa'],
  ['Sleep', 'bedtime'],
  ['Away', 'door_open'],
  ['Wake Up', 'wb_sunny'],
];
const ROOMS = [
  [
    'Living Room',
    '23°',
    [
      ['lightbulb', 'Lights', '70%'],
      ['blinds', 'Blinds', 'Open'],
      ['tv', 'Media', 'Off'],
    ],
  ],
  [
    'Master Bedroom',
    '22°',
    [
      ['lightbulb', 'Lights', '30%'],
      ['blinds', 'Blackout', 'Closed'],
      ['air', 'Air Purifier', 'Auto'],
    ],
  ],
  [
    'Kitchen',
    '24°',
    [
      ['lightbulb', 'Lights', '100%'],
      ['kitchen', 'Fridge', '4°'],
      ['coffee_maker', 'Coffee', 'Ready'],
    ],
  ],
  [
    'Terrace & Pool',
    '27°',
    [
      ['pool', 'Pool Heater', '29°'],
      ['light', 'Garden Lights', 'On'],
      ['umbrella', 'Shade', 'Open'],
    ],
  ],
];
const KPIS = [
  { icon: 'villa', c: '#e8b84a', n: '12', l: 'Residences' },
  { icon: 'person', c: '#3fd283', n: '7', l: 'Occupied' },
  { icon: 'devices', c: '#5b8ff0', n: '486', l: 'Devices Online' },
  { icon: 'wifi_off', c: '#ff6b6b', n: '3', l: 'Devices Offline' },
  { icon: 'bolt', c: '#e8b84a', n: '412 kWh', l: 'Energy Today' },
  { icon: 'lock', c: '#9b7bf0', n: '100%', l: 'Doors Secured' },
];
const ENVI = [
  { icon: 'thermostat', c: '#4fc3f7', v: '23.4°', l: 'Indoor temp' },
  { icon: 'humidity_percentage', c: '#5b8ff0', v: '48%', l: 'Humidity' },
  { icon: 'air', c: '#3fd283', v: 'Excellent', l: 'Air quality' },
  { icon: 'water_drop', c: '#4fc3f7', v: '142 L', l: 'Water today' },
];
/** Security rows; `key` is the residence.security field, `states` cycles on click. */
const SECURITY = [
  { key: 'front', icon: 'door_front', c: '#3fd283', t: 'Front Door', on: 'Locked · Digital key active', offText: 'Unlocked', states: ['Secured', 'Unlocked'] },
  { key: 'garage', icon: 'garage', c: '#cfc8ba', t: 'Garage', on: 'Closed · 1 vehicle', offText: 'Open', states: ['Secured', 'Open'] },
  { key: 'privacy', icon: 'do_not_disturb_on', c: '#e8b84a', t: 'Privacy Mode', on: 'Do not disturb until 9 AM', offText: 'Housekeeping welcome', states: ['On', 'Off'] },
];
const SEC_COLOR = { Secured: '#1f7a48', On: '#6b5a3a', Unlocked: '#c43a3a', Open: '#c43a3a', Off: '#3a3f48' };
const SEVERITY = { High: '#ff6b6b', Medium: '#e8b84a', Low: '#5b8ff0' };
const ENERGY = ['30%', '22%', '18%', '16%', '20%', '38%', '55%', '62%', '48%', '70%', '82%', '64%'];
const T_MIN = 16;
const T_MAX = 30;
const roundBtn = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export default function Residences() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, setData } = useApi(residencesApi.list, [], []);
  const alerts = useCollection('deviceAlerts');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const list = data || [];
  const [sel, setSel] = useState(0);
  const [scene, setScene] = useState(1);
  const [temp, setTemp] = useState(22);
  const [off, setOff] = useState({ '0-2': true, '1-2': true });
  const [tour, setTour] = useState(null);
  const current = list[sel] || {};
  const { id, name, collection: col, guestName, status } = current;
  const guest = guestName || '—';

  useEffect(() => {
    setOff(current.devicesOff || {});
    // Only when switching residence; later toggles are local + persisted through the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  useEffect(() => {
    if (current.targetTemp) setTemp(current.targetTemp);
    const si = SCENES.findIndex(([l]) => l.toLowerCase() === current.scene);
    if (si >= 0) setScene(si);
  }, [current.id, current.targetTemp, current.scene]);

  const fail = (e) => toast(e.message || t('common.updateFailed'), 'error');
  const changeTemp = (delta) => {
    const next = Math.min(T_MAX, Math.max(T_MIN, temp + delta));
    if (next === temp) return;
    setTemp(next);
    residencesApi.setClimate(id, next).catch(fail);
  };
  const changeScene = (i) => {
    setScene(i);
    residencesApi.setScene(id, SCENES[i][0].toLowerCase()).catch(fail);
  };
  const toggleDevice = (k, room, device) => {
    const turnOn = !!off[k];
    setOff((o) => ({ ...o, [k]: !o[k] }));
    setData((l) => l.map((r) => (r.id === id ? { ...r, devicesOff: { ...(r.devicesOff || {}), [k]: !turnOn } } : r)));
    residencesApi.setDevice(id, k, turnOn).catch((e) => {
      setOff((o) => ({ ...o, [k]: !o[k] }));
      fail(e);
    });
  };
  const security = current.security || {};
  const toggleSecurity = (row) => {
    const now = security[row.key] || row.states[0];
    const next = row.states[(row.states.indexOf(now) + 1) % row.states.length];
    setData((l) => l.map((r) => (r.id === id ? { ...r, security: { ...security, [row.key]: next } } : r)));
    residencesApi
      .setSecurity(id, { [row.key]: next })
      .then(() => toast(`${name} · ${row.t}: ${next}`))
      .catch(fail);
  };
  const openAlerts = alerts.items.filter((a) => a.status === 'Open');
  const alertRow = (a) => (
    <div key={a.id} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '6px 0' }}>
      <Icon name={a.icon} size={20} color={a.status === 'Open' ? SEVERITY[a.severity] : 'var(--faint)'} />
      <span style={{ flex: 1, color: a.status === 'Open' ? undefined : 'var(--dim)' }}>
        {a.residence} – {a.title}
      </span>
      <span style={{ color: 'var(--dim)', fontSize: 12 }}>{moment(a.raisedAt).fromNow(true)}</span>
      {a.status === 'Open' ? (
        <button type="button" className="mini-btn" title="Mark resolved" aria-label="Mark resolved" onClick={() => alerts.update(a.id, { status: 'Resolved' }, `${a.residence} alert resolved`)}>
          <Icon name="check" size={16} />
        </button>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--green-bright)' }}>Resolved</span>
      )}
    </div>
  );
  const pct = `${((temp - T_MIN) / (T_MAX - T_MIN)) * 100}%`;
  return (
    <div className="stack">
      <KpiGrid
        items={KPIS.map((k) =>
          k.l === 'Occupied'
            ? { ...k, n: String(list.filter((r) => r.status === 'Occupied').length) }
            : k.l === 'Residences'
              ? { ...k, n: String(list.length) }
              : k.l === 'Devices Offline'
                ? { ...k, n: String(openAlerts.length) }
                : k.l === 'Doors Secured'
                  ? { ...k, n: `${Math.round((list.filter((r) => (r.security?.front || 'Secured') === 'Secured').length / Math.max(1, list.length)) * 100)}%` }
                  : k,
        )}
      />

      <div className="grid-cols">
        <section className="card" style={{ padding: 12, gap: 6 }}>
          <span className="card-title" style={{ padding: '4px 4px 6px' }}>
            Residences ({list.length})
          </span>
          {list.map(({ id: rid, name: n, guestName: g, status: s }, i) => (
            <div
              key={rid}
              className="hov-row"
              onClick={() => setSel(i)}
              style={{
                display: 'grid',
                gridTemplateColumns: '54px 1fr auto',
                gap: 10,
                alignItems: 'center',
                padding: 8,
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${i === sel ? 'var(--gold)' : 'transparent'}`,
                background: i === sel ? 'rgba(232,184,74,.1)' : 'transparent',
              }}
            >
              <Placeholder stripe={6} style={{ height: 40, borderRadius: 5 }} />
              <div className="col">
                <span style={{ fontSize: 14 }}>{n}</span>
                <span className="sub">{g || '—'}</span>
              </div>
              <span style={{ padding: '3px 8px', borderRadius: 3, fontSize: 11, background: SC[s] }}>{s}</span>
            </div>
          ))}
        </section>

        <div className="stack-min">
          <section className="card" style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
            <Placeholder
              stripe={10}
              style={{ minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, position: 'relative' }}
            >
              <span className="mono-label" style={{ position: 'absolute', top: 10, left: 12 }}>
                residence exterior / floor plan
              </span>
              <span className="serif" style={{ fontSize: 30, fontWeight: 600 }}>
                {name}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{col} · 3 Bedrooms · Ocean View</span>
              <span className="fay-btn-outline" style={{ position: 'absolute', top: 10, right: 12, padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: 'rgba(10,12,15,.6)' }}
                onClick={() => setTour(current)}>
                <Icon name="360" size={18} />
                {t('residences.view360')}
              </span>
            </Placeholder>
            <div className="col" style={{ padding: 16, gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Current guest</span>
                <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: SC[status] }}>{status}</span>
              </div>
              <span className="serif" style={{ fontSize: 22 }}>
                {guest}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                {ENVI.map((e) => (
                  <div key={e.l} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                    <Icon name={e.icon} size={22} color={e.c} />
                    <div className="col">
                      <span style={{ fontSize: 16 }}>{e.v}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{e.l}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Card title="Scenes" aside={<span style={{ fontSize: 13, color: 'var(--muted)' }}>Applies to whole residence</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              {SCENES.map(([l, icon], i) => {
                const on = i === scene;
                return (
                  <div
                    key={l}
                    onClick={() => changeScene(i)}
                    className="col"
                    style={{
                      alignItems: 'center',
                      gap: 6,
                      padding: '14px 8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      border: `1px solid ${on ? 'var(--gold)' : 'rgba(255,255,255,.1)'}`,
                      background: on ? 'rgba(232,184,74,.14)' : 'transparent',
                    }}
                  >
                    <Icon name={icon} size={28} color={on ? 'var(--gold)' : 'var(--text-3)'} />
                    {l}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Room Controls">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              {ROOMS.map(([n, t, devs], ri) => (
                <div key={n} className="col" style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15 }}>{n}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t}</span>
                  </div>
                  {devs.map(([icon, l, v], di) => {
                    const k = `${ri}-${di}`;
                    const on = !off[k];
                    return (
                      <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Icon name={icon} size={20} color={on ? 'var(--gold)' : 'var(--faint)'} />
                        <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
                        <span className="sub">{on ? v : 'Off'}</span>
                        <Toggle size="sm" on={on} label={`${n} ${l}`} onClick={() => toggleDevice(k, n, l)} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Climate">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <span className="icon" style={roundBtn} onClick={() => changeTemp(-1)}>
                remove
              </span>
              <Donut size={130} inner={106} gradient={`conic-gradient(#4fc3f7 0 ${pct},#262a31 ${pct})`}>
                <span className="serif" style={{ fontSize: 36 }}>
                  {temp}°
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Target · Cooling</span>
              </Donut>
              <span className="icon" style={roundBtn} onClick={() => changeTemp(1)}>
                add
              </span>
            </div>
          </Card>

          <Card title="Access & Security" aside={<span style={{ fontSize: 12, color: 'var(--muted)' }}>Tap a status to change it</span>} gap={6}>
            {SECURITY.map((r) => {
              const st = security[r.key] || r.states[0];
              const on = st === r.states[0];
              return (
                <div key={r.key} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                  <Icon name={r.icon} size={22} color={on ? r.c : '#ff6b6b'} />
                  <div className="col" style={{ flex: 1 }}>
                    <span style={{ fontSize: 14 }}>{r.t}</span>
                    <span className="sub">{on ? r.on : r.offText}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSecurity(r)}
                    style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: SEC_COLOR[st], color: 'var(--text)', border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    {st}
                  </button>
                </div>
              );
            })}
          </Card>

          <Card title="Energy Today" aside={<span style={{ fontSize: 14, color: 'var(--green-bright)' }}>↓ 12%</span>} gap={8}>
            <span className="serif" style={{ fontSize: 30 }}>
              38.4 <span style={{ fontSize: 16, color: 'var(--muted)' }}>kWh</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70 }}>
              {ENERGY.map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', background: 'var(--gold)', opacity: 0.85, height: h }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)' }}>
              <span>00:00</span>
              <span>12:00</span>
              <span>Now</span>
            </div>
          </Card>

          <Card title={`Device Alerts (${openAlerts.length})`} link="View All ›" onLink={() => setAlertsOpen(true)} gap={6}>
            {openAlerts.length ? openAlerts.slice(0, 4).map(alertRow) : <span className="sub">All clear — no open alerts.</span>}
          </Card>
        </div>
      </div>
      <ViewAllDialog
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Device Alerts"
        items={alerts.items}
        searchText={(a) => `${a.residence} ${a.title}`}
        filters={{ options: ['All', 'Open', 'Resolved', 'High', 'Medium', 'Low'], get: (a) => [a.status, a.severity] }}
        renderItem={alertRow}
      />
      <PanoramaDialog residence={tour} onClose={() => setTour(null)} />
    </div>
  );
}
