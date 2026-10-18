import { useEffect, useRef, useState } from 'react';
import { Card, Chip, Icon, Placeholder, QuickActions } from '../../components/ui';
import { BOOKING_TYPES, CHANNELS, DEPARTMENT_ICON, GUEST_STATUS_COLOR, fmtDate, money, nights, slot, statusColors, when } from './format';

const divider = '1px solid var(--border)';
const histCols = '1.2fr 1.2fr .6fr 1fr .8fr';
const emptyRow = (text) => <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--dim)' }}>{text}</div>;

export function StatusPill({ s, minWidth }) {
  const [bg, fg] = statusColors(s);
  return <span style={{ padding: '5px 12px', borderRadius: 4, fontSize: 13, minWidth, textAlign: 'center', background: bg, color: fg, whiteSpace: 'nowrap' }}>{s}</span>;
}

function ListRow({ icon, c, t, d, children, iconBox }) {
  return (
    <div className="row-line" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '8px 0' }}>
      {iconBox ? (
        <span
          className="icon"
          style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', fontSize: 24, color: c, flexShrink: 0 }}
        >
          {icon}
        </span>
      ) : (
        <Icon name={icon} size={24} color={c} />
      )}
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15 }}>{t}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{d}</span>
      </div>
      {children}
    </div>
  );
}

/* ---------- Rows (shared by cards and View All dialogs) ---------- */

export const ServiceRow = (r) => (
  <ListRow key={r.key} icon={r.icon} c={r.color} t={r.title} d={r.detail} iconBox>
    <StatusPill s={r.status} />
  </ListRow>
);

export function RequestRow({ r, onComplete }) {
  const [icon, c] = DEPARTMENT_ICON[r.department] || ['room_service', '#e8b84a'];
  return (
    <ListRow key={r.id} icon={icon} c={c} t={r.title} d={`${r.department} · ${r.location}${r.priority === 'High' ? ' · High priority' : ''}`}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{when(r.createdAt)}</span>
      <StatusPill s={r.status} minWidth={92} />
      {onComplete && r.status !== 'Completed' && (
        <button type="button" className="mini-btn" onClick={() => onComplete(r)} title="Mark as completed" aria-label="Mark as completed">
          <Icon name="check" size={18} />
        </button>
      )}
    </ListRow>
  );
}

export function BookingRow({ b, onCancel }) {
  const type = BOOKING_TYPES[b.type] || BOOKING_TYPES.wellness;
  return (
    <ListRow key={b.id} icon={type.icon} c={type.color} t={b.title} d={`${slot(b.startsAt, b.endsAt)}${b.guests ? ` · ${b.guests} guest${b.guests > 1 ? 's' : ''}` : ''}`}>
      <StatusPill s={b.status} minWidth={92} />
      {onCancel && ['Confirmed', 'Pending'].includes(b.status) && new Date(b.startsAt) > new Date() && (
        <button type="button" className="mini-btn" onClick={() => onCancel(b)} title="Cancel booking" aria-label="Cancel booking">
          <Icon name="close" size={18} />
        </button>
      )}
    </ListRow>
  );
}

export const TimelineRow = (r) => (
  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '14px 52px 1fr auto', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--gold)' }} />
    <span style={{ color: 'var(--text-3)' }}>{when(r.at)}</span>
    <span>{r.title}</span>
    <span style={{ color: 'var(--dim)', fontSize: 12 }}>{r.category}</span>
  </div>
);

export const HistoryHeader = () => (
  <div style={{ display: 'grid', gridTemplateColumns: histCols, gap: 8, fontSize: 12, color: 'var(--dim)', paddingBottom: 6, borderBottom: divider }}>
    <span>Date</span>
    <span>Residence</span>
    <span>Nights</span>
    <span>Purpose</span>
    <span>Satisfaction</span>
  </div>
);

export const StayRow = (r) => (
  <div key={r.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: histCols, gap: 8, fontSize: 13, padding: '7px 0', alignItems: 'center' }}>
    <span>{fmtDate(r.checkIn)}</span>
    <span>
      {r.residence}
      {r.status !== 'Completed' && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gold)' }}>{r.status}</span>}
    </span>
    <span>{r.nights}</span>
    <span>{r.purpose}</span>
    <span style={{ color: r.satisfaction ? 'var(--green-bright)' : 'var(--dim)' }}>{r.satisfaction ?? '—'}</span>
  </div>
);

