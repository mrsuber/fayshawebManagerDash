import moment from 'moment';
import { useState } from 'react';
import { opsApi } from '../api';
import { useToast } from '../context/ToastContext';
import useNav from '../hooks/useNav';
import { Pill } from './kit';
import { Icon } from './ui';

const GUEST_STATUS = { approved: ['Registered', '#3fd283'], pending: ['To approve', '#e8b84a'], declined: ['Declined', '#d94040'] };
const PASS_STATUS = { pending: ['To approve', '#e8b84a'], approved: ['Expected', '#5b8ff0'], arrived: ['On site', '#3fd283'], left: ['Left', '#8f897d'], declined: ['Declined', '#d94040'], expired: ['Expired', '#8f897d'] };
const day = (d) => moment(d).format('ddd D MMM');

/**
 * Everyone on a stay (GET /reservations/:id/people): the booker's party, registered overnight guests and visitors.
 * Discreet people show as "Private guest" / "Private visitor"; "Check ID" reveals a guest's name for the gate
 * and is recorded in the gate log.
 */
export default function StayPeople({ people, onChanged, compact = false, heading = true }) {
  const toast = useToast();
  const navigate = useNav();
  const [revealed, setRevealed] = useState({});
  if (!people) return <span className="sub">Loading who is on this stay…</span>;
  const { tonight, capacity, guests = [], visitors = [] } = people;
  const reveal = (g) =>
    opsApi
      .revealStayGuest(g.id)
      .then((r) => setRevealed((m) => ({ ...m, [g.id]: `${r.fullName}${r.relation ? ` · ${r.relation}` : ''}${r.phone ? ` · ${r.phone}` : ''}` })))
      .catch((e) => toast(e.message, 'error'));
  const row = { display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', fontSize: 13.5 };

  return (
    <div className="col" style={{ gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {heading ? <strong style={{ fontSize: 15 }}>People on this stay</strong> : null}
        <span className="sub">
          Tonight {tonight.total}
          {capacity ? ` of ${capacity}` : ''} · {tonight.booked} booked{tonight.added ? ` + ${tonight.added} overnight guest${tonight.added > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div style={row}>
        <Icon name="person" size={17} color="var(--gold)" />
        <span style={{ flex: 1 }}>
          {people.booker?.name || 'Booker'} <span className="sub">· booked for {people.booked}</span>
        </span>
        <Pill tone="#3fd283">Booking</Pill>
      </div>

      {guests.map((g) => (
        <div key={`g${g.id}`} style={row}>
          <Icon name={g.discreet ? 'visibility_off' : 'bed'} size={17} color="var(--gold)" />
          <span style={{ flex: 1, minWidth: 180 }}>
            {revealed[g.id] || g.fullName}
            {!revealed[g.id] && g.relation ? <span className="sub"> · {g.relation}</span> : null}
            <span className="sub" style={{ display: 'block' }}>
              Overnight · {day(g.from)} → {day(g.to)} ({g.nights} night{g.nights > 1 ? 's' : ''}){g.passId ? ' · stayed on from a visit' : ''}
              {g.fee ? ` · ${g.fee.toLocaleString('en-US')} XAF` : ''}
              {g.declineReason ? ` · ${g.declineReason}` : ''}
            </span>
          </span>
          {g.discreet && !revealed[g.id] ? (
            <button type="button" className="fay-btn-outline" style={{ padding: '4px 10px' }} title="Shows the name to check against their ID; recorded in the gate log" onClick={() => reveal(g)}>
              <Icon name="badge" size={15} /> Check ID
            </button>
          ) : null}
          <Pill tone={(GUEST_STATUS[g.status] || [])[1] || '#8f897d'}>{(GUEST_STATUS[g.status] || [g.status])[0]}</Pill>
        </div>
      ))}

      {!compact || visitors.length ? (
        visitors.slice(0, compact ? 4 : 10).map((v) => (
          <div key={`v${v.id}`} style={row}>
            <Icon name={v.discreet ? 'visibility_off' : 'badge'} size={17} color="var(--dim)" />
            <span style={{ flex: 1, minWidth: 180 }}>
              {v.visitorName}
              <span className="sub" style={{ display: 'block' }}>
                Visitor · {day(v.date)}
                {v.from ? ` · ${v.from}${v.until ? `–${v.until}` : ''}` : v.until ? ` · until ${v.until}` : ''} · {v.people} person{v.people > 1 ? 's' : ''}
                {v.overnight ? ` · staying until ${day(v.overnight.to)}` : ''}
              </span>
            </span>
            <Pill tone={(PASS_STATUS[v.status] || [])[1] || '#8f897d'}>{(PASS_STATUS[v.status] || [v.status])[0]}</Pill>
          </div>
        ))
      ) : null}

      {!guests.length && !visitors.length ? <span className="sub" style={{ padding: '6px 0' }}>No overnight guests or visitors on this stay.</span> : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
        {onChanged ? (
          <button type="button" className="card-link" onClick={onChanged}>
            Refresh
          </button>
        ) : null}
        <button type="button" className="card-link" onClick={() => navigate('/visitors')}>
          Open Visitors ›
        </button>
      </div>
    </div>
  );
}
