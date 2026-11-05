import moment from 'moment';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { opsApi } from '../../api';
import AssignPicker from '../../components/AssignPicker';
import { Empty, Pill, Tabs, Toolbar } from '../../components/kit';
import { Icon, KpiGrid } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useSocketEvent from '../../hooks/useSocketEvent';

const STATUS = {
  requested: ['To confirm', '#e8b84a'],
  upcoming: ['Confirmed', '#5b8ff0'],
  in_progress: ['Arrived', '#3fd283'],
  completed: ['Completed', '#8f897d'],
  cancelled: ['Cancelled', '#8f897d'],
  declined: ['Declined', '#d94040'],
  no_show: ['No-show', '#d94040'],
};

/**
 * Wellness bookings. Guests book from the app: a time the team opened in Availability is confirmed at once, any other
 * time arrives here as a request to confirm (at that time or another) or decline. Every booking has a code the guest
 * shows on arrival; entering it here checks them in.
 */
export default function WellnessBookings() {
  const toast = useToast();
  const [params] = useSearchParams();
  const focus = Number(params.get('id')) || null;
  const [tab, setTab] = useState('requested');
  const [date, setDate] = useState('');
  const [code, setCode] = useState('');
  const q = useApi(() => opsApi.wellnessBookings(tab, date || undefined), [tab, date], { items: [], counts: {} });
  useSocketEvent('wellness:updated', () => q.reload());

  const items = q.data?.items || [];
  const counts = q.data?.counts || {};

  const act = (p, message) =>
    p
      .then((r) => {
        q.reload();
        toast(message);
        return r;
      })
      .catch((e) => toast(e.message, 'error'));

  const checkIn = (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    act(opsApi.wellnessCheckIn(code.trim()), 'Checked in').then((b) => {
      if (b) {
        toast(`${b.guest} · ${b.activity} · ${b.start}: checked in`);
        setCode('');
      }
    });
  };

  const confirmAt = (b) => {
    const start = window.prompt(`Confirm ${b.activity} for ${b.guest} at another time (HH:MM)`, b.start);
    if (start === null) return;
    if (!/^\d{2}:\d{2}$/.test(start.trim())) return toast('Write the time as HH:MM, e.g. 16:30', 'error');
    act(opsApi.wellnessAction(b.id, 'confirm', { start: start.trim() }), `Confirmed at ${start.trim()} — the guest is notified`);
  };

  const decline = (b) => {
    const reason = window.prompt('Why? (sent to the guest)', '');
    if (reason === null) return;
    act(opsApi.wellnessAction(b.id, 'decline', { reason }), 'Declined — the guest is notified');
  };

  const kpis = [
    { icon: 'pending_actions', c: '#e8b84a', n: counts.requested || 0, l: 'Requests to confirm', dc: counts.requested ? '#e8b84a' : undefined },
    { icon: 'event_available', c: '#5b8ff0', n: counts.today || 0, l: 'Booked today' },
    { icon: 'how_to_reg', c: '#3fd283', n: counts.arrived || 0, l: 'Arrived today' },
  ];

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={190} />
      <Toolbar right={<input className="kit-select" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day" />}>
        <form onSubmit={checkIn} className="kit-actions" style={{ flex: 1 }}>
          <input
            className="kit-select"
            style={{ minWidth: 200, flex: 1, maxWidth: 300, fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Guest’s code, e.g. W7K3Q9A"
            aria-label="Booking code"
          />
          <button type="submit" className="btn-gold"><Icon name="how_to_reg" size={18} /> Check in</button>
        </form>
      </Toolbar>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[['requested', 'To confirm', counts.requested || undefined], ['open', 'Upcoming'], ['today', 'Today'], ['all', 'All']]}
      />

      <section className="card kit-scroll" style={{ padding: 6 }}>
        {items.length === 0 && !q.loading ? (
          <Empty icon="spa" title={tab === 'requested' ? 'No requests waiting' : 'No bookings'}>
            Guests book from the app. Times you open in Wellness → Availability are confirmed at once; other times arrive here to confirm.
          </Empty>
        ) : null}
        {items.length ? (
          <table className="kit-table" style={{ minWidth: 1080 }}>
            <thead>
              <tr><th>Code</th><th>Guest</th><th>Experience</th><th>When</th><th>Specialist</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} style={b.id === focus ? { background: 'rgba(232,184,74,.08)' } : undefined}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}>{b.code}</td>
                  <td>
                    {b.guest}
                    <div className="sub">{[b.residence ? `Residence ${b.residence}` : null, b.people > 1 ? `${b.people} people` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td>
                    {b.activity}
                    {b.type === 'journey' ? <span className="sub"> · journey</span> : null}
                    <div className="sub">{[b.place, b.group ? 'booked with other experiences' : null, b.requests ? `“${b.requests}”` : null].filter(Boolean).join(' · ') || `${b.minutes} min`}</div>
                  </td>
                  <td>
                    {moment(b.date).format('ddd D MMM')} · {b.start}–{b.end}
                    {b.status === 'requested' ? <div className="sub">asked {moment(b.createdAt).fromNow()}</div> : null}
                    {b.checkedInAt ? <div className="sub">arrived {moment(b.checkedInAt).format('HH:mm')}{b.checkedInBy ? ` · ${b.checkedInBy}` : ''}</div> : null}
                  </td>
                  <td style={{ minWidth: 190 }}>
                    {['requested', 'upcoming', 'in_progress'].includes(b.status) ? (
                      <AssignPicker
                        department="Wellness"
                        value={b.staff?.id}
                        onChange={(staffId) => act(opsApi.wellnessAction(b.id, 'assign', { staffId }), staffId ? 'Assigned — the specialist is notified' : 'Unassigned')}
                      />
                    ) : (
                      <span className="sub">{b.staff?.name || '—'}</span>
                    )}
                  </td>
                  <td>
                    <Pill tone={STATUS[b.status]?.[1]}>{STATUS[b.status]?.[0] || b.status}</Pill>
                    {b.declineReason ? <div className="sub">{b.declineReason}</div> : null}
                    {b.rating ? <div className="sub" style={{ color: b.rating <= 2 ? 'var(--red-soft)' : 'var(--gold)' }} title={b.ratingComment || ''}>{'★'.repeat(b.rating)}{'☆'.repeat(5 - b.rating)}{b.ratingComment ? ` “${b.ratingComment.slice(0, 40)}”` : ''}</div> : null}
                  </td>
                  <td>
                    <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
                      {b.status === 'requested' ? (
                        <>
                          <button type="button" className="btn-gold" onClick={() => act(opsApi.wellnessAction(b.id, 'confirm'), 'Confirmed — the guest is notified')}>Confirm</button>
                          <button type="button" className="fay-btn-outline" onClick={() => confirmAt(b)}>Other time</button>
                          <button type="button" className="fay-btn-outline" onClick={() => decline(b)}>Decline</button>
                        </>
                      ) : null}
                      {b.status === 'upcoming' ? (
                        <>
                          <button type="button" className="btn-gold" onClick={() => act(opsApi.wellnessAction(b.id, 'check-in'), 'Checked in')}>Arrived</button>
                          <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Mark as no-show?') && act(opsApi.wellnessAction(b.id, 'no-show'), 'Marked as no-show')}>No-show</button>
                        </>
                      ) : null}
                      {b.status === 'in_progress' ? <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.wellnessAction(b.id, 'complete'), 'Completed')}>Completed</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