export function GuestRow({ g, selected, onSelect }) {
  return (
    <div
      key={g.id}
      className="hov-row"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(g)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(g)}
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr auto',
        gap: 10,
        alignItems: 'center',
        padding: '6px 8px',
        fontSize: 13,
        borderRadius: 6,
        cursor: 'pointer',
        background: selected ? 'rgba(232,184,74,.1)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(232,184,74,.5)' : 'transparent'}`,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${GUEST_STATUS_COLOR[g.status] || 'var(--gold)'}` }} />
      <div className="col" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
          {g.name}
          {g.vip && <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '0 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>VIP</span>}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {g.residence} · {g.status === 'Upcoming' ? `arrives ${fmtDate(g.checkIn)}` : `last stay ${fmtDate(g.lastStayAt)}`} · {g.totalStays} stay{g.totalStays === 1 ? '' : 's'}
        </span>
      </div>
      <span style={{ color: GUEST_STATUS_COLOR[g.status] || 'var(--dim)', fontSize: 12 }}>{g.status}</span>
    </div>
  );
}

/* ---------- Cards ---------- */

function Badge({ icon, color, children, on = true }) {
  return (
    <span
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: 13,
        border: '1px solid var(--border-strong)',
        opacity: on ? 1 : 0.55,
      }}
    >
      <Icon name={icon} size={18} color={color} />
      {children}
    </span>
  );
}

export function CurrentStayCard({ guest }) {
  const [bg] = statusColors(guest.status);
  return (
    <Card title={guest.status === 'Checked Out' ? 'Last Stay' : guest.status === 'In House' ? 'Current Stay' : 'Upcoming Stay'} gap={12}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Placeholder style={{ minWidth: 150, height: 150, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10 }}>
          <span className="mono-label" style={{ marginBottom: 'auto' }}>
            residence photo
          </span>
          <span className="serif" style={{ fontSize: 22 }}>
            {guest.residence}
          </span>
          <span style={{ fontSize: 13, color: '#b9b2a5' }}>{guest.collection}</span>
        </Placeholder>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: 'var(--text-3)', alignContent: 'start' }}>
          <div>
            <div style={{ color: 'var(--dim)' }}>Check-in</div>
            {fmtDate(guest.checkIn)}
            <br />
            {guest.checkInTime}
          </div>
          <div>
            <div style={{ color: 'var(--dim)' }}>Check-out</div>
            {fmtDate(guest.checkOut)}
            <br />
            {guest.checkOutTime}
          </div>
          <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: divider }}>
            {nights(guest)} Nights · {guest.purpose}
          </div>
          <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: divider }}>
            {guest.adults} Adults · {guest.children} Children
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderRadius: 6, background: `${bg}2e`, border: `1px solid ${bg}`, fontSize: 13 }}>
          <Icon name={guest.status === 'Checked Out' ? 'logout' : 'check_circle'} size={18} color="var(--green-bright)" />
          {guest.status}
        </span>
        <Badge icon="key" color="var(--green-bright)" on={guest.flags.digitalKey}>
          Digital Key {guest.flags.digitalKey ? 'Active' : 'Inactive'}
        </Badge>
        <Badge icon="local_parking" color="var(--blue-soft)" on={guest.flags.parking}>
          Parking {guest.flags.parking ? 'Confirmed' : 'Not requested'}
        </Badge>
      </div>
    </Card>
  );
}

export function PreferencesCard({ guest, onEdit }) {
  return (
    <Card title="Guest Preferences" link="Edit ›" onLink={onEdit} gap={4} headGap={6}>
      {guest.preferences.map((r) => (
        <div key={r.key} className="row-line hov-row" onClick={onEdit} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '7px 0', cursor: 'pointer' }}>
          <Icon name={r.icon} size={24} color={r.color} />
          <div className="col" style={{ flex: 1 }}>
            <span style={{ fontSize: 15 }}>{r.title}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.detail}</span>
          </div>
          <Icon name="chevron_right" size={18} color="var(--dim)" />
        </div>
      ))}
    </Card>
  );
}

export function ServicesCard({ services, limit = 5, onViewAll }) {
  return (
    <Card title="Smart Locker & Resident Services" link="View All ›" onLink={onViewAll} gap={4} headGap={6}>
      {services.slice(0, limit).map(ServiceRow)}
    </Card>
  );
}

export function RequestsCard({ requests, limit = 3, onViewAll, onNew, onComplete }) {
  const active = requests.filter((r) => r.status !== 'Completed');
  return (
    <Card
      title={`Active Requests (${active.length})`}
      gap={4}
      headGap={6}
      aside={
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="button" className="card-link" onClick={onNew}>
            + New
          </button>
          <button type="button" className="card-link" onClick={onViewAll}>
            View All ›
          </button>
        </span>
      }
    >
      {requests.length ? requests.slice(0, limit).map((r) => <RequestRow key={r.id} r={r} onComplete={onComplete} />) : emptyRow('No requests yet.')}
    </Card>
  );
}

