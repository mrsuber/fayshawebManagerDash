import moment from 'moment';
import { useEffect, useState } from 'react';
import client from '../../api/client';
import { Card, Icon } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

/**
 * Guest 360 → Conduct (staff only, never shown to the guest): breaches of the house rules the guest accepted with the
 * terms, and what happens to their future bookings — normal, held for Faysha to accept or decline, or declined at once.
 */
const KINDS = [
  ['visitors', 'Visitors outside the rules'],
  ['overcrowding', 'More people than the residence sleeps'],
  ['noise', 'Noise / disturbance'],
  ['damage', 'Damage to the property'],
  ['children', 'Children left unsupervised'],
  ['smoking', 'Smoking indoors'],
  ['conduct', 'Behaviour towards staff or neighbours'],
  ['other', 'Other'],
];
// The axios client answers with the response; these return its body.
const api = {
  get: (u) => client.get(u).then((r) => r.data),
  post: (u, b) => client.post(u, b).then((r) => r.data),
  delete: (u) => client.delete(u).then((r) => r.data),
};
const MODES = {
  review: ['Bookings held for review', 'Each booking from the website or the app waits for Faysha to accept or decline it. No payment until accepted.'],
  decline: ['Bookings declined automatically', 'Online bookings are declined at once with a polite message. The front desk can still book them with an override.'],
};

export default function ConductCard({ guestId, guestName }) {
  const toast = useToast();
  const [rec, setRec] = useState(null);
  const [form, setForm] = useState(null);
  const [flagging, setFlagging] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setRec(null);
    api.get(`/guests/${guestId}/conduct`).then((r) => live && setRec(r)).catch(() => live && setRec({ incidents: [], restriction: null, lastYear: 0 }));
    return () => {
      live = false;
    };
  }, [guestId]);

  const run = (p, msg) => {
    setBusy(true);
    return p
      .then((r) => {
        setRec(r);
        toast(msg);
        return true;
      })
      .catch((e) => {
        toast(e.message, 'error');
        return false;
      })
      .finally(() => setBusy(false));
  };

  const r = rec || { incidents: [], restriction: null, lastYear: 0 };
  const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--input-bg)', color: 'var(--text)', font: 'inherit', fontSize: 13.5 };

  return (
    <Card
      title="Conduct"
      gap={8}
      aside={<span className="sub" title="Never shown to the guest">staff only</span>}
    >
      {r.restriction ? (
        <div style={{ border: `1px solid ${r.restriction.mode === 'decline' ? '#ff6b6b' : '#e8b84a'}`, borderRadius: 8, padding: 10, fontSize: 13 }}>
          <strong style={{ color: r.restriction.mode === 'decline' ? '#ff6b6b' : '#e8b84a' }}>⚑ {MODES[r.restriction.mode][0]}</strong>
          <div className="sub">{r.restriction.reason}</div>
          <div className="sub">{r.restriction.by ? `${r.restriction.by} · ` : ''}{moment(r.restriction.at).format('D MMM YYYY')}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="fay-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busy}
              onClick={() => run(api.post(`/guests/${guestId}/restrict`, { mode: r.restriction.mode === 'decline' ? 'review' : 'decline', reason: r.restriction.reason }), 'Updated')}>
              {r.restriction.mode === 'decline' ? 'Hold for review instead' : 'Decline automatically instead'}
            </button>
            <button type="button" className="fay-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busy}
              onClick={() => window.confirm(`Accept ${guestName}'s bookings normally again?`) && run(api.post(`/guests/${guestId}/unrestrict`), 'Bookings accepted normally again')}>
              Remove flag
            </button>
          </div>
        </div>
      ) : (
        <span className="sub">
          {r.lastYear ? `${r.lastYear} incident${r.lastYear > 1 ? 's' : ''} in 12 months.` : 'No incidents recorded.'} Bookings are accepted normally.
        </span>
      )}
      {r.advise ? <span style={{ fontSize: 13, color: '#e8b84a' }}>Repeated or serious breaches: consider flagging this guest’s future bookings.</span> : null}

      {r.incidents.slice(0, 5).map((i) => (
        <div key={i.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 8, padding: '6px 0', fontSize: 13 }}>
          <Icon name={i.severity === 'serious' ? 'report' : 'flag'} size={16} color={i.severity === 'serious' ? '#ff6b6b' : '#e8b84a'} />
          <span>
            <strong>{i.label}</strong>{i.charge ? ` · ${i.charge.toLocaleString('en-US')} XAF charged` : ''}
            <div className="sub">{i.note}</div>
            <div className="sub">{moment(i.at).format('D MMM YYYY')}{i.booking ? ` · ${i.booking.number} · ${i.booking.residence}` : ''}{i.by ? ` · ${i.by}` : ''}</div>
          </span>
          <button type="button" title="Recorded by mistake" aria-label="Delete incident" className="fay-btn-outline" style={{ padding: '0 6px', height: 24, fontSize: 12 }}
            onClick={() => window.confirm('Delete this incident (recorded by mistake)?') && run(api.delete(`/guests/${guestId}/incidents/${i.id}`), 'Incident deleted')}>×</button>
        </div>
      ))}

      {form ? (
        <div className="col" style={{ gap: 8 }}>
          <select style={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="What happened">
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <textarea style={input} rows={2} placeholder="What happened (date, who, what the team did)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={input} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} aria-label="Severity">
              <option value="minor">Minor</option>
              <option value="serious">Serious</option>
            </select>
            <input style={input} inputMode="numeric" placeholder="Charge to the bill, XAF (optional)" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="fay-btn-outline" onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className="btn-gold" disabled={busy || !form.note.trim()}
              onClick={() => run(api.post(`/guests/${guestId}/incidents`, { ...form, charge: form.charge || null }), 'Incident recorded').then((ok) => ok && setForm(null))}>Record</button>
          </div>
        </div>
      ) : flagging ? (
        <div className="col" style={{ gap: 8 }}>
          {Object.entries(MODES).map(([k, [l, d]]) => (
            <label key={k} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
              <input type="radio" name="mode" checked={flagging.mode === k} onChange={() => setFlagging({ ...flagging, mode: k })} />
              <span><strong>{l}</strong><div className="sub">{d}</div></span>
            </label>
          ))}
          <textarea style={input} rows={2} placeholder="Reason (kept on the record, never shown to the guest)" value={flagging.reason} onChange={(e) => setFlagging({ ...flagging, reason: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="fay-btn-outline" onClick={() => setFlagging(null)}>Cancel</button>
            <button type="button" className="btn-gold" disabled={busy || !flagging.reason.trim()}
              onClick={() => run(api.post(`/guests/${guestId}/restrict`, flagging), 'Guest flagged').then((ok) => ok && setFlagging(null))}>Flag</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="fay-btn-outline" onClick={() => setForm({ kind: 'visitors', severity: 'minor', note: '', charge: '' })}>
            <Icon name="flag" size={16} /> Record an incident
          </button>
          {!r.restriction ? (
            <button type="button" className="fay-btn-outline" style={{ borderColor: '#ff6b6b' }} onClick={() => setFlagging({ mode: 'review', reason: '' })}>
              <Icon name="block" size={16} /> Flag future bookings
            </button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
