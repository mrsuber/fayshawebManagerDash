import moment from 'moment';
import { useState } from 'react';
import { opsApi } from '../api';
import { Empty, Facts, Pill, TextInput, Toolbar } from '../components/kit';
import { Icon, KpiGrid, Toggle } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';

const STATUS = { pending: ['To approve', '#e8b84a'], approved: ['Expected', '#5b8ff0'], arrived: ['On site', '#3fd283'], left: ['Left', '#8f897d'], declined: ['Declined', '#d94040'], cancelled: ['Cancelled', '#8f897d'], expired: ['Expired', '#8f897d'] };

/** Residents' visitors: approve passes, check them in at the gate (QR or 6-digit code), open the gate. */
export default function Visitors() {
  const toast = useToast();
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const q = useApi(() => opsApi.visitors(date), [date], { items: [] });
  const events = useApi(opsApi.gateEvents, [], []);
  const settingsQ = useApi(opsApi.visitorSettings, [], null);
  const guestsQ = useApi(opsApi.stayGuests, [], []);
  const [code, setCode] = useState('');
  const [checked, setChecked] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const reload = () => {
    q.reload();
    events.reload();
    guestsQ.reload();
  };
  useSocketEvent('visitor:updated', reload);

  const act = (p, message) =>
    p
      .then((r) => {
        reload();
        toast(r?.message || message);
        return r;
      })
      .catch((e) => toast(e.message, 'error'));

  const verify = (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    opsApi.verifyPass(code.trim()).then(setChecked).catch((err) => {
      setChecked({ valid: false, reason: err.message });
    });
  };

  const items = q.data?.items || [];
  const kpis = [
    { icon: 'how_to_reg', c: '#e8b84a', n: items.filter((p) => p.status === 'pending').length, l: 'To approve' },
    { icon: 'schedule', c: '#5b8ff0', n: items.filter((p) => p.status === 'approved').length, l: 'Expected' },
    { icon: 'location_on', c: '#3fd283', n: items.filter((p) => p.status === 'arrived').length, l: 'On site now' },
    { icon: 'group_add', c: '#9b7bf0', n: (guestsQ.data || []).filter((g) => g.status === 'pending').length, l: 'Guests to add' },
  ];
  const stayGuests = guestsQ.data || [];

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={170} />
      <Toolbar
        right={
          <>
            <input className="kit-select" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day" />
            <button type="button" className="fay-btn-outline" onClick={() => setShowSettings((s) => !s)}><Icon name="policy" size={18} /> Policy</button>
          </>
        }
      >
        <form onSubmit={verify} className="kit-actions" style={{ flex: 1 }}>
          <input className="kit-select" style={{ minWidth: 220, flex: 1, maxWidth: 360 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pass code or scanned link" aria-label="Pass code" />
          <button type="submit" className="btn-gold"><Icon name="qr_code_scanner" size={18} /> Check pass</button>
          <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Open the main gate?') && act(opsApi.openGate({ note: 'Opened from FAY OS' }), 'Gate')}><Icon name="door_open" size={18} /> Open gate</button>
        </form>
      </Toolbar>

      {checked ? (
        <section className="card" style={{ gap: 12, borderColor: checked.valid ? 'rgba(63,210,131,.5)' : 'rgba(255,107,107,.5)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Icon name={checked.valid ? 'verified' : 'block'} size={30} color={checked.valid ? 'var(--green-bright)' : 'var(--red-soft)'} />
            <span className="serif" style={{ fontSize: 24, flex: 1 }}>{checked.valid ? `Valid · ${checked.visitorName}` : checked.reason || 'Not valid'}</span>
            <button type="button" className="fay-btn-outline" onClick={() => { setChecked(null); setCode(''); }}>Clear</button>
          </div>
          {checked.id ? (
            <Facts items={[['Visitor', checked.visitorName], ['People', checked.people], ['Vehicle', checked.vehicle], ['Host', `${checked.host} · Residence ${checked.residence}`], ['Host phone', checked.hostPhone], ['Window', [checked.from, checked.until].filter(Boolean).join('–') || 'Any time'], ['Status', STATUS[checked.status]?.[0]]]} />
          ) : null}
          {checked.valid ? (
            <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn-gold" onClick={() => act(opsApi.openGate({ passId: checked.id }), 'Gate').then(() => setChecked(null))}><Icon name="door_open" size={18} /> Open the gate · check in</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {showSettings && settingsQ.data ? <VisitorSettings value={settingsQ.data} onSaved={(v) => { settingsQ.setData(v); toast('Saved'); setShowSettings(false); }} /> : null}

      <section className="card kit-scroll" style={{ padding: 6 }}>
        {items.length === 0 && !q.loading ? <Empty icon="badge" title="No visitors for this day">Residents invite visitors from the app; each visitor receives a pass with a QR code and directions.</Empty> : null}
        {items.length ? (
          <table className="kit-table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>Visitor</th><th>For</th><th>When</th><th>Vehicle</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.discreet ? <Icon name="visibility_off" size={15} color="var(--dim)" /> : null} {p.visitorName}
                    <div className="sub">{p.people} person{p.people > 1 ? 's' : ''}{p.visitorPhone ? ` · ${p.visitorPhone}` : ''}{p.discreet ? ' · discreet: the name shows when the gate checks the pass' : ''}</div>
                    {p.flag ? <div className="sub" style={{ color: 'var(--gold)' }}><Icon name="flag" size={14} /> {p.flag}</div> : null}
                  </td>
                  <td>{p.host}<div className="sub">Residence {p.residence}</div></td>
                  <td>{moment(p.date).format('ddd D MMM')}{p.from ? ` · ${p.from}${p.until ? `–${p.until}` : ''}` : ''}</td>
                  <td>{p.vehicle || '—'}</td>
                  <td><Pill tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Pill></td>
                  <td>
                    <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
                      {p.status === 'pending' ? (
                        <>
                          <button type="button" className="btn-gold" onClick={() => act(opsApi.visitorAction(p.id, 'approve'), 'Approved — the visitor’s pass is active')}>Approve</button>
                          <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.visitorAction(p.id, 'decline'), 'Declined')}>Decline</button>
                        </>
                      ) : null}
                      {p.status === 'approved' ? <button type="button" className="btn-gold" onClick={() => act(opsApi.openGate({ passId: p.id }), 'Gate')}><Icon name="door_open" size={18} /> Let in</button> : null}
                      {p.status === 'arrived' ? <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.visitorAction(p.id, 'leave'), 'Marked as left')}>Left</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="card-title">Added to a stay</span>
        <span className="sub">People who will sleep in a residence (a visitor staying over, family arriving later). They are registered guests, within the residence’s capacity; a visitor pass never covers a night.</span>
        {stayGuests.length === 0 ? <span className="sub">No requests.</span> : null}
        {stayGuests.map((g) => (
          <div key={g.id} className="row-line" style={{ display: 'flex', gap: 12, padding: '10px 0', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>{g.fullName}</strong>{g.relation ? <span className="sub"> · {g.relation}</span> : null}
              <div className="sub">
                With {g.host} · Residence {g.residence} · {moment(g.from).format('D MMM')} → {moment(g.to).format('D MMM')} ({g.nights} night{g.nights > 1 ? 's' : ''}) · booked {g.booked} of {g.capacity}
                {g.fee ? ` · ${g.fee.toLocaleString('en-US')} XAF to the bill` : ''}
              </div>
              {g.note ? <div className="sub">“{g.note}”</div> : null}
            </div>
            <Pill tone={{ pending: '#e8b84a', approved: '#3fd283', declined: '#d94040' }[g.status] || '#8f897d'}>{{ pending: 'To approve', approved: 'Registered', declined: 'Declined' }[g.status] || g.status}</Pill>
            {g.status === 'pending' ? (
              <div className="kit-actions">
                <button type="button" className="btn-gold" onClick={() => act(opsApi.stayGuestAction(g.id, 'approve'), `${g.fullName} is registered on the stay`)}>Approve</button>
                <button
                  type="button"
                  className="fay-btn-outline"
                  onClick={() => {
                    const reason = window.prompt('Reason for the guest (optional)', '');
                    if (reason !== null) act(opsApi.stayGuestAction(g.id, 'decline', { reason }), 'Declined');
                  }}
                >
                  Decline
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="card" style={{ gap: 8 }}>
        <span className="card-title">Gate log</span>
        {(events.data || []).length === 0 ? <span className="sub">No openings recorded yet.</span> : null}
        {(events.data || []).slice(0, 15).map((g) => (
          <div key={g.id} className="row-line" style={{ display: 'flex', gap: 12, padding: '8px 0', fontSize: 13.5, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--dim)', minWidth: 110 }}>{moment(g.at).format('D MMM HH:mm')}</span>
            <span style={{ flex: 1 }}>{g.visitor ? `Visitor ${g.visitor}` : g.note || 'Opened'} · by {g.by}</span>
            <span style={{ color: g.controllerOk === false ? 'var(--red-soft)' : 'var(--dim)' }}>{g.controllerOk === null ? 'manual' : g.controllerOk ? 'controller opened' : 'controller failed'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

const NUM = (v) => (v === '' ? '' : Number(v));

function LabeledToggle({ on, onClick, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Toggle on={on} onClick={onClick} label={text} />
      <span style={{ fontSize: 14 }}>{text}</span>
    </div>
  );
}

/** The visitor policy: how the team balances protecting the residences with residents' freedom to receive people. */
function VisitorSettings({ value, onSaved }) {
  const [v, setV] = useState({ autoApprove: false, directions: '', mapsUrl: '', gatePhone: '', ...value });
  const field = (key, label, hint, props = {}) => (
    <TextInput label={label} value={String(v[key] ?? '')} onChange={(x) => setV({ ...v, [key]: props.type === 'time' ? x : NUM(x) })} hint={hint} {...props} />
  );
  return (
    <section className="card" style={{ gap: 14 }}>
      <span className="card-title">Visitor policy</span>
      <span className="sub">
        Day visits only: nobody sleeps over on a visitor pass — residents add an overnight guest to their stay instead, within the residence’s capacity (set per residence in HQ → Residences). A visitor who comes most days is flagged for the team.
      </span>
      <LabeledToggle on={v.autoApprove} onClick={() => setV({ ...v, autoApprove: !v.autoApprove })} text={v.autoApprove ? 'Passes are active as soon as a resident creates them (flagged ones still wait for the team)' : 'Each pass is approved by the team first'} />
      <LabeledToggle on={v.allowDiscreet} onClick={() => setV({ ...v, allowDiscreet: !v.allowDiscreet })} text={v.allowDiscreet ? 'Residents may ask for a discreet visit (name hidden from staff lists; the gate still checks ID)' : 'No discreet visits'} />
      <div className="kit-two">
        {field('visitFrom', 'Visiting hours from', null, { type: 'time' })}
        {field('visitUntil', 'Visitors leave by', 'Passes end at this time at the latest', { type: 'time' })}
      </div>
      <div className="kit-two">
        {field('maxPeoplePerVisit', 'People per pass', 'Larger groups are planned as an event', { type: 'number' })}
        {field('maxVisitorsPerDay', 'Visitors per residence per day', 'People, across all passes', { type: 'number' })}
      </div>
      <div className="kit-two">
        {field('maxPassesPerDay', 'Passes per day', null, { type: 'number' })}
        {field('maxPassesPerWeek', 'Passes per 7 days', null, { type: 'number' })}
      </div>
      <div className="kit-two">
        {field('frequentVisitorDays', 'Flag a visitor seen on this many days in a week', 'Their pass then needs approval', { type: 'number' })}
        {field('overstayMinutes', 'Alert when a visitor stays past their pass by (minutes)', null, { type: 'number' })}
      </div>
      <div className="kit-two">
        {field('extraGuestFeePerNight', 'Fee per added guest per night (XAF)', '0 = included in the stay', { type: 'number' })}
        <span />
      </div>
      <span className="card-title" style={{ fontSize: 16 }}>What visitors receive</span>
      <TextInput label="Directions shown to visitors" multiline rows={3} value={v.directions} onChange={(directions) => setV({ ...v, directions })} placeholder="Enter by the main gate on the coast road; security will guide you to the residence." />
      <div className="kit-two">
        <TextInput label="Map link" value={v.mapsUrl} onChange={(mapsUrl) => setV({ ...v, mapsUrl })} placeholder="https://maps.google.com/…" />
        <TextInput label="Gate phone" value={v.gatePhone} onChange={(gatePhone) => setV({ ...v, gatePhone })} />
      </div>
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn-gold" onClick={() => opsApi.saveVisitorSettings(v).then(onSaved)}>Save policy</button>
      </div>
    </section>
  );
}