export function BookingsCard({ bookings, title = 'Upcoming Bookings', limit = 3, onViewAll, onBook, bookLabel = '+ Book' }) {
  return (
    <Card
      title={title}
      gap={4}
      headGap={6}
      aside={
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {onBook && (
            <button type="button" className="card-link" onClick={onBook}>
              {bookLabel}
            </button>
          )}
          <button type="button" className="card-link" onClick={onViewAll}>
            View All ›
          </button>
        </span>
      }
    >
      {bookings.length ? bookings.slice(0, limit).map((b) => <BookingRow key={b.id} b={b} />) : emptyRow('Nothing booked.')}
    </Card>
  );
}

export function TimelineCard({ events, title = 'Stay Timeline', limit = 6, onViewAll }) {
  return (
    <Card title={title} link="View All ›" onLink={onViewAll} gap={2} headGap={6}>
      {events.length ? events.slice(0, limit).map(TimelineRow) : emptyRow('No activity yet.')}
    </Card>
  );
}

const GUEST_FILTERS = ['All', 'In House', 'Arriving', 'Upcoming', 'Checked Out', 'VIP'];
export const guestMatches = (g, filter, q) =>
  (filter === 'All' || (filter === 'VIP' ? g.vip : g.status === filter)) && (!q || `${g.name} ${g.residence} ${g.country}`.toLowerCase().includes(q.toLowerCase()));

/** Everyone who has stayed (or is booked), with status filter + search; selecting one loads their profile. */
export function GuestsCard({ guests, selectedId, onSelect, onViewAll, limit = 6 }) {
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const shown = guests.filter((g) => guestMatches(g, filter, q.trim()));
  return (
    <Card title={`All Guests (${guests.length})`} link="View All ›" onLink={onViewAll} gap={6} headGap={2}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 6 }}>
        <Icon name="search" size={16} color="var(--dim)" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search guests, residences, countries…"
          aria-label="Search guests"
          style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)' }}
        />
      </label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {GUEST_FILTERS.map((f) => (
          <Chip key={f} on={f === filter} onClick={() => setFilter(f)} style={{ padding: '3px 9px', borderRadius: 4, fontSize: 12 }}>
            {f} ({guests.filter((g) => guestMatches(g, f, '')).length})
          </Chip>
        ))}
      </div>
      <div className="col" style={{ gap: 2 }}>
        {shown.length ? shown.slice(0, limit).map((g) => <GuestRow key={g.id} g={g} selected={g.id === selectedId} onSelect={onSelect} />) : emptyRow('No guests match.')}
        {shown.length > limit && (
          <button type="button" className="card-link" onClick={onViewAll} style={{ alignSelf: 'flex-start', paddingTop: 4 }}>
            +{shown.length - limit} more ›
          </button>
        )}
      </div>
    </Card>
  );
}
GuestsCard.FILTERS = GUEST_FILTERS;

export function HistoryCard({ stays, limit = 3, onViewAll }) {
  return (
    <Card title="Guest History" link="View All ›" onLink={onViewAll} gap={4} headGap={6}>
      <HistoryHeader />
      {stays.slice(0, limit).map(StayRow)}
    </Card>
  );
}

export function InsightsCard({ insights, limit = 5, onViewAll }) {
  return (
    <Card title="Guest Insights (AI)" link="View All ›" onLink={onViewAll} gap={8} headGap={2}>
      {insights.slice(0, limit).map((r) => (
        <div key={r} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
          <Icon name="auto_awesome" size={18} color="var(--gold)" />
          {r}
        </div>
      ))}
    </Card>
  );
}

export function QuickActionsCard({ items }) {
  return (
    <Card title="Quick Actions">
      <QuickActions items={items} iconSize={26} variant="fill" fontSize={13} padding="12px 6px" gap={6} />
    </Card>
  );
}

const channelLabel = (c) => (CHANNELS.find(([v]) => v === c) || [c, c])[1];

/** Thread with the guest + reply box (Communications tab). */
export function ConversationCard({ guest, conversation, messages, onSend, onOpenInbox }) {
  const [draft, setDraft] = useState('');
  const [channel, setChannel] = useState(conversation?.channel || 'whatsapp');
  const thread = useRef(null);
  // Keep the newest message in view.
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages.length]);
  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend({ channel, body }).then(() => setDraft(''));
  };
  return (
    <Card
      title={`Conversation with ${guest.name}`}
      style={{ gridColumn: '1 / -1' }}
      gap={10}
      aside={
        conversation && (
          <button type="button" className="card-link" onClick={onOpenInbox}>
            Open in Communications ›
          </button>
        )
      }
    >
      <div ref={thread} className="col" style={{ gap: 12, maxHeight: 420, overflow: 'auto', padding: '4px 2px' }}>
        {messages.length === 0 && emptyRow('No messages yet — start the conversation below.')}
        {messages.map((m) => (
          <div
            key={m.id}
            className="col"
            style={{
              maxWidth: '72%',
              gap: 4,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.45,
              whiteSpace: 'pre-line',
              alignSelf: m.fromStaff ? 'flex-end' : 'flex-start',
              background: m.fromStaff ? 'rgba(232,184,74,.08)' : 'var(--surface-3)',
              border: `1px solid ${m.fromStaff ? 'rgba(232,184,74,.35)' : 'rgba(255,255,255,.06)'}`,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--gold)' }}>{m.sender}</span>
            {m.body}
            <span style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'flex-end' }}>
              {when(m.createdAt)}
              {m.fromStaff ? ' ✓✓' : ''}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 6px 6px 10px' }}>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          aria-label="Channel"
          style={{ background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '6px 8px', fontFamily: 'var(--sans)' }}
        >
          {CHANNELS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Message ${guest.name} via ${channelLabel(channel)}…`}
          style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14, fontFamily: 'var(--sans)' }}
        />
        <button type="button" className="btn-gold" onClick={send} style={{ border: 0, padding: '8px 16px', fontSize: 14, fontFamily: 'var(--sans)' }}>
          Send
          <Icon name="send" size={18} />
        </button>
      </div>
    </Card>
  );
}

/** Folio: charges, payments, balance (Billing tab). */
export function BillingCard({ folio, onRecordPayment, onCardPayment }) {
  if (!folio) return null;
  const row = (key, date, label, sub, amount, color) => (
    <div key={key} className="row-line" style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text-3)' }}>{fmtDate(date)}</span>
      <div className="col">
        <span style={{ fontSize: 14 }}>{label}</span>
        <span className="sub">{sub}</span>
      </div>
      <span style={{ color, fontSize: 14 }}>{amount}</span>
    </div>
  );
  return (
    <Card
      title="Billing & Folio"
      style={{ gridColumn: '1 / -1' }}
      gap={10}
      aside={
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="fay-btn-outline" onClick={onRecordPayment} style={{ background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}>
            <Icon name="point_of_sale" size={18} />
            Record Payment
          </button>
          <button type="button" className="btn-gold" onClick={onCardPayment} disabled={folio.balance <= 0} style={{ border: 0, fontFamily: 'var(--sans)', opacity: folio.balance <= 0 ? 0.5 : 1 }}>
            <Icon name="credit_card" size={18} />
            Collect by Card
          </button>
        </span>
      }
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          ['Total charges', money(folio.total)],
          ['Paid', money(folio.paid)],
          ['Balance due', money(folio.balance)],
        ].map(([l, v], i) => (
          <div key={l} className="col" style={{ padding: '12px 16px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, gap: 4, minWidth: 150 }}>
            <span className="serif" style={{ fontSize: 26, fontWeight: 600, color: i === 2 && folio.balance > 0 ? 'var(--gold)' : undefined }}>
              {v}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
        <div className="col">
          <span style={{ fontSize: 13, color: 'var(--dim)', paddingBottom: 4 }}>Charges</span>
          {folio.charges.length ? folio.charges.map((c) => row(`c${c.id}`, c.date, c.description, c.category, money(c.amount))) : emptyRow('No charges.')}
        </div>
        <div className="col">
          <span style={{ fontSize: 13, color: 'var(--dim)', paddingBottom: 4 }}>Payments</span>
          {folio.payments.length ? folio.payments.map((p) => row(`p${p.id}`, p.date, p.method, 'Payment', `− ${money(p.amount)}`, 'var(--green-bright)')) : emptyRow('No payments yet.')}
        </div>
      </div>
    </Card>
  );
}

export function NotesCard({ notes, onAdd }) {
  return (
    <Card title={`Staff Notes (${notes.length})`} style={{ gridColumn: '1 / -1' }} link="+ Add Note" onLink={onAdd} gap={4} headGap={6}>
      {notes.length
        ? notes.map((n) => (
            <div key={n.id} className="row-line" style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
              <Icon name="sticky_note_2" size={22} color="var(--gold)" />
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{n.body}</span>
                <span className="sub">
                  {n.author} · {fmtDate(n.createdAt)} {when(n.createdAt)}
                </span>
              </div>
            </div>
          ))
        : emptyRow('No notes yet.')}
    </Card>
  );
}
