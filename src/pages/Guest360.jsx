import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material';
import moment from 'moment';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { guestsApi, serviceRequestsApi } from '../api';
import { Icon, Placeholder } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';
import useGuestActions from './guest360/GuestActions';
import {
  BillingCard,
  BookingRow,
  BookingsCard,
  ConversationCard,
  CurrentStayCard,
  GuestRow,
  GuestsCard,
  HistoryCard,
  HistoryHeader,
  InsightsCard,
  NotesCard,
  PreferencesCard,
  QuickActionsCard,
  RequestRow,
  RequestsCard,
  ServiceRow,
  ServicesCard,
  StayRow,
  TimelineCard,
  TimelineRow,
} from './guest360/cards';
import { BOOKING_TYPES, GUEST_STATUS_COLOR, money, nights, fmtDate } from './guest360/format';

const TABS = ['Overview', 'Stay Details', 'Preferences', 'Journey', 'Communications', 'Requests', 'Reservations', 'Wellness', 'Dining', 'Experiences', 'Billing', 'Notes', 'History'];

/** Which cards each tab shows (Overview = the original dashboard + All Guests). */
const LAYOUT = {
  Overview: ['stay', 'preferences', 'services', 'requests', 'bookings', 'timeline', 'guests', 'history', 'insights', 'quick'],
  'Stay Details': ['stay', 'services', 'bookings', 'requests', 'timeline', 'quick'],
  Preferences: ['preferences', 'insights', 'quick'],
  Journey: ['timelineFull'],
  Communications: ['conversation'],
  Requests: ['requestsFull'],
  Reservations: ['stay', 'historyFull', 'bookings'],
  Wellness: ['bookings:wellness'],
  Dining: ['bookings:dining'],
  Experiences: ['bookings:experience', 'bookings:transport'],
  Billing: ['billing'],
  Notes: ['notes'],
  History: ['historyFull', 'guests'],
};

const FIRST_GUEST = 1;

export default function Guest360() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const guestId = Number(params.get('guest')) || FIRST_GUEST;
  const [tab, setTab] = useState('Overview');
  const [rev, setRev] = useState(0);
  const [view, setView] = useState(null);
  const [menu, setMenu] = useState(null);
  const refresh = useCallback(() => setRev((r) => r + 1), []);

  const guests = useApi(() => guestsApi.list(), [rev], []);
  const profile = useApi(() => guestsApi.get(guestId), [guestId, rev]);
  const requests = useApi(() => serviceRequestsApi.list({ guestId }), [guestId, rev], []);
  const bookings = useApi(() => guestsApi.bookings(guestId), [guestId, rev], []);
  const timeline = useApi(() => guestsApi.timeline(guestId), [guestId, rev], []);
  const stays = useApi(() => guestsApi.stays(guestId), [guestId, rev], []);
  const notes = useApi(() => guestsApi.notes(guestId), [guestId, rev], []);
  const folio = useApi(() => guestsApi.folio(guestId), [guestId, rev]);
  const conv = useApi(() => guestsApi.conversation(guestId), [guestId, rev], { conversation: null, messages: [] });

  const guest = profile.data?.id === guestId ? profile.data : null;
  const { actions, dialogs } = useGuestActions(guest, refresh);

  // Live updates from the backend for this guest.
  const mine = (p) => p && Number(p.guestId) === guestId && refresh();
  useSocketEvent('service-request:created', mine);
  useSocketEvent('service-request:updated', mine);
  useSocketEvent('message:new', (m) => conv.data?.conversation && m.conversationId === conv.data.conversation.id && refresh());

  const selectGuest = (g) => {
    setParams({ guest: String(g.id) });
    setView(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const fail = (e) => toast(e.message, 'error');
  const completeRequest = (r) =>
    serviceRequestsApi
      .update(r.id, { status: 'Completed' })
      .then(() => {
        toast(`${r.title} completed`);
        refresh();
      })
      .catch(fail);
  const cancelBooking = (b) =>
    guestsApi
      .updateBooking(guestId, b.id, { status: 'Cancelled' })
      .then(() => {
        toast(`${b.title} cancelled`);
        refresh();
      })
      .catch(fail);
  const sendMessage = (v) =>
    guestsApi
      .sendMessage(guestId, v)
      .then(() => {
        toast('Message sent');
        refresh();
      })
      .catch(fail);
  const openInbox = () => navigate(`/comms?conversation=${conv.data.conversation.id}`);
  const payBalance = (kind) => actions.open(kind, { balance: folio.data?.balance || 0, balanceLabel: money(folio.data?.balance || 0) });

  if (profile.error && !guest) {
    return (
      <div className="card" style={{ padding: 24, alignItems: 'flex-start', gap: 12 }}>
        <span>Couldn't load this guest: {profile.error.message}</span>
        <button type="button" className="btn-gold" style={{ border: 0 }} onClick={() => setParams({})}>
          Back to Guest 360
        </button>
      </div>
    );
  }
  if (!guest) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading guest…</div>;

  const upcoming = bookings.data.filter((b) => new Date(b.endsAt) >= new Date() && b.status !== 'Cancelled');
  const quick = [
    { icon: 'chat', c: '#4fc3f7', l: 'Message Guest', onClick: () => actions.open('message') },
    { icon: 'assignment_add', c: '#5b8ff0', l: 'Create Request', onClick: () => actions.open('request') },
    { icon: 'spa', c: '#9b7bf0', l: 'Book Wellness', onClick: () => actions.open('booking', { type: 'wellness' }) },
    { icon: 'restaurant', c: '#e8b84a', l: 'Book Dining', onClick: () => actions.open('booking', { type: 'dining' }) },
    { icon: 'sailing', c: '#4fc3f7', l: 'Book Experience', onClick: () => actions.open('booking', { type: 'experience' }) },
    { icon: 'manage_accounts', c: '#e6e0d4', l: 'Edit Preferences', onClick: () => actions.open('preferences') },
  ];

  const renderCard = (id) => {
    const [kind, type] = id.split(':');
    switch (kind) {
      case 'stay':
        return <CurrentStayCard key={id} guest={guest} />;
      case 'preferences':
        return <PreferencesCard key={id} guest={guest} onEdit={() => actions.open('preferences')} />;
      case 'services':
        return <ServicesCard key={id} services={guest.services} onViewAll={() => setView('services')} />;
      case 'requests':
        return <RequestsCard key={id} requests={requests.data} onViewAll={() => setView('requests')} onNew={() => actions.open('request')} onComplete={completeRequest} />;
      case 'requestsFull':
        return (
          <div key={id} style={{ gridColumn: '1 / -1' }}>
            <RequestsCard requests={requests.data} limit={Infinity} onViewAll={() => setView('requests')} onNew={() => actions.open('request')} onComplete={completeRequest} />
          </div>
        );
      case 'bookings': {
        const t = type && BOOKING_TYPES[type];
        const list = t ? bookings.data.filter((b) => b.type === type) : upcoming;
        return (
          <BookingsCard
            key={id}
            title={t ? `${t.label} Bookings (${list.length})` : 'Upcoming Bookings'}
            bookings={list}
            limit={t ? Infinity : 3}
            onViewAll={() => setView(t ? `bookings:${type}` : 'bookings')}
            onBook={() => actions.open('booking', { type: type || 'wellness' })}
            bookLabel={t ? `+ Book ${t.label}` : '+ Book'}
          />
        );
      }
      case 'timeline':
        return <TimelineCard key={id} events={timeline.data} onViewAll={() => setView('timeline')} />;
      case 'timelineFull':
        return (
          <div key={id} style={{ gridColumn: '1 / -1' }}>
            <TimelineCard title="Guest Journey" events={timeline.data} limit={Infinity} onViewAll={() => setView('timeline')} />
          </div>
        );
      case 'guests':
        return <GuestsCard key={id} guests={guests.data} selectedId={guestId} onSelect={selectGuest} onViewAll={() => setView('guests')} />;
      case 'history':
        return <HistoryCard key={id} stays={stays.data} onViewAll={() => setView('history')} />;
      case 'historyFull':
        return <HistoryCard key={id} stays={stays.data} limit={Infinity} onViewAll={() => setView('history')} />;
      case 'insights':
        return <InsightsCard key={id} insights={guest.insights} onViewAll={() => setView('insights')} />;
      case 'quick':
        return <QuickActionsCard key={id} items={quick} />;
      case 'conversation':
        return <ConversationCard key={`${id}-${guestId}`} guest={guest} conversation={conv.data.conversation} messages={conv.data.messages} onSend={sendMessage} onOpenInbox={openInbox} />;
      case 'billing':
        return <BillingCard key={id} folio={folio.data} onRecordPayment={() => payBalance('recordPayment')} onCardPayment={() => payBalance('cardPayment')} />;
      case 'notes':
        return <NotesCard key={id} notes={notes.data} onAdd={() => actions.open('note')} />;
      default:
        return null;
    }
  };

  const viewType = view?.startsWith('bookings:') ? view.split(':')[1] : null;
  const bookingFilterOptions = ['All', 'Upcoming', 'Confirmed', 'Pending', 'Completed', 'Cancelled'];
  const bookingStatus = (b) => [b.status, new Date(b.endsAt) >= new Date() && b.status !== 'Cancelled' ? 'Upcoming' : null].filter(Boolean);
  const isInHouse = guest.status === 'In House';
  const canCheckIn = guest.status === 'Arriving' || guest.status === 'Upcoming';

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {[
          ['chat', 'Message Guest', () => actions.open('message')],
          ['assignment_add', 'Create Request', () => actions.open('request')],
          ['expand_more', 'More Actions', (e) => setMenu(e.currentTarget)],
        ].map(([icon, label, onClick]) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="hov-gold-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: '1px solid rgba(232,184,74,.4)',
              borderRadius: 6,
              fontSize: 15,
              cursor: 'pointer',
              background: '#0f1216',
              color: 'var(--text)',
              fontFamily: 'var(--sans)',
            }}
          >
            <Icon name={icon} size={20} />
            {label}
          </button>
        ))}
      </div>

      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} onClick={() => setMenu(null)}>
        {Object.entries(BOOKING_TYPES).map(([type, t]) => (
          <MenuItem key={type} onClick={() => actions.open('booking', { type })}>
            <ListItemIcon>
              <Icon name={t.icon} size={20} color={t.color} />
            </ListItemIcon>
            Book {t.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => actions.open('preferences')}>
          <ListItemIcon>
            <Icon name="manage_accounts" size={20} />
          </ListItemIcon>
          Edit Preferences
        </MenuItem>
        <MenuItem onClick={() => actions.open('tags')}>
          <ListItemIcon>
            <Icon name="sell" size={20} />
          </ListItemIcon>
          Edit Tags
        </MenuItem>
        <MenuItem onClick={() => actions.open('note')}>
          <ListItemIcon>
            <Icon name="sticky_note_2" size={20} />
          </ListItemIcon>
          Add Staff Note
        </MenuItem>
        <MenuItem onClick={() => payBalance('recordPayment')}>
          <ListItemIcon>
            <Icon name="point_of_sale" size={20} />
          </ListItemIcon>
          Record Payment
        </MenuItem>
        <MenuItem onClick={actions.toggleVip}>
          <ListItemIcon>
            <Icon name="workspace_premium" size={20} color="var(--gold)" />
          </ListItemIcon>
          {guest.vip ? 'Remove VIP Status' : 'Mark as VIP'}
        </MenuItem>
        {conv.data.conversation && (
          <MenuItem onClick={openInbox}>
            <ListItemIcon>
              <Icon name="forum" size={20} />
            </ListItemIcon>
            Open in Communications
          </MenuItem>
        )}
        <Divider />
        {canCheckIn && (
          <MenuItem onClick={actions.checkIn}>
            <ListItemIcon>
              <Icon name="login" size={20} color="var(--green-bright)" />
            </ListItemIcon>
            Check In
          </MenuItem>
        )}
        {isInHouse && (
          <MenuItem onClick={() => actions.open('checkOut')}>
            <ListItemIcon>
              <Icon name="logout" size={20} color="var(--red-soft)" />
            </ListItemIcon>
            Check Out
          </MenuItem>
        )}
      </Menu>

      {/* Profile banner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <Placeholder label="guest portrait" style={{ width: 150, height: 150, borderRadius: 8, display: 'flex', alignItems: 'flex-end', padding: 8 }} />
        <div className="col" style={{ gap: 6, minWidth: 0, flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="serif" style={{ fontSize: 34, fontWeight: 600 }}>
              {guest.name}
            </span>
            {guest.vip && <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>VIP</span>}
            <span style={{ background: GUEST_STATUS_COLOR[guest.status] === '#3fd283' ? 'var(--green)' : '#3a3f48', padding: '2px 10px', borderRadius: 4, fontSize: 13 }}>{guest.status}</span>
          </div>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            {guest.collection} · {guest.residence}
          </span>
          <span className="serif" style={{ fontSize: 20, color: '#d6cfc1' }}>
            {fmtDate(guest.checkIn)} – {fmtDate(guest.checkOut)} ({nights(guest)} nights)
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {guest.tags.map((t) => (
              <span key={t} style={{ padding: '7px 14px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 6, fontSize: 14 }}>
                {t}
              </span>
            ))}
            <button
              type="button"
              className="icon"
              onClick={() => actions.open('tags')}
              aria-label="Edit tags"
              style={{ padding: '7px 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 6, fontSize: 18, cursor: 'pointer', background: 'transparent', color: 'var(--text)' }}
            >
              add
            </button>
          </div>
        </div>
        <div className="col" style={{ gap: 8, padding: '0 20px', borderLeft: '1px solid var(--border)', fontSize: 14 }}>
          {[
            ['call', guest.contact.phone],
            ['mail', guest.contact.email],
            ['location_on', guest.contact.country],
            ['translate', guest.contact.language],
            ['schedule', `Local Time ${moment().format('HH:mm')}`],
          ].map(([icon, text]) => (
            <div key={icon} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name={icon} size={18} color="#b9b2a5" />
              {text}
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 10, paddingLeft: 20, borderLeft: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, color: '#d6cfc1' }}>Guest Value</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              [money(guest.value.revenue), 'Total Revenue'],
              [String(guest.value.stays), 'Stays'],
              [guest.value.satisfaction ? `${guest.value.satisfaction} / 10` : '—', 'Satisfaction'],
            ].map(([n, l]) => (
              <div key={l} className="col" style={{ padding: '12px 14px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, gap: 4 }}>
                <span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>
                  {n}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <div
            key={t}
            role="tab"
            aria-selected={t === tab}
            className={`tab${t === tab ? ' on' : ''}`}
            onClick={() => setTab(t)}
            style={{ borderRadius: '6px 6px 0 0', background: t === tab ? 'rgba(232,184,74,.12)' : 'transparent' }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>{LAYOUT[tab].map(renderCard)}</div>

      {/* View All pop-ups */}
      <ViewAllDialog
        open={view === 'services'}
        onClose={() => setView(null)}
        title="Smart Locker & Resident Services"
        items={guest.services}
        searchText={(s) => `${s.title} ${s.detail}`}
        renderItem={ServiceRow}
      />
      <ViewAllDialog
        open={view === 'requests'}
        onClose={() => setView(null)}
        title={`Service Requests · ${guest.name}`}
        items={requests.data}
        searchText={(r) => `${r.number} ${r.title} ${r.department} ${r.location}`}
        filters={{ options: ['All', 'New', 'In Progress', 'Scheduled', 'Escalated', 'On Hold', 'Completed'], get: (r) => r.status }}
        renderItem={(r) => <RequestRow key={r.id} r={r} onComplete={completeRequest} />}
        action={
          <button type="button" className="btn-gold" style={{ border: 0, fontSize: 14, fontFamily: 'var(--sans)' }} onClick={() => actions.open('request')}>
            <Icon name="add" size={18} />
            New Request
          </button>
        }
      />
      <ViewAllDialog
        open={view === 'bookings' || !!viewType}
        onClose={() => setView(null)}
        title={viewType ? `${BOOKING_TYPES[viewType].label} Bookings · ${guest.name}` : `Bookings · ${guest.name}`}
        items={viewType ? bookings.data.filter((b) => b.type === viewType) : bookings.data}
        searchText={(b) => `${b.title} ${b.type} ${b.notes || ''}`}
        filters={{ options: bookingFilterOptions, get: bookingStatus }}
        renderItem={(b) => <BookingRow key={b.id} b={b} onCancel={cancelBooking} />}
        action={
          <button type="button" className="btn-gold" style={{ border: 0, fontSize: 14, fontFamily: 'var(--sans)' }} onClick={() => actions.open('booking', { type: viewType || 'wellness' })}>
            <Icon name="add" size={18} />
            New Booking
          </button>
        }
      />
      <ViewAllDialog
        open={view === 'timeline'}
        onClose={() => setView(null)}
        title={`Stay Timeline · ${guest.name}`}
        items={timeline.data}
        searchText={(r) => `${r.title} ${r.category}`}
        filters={{ options: ['All', ...Array.from(new Set(timeline.data.map((r) => r.category)))], get: (r) => r.category }}
        renderItem={(r) => (
          <div key={r.id} className="row-line">
            {TimelineRow(r)}
            <span style={{ display: 'block', paddingLeft: 24, fontSize: 11, color: 'var(--dim)', paddingBottom: 4 }}>{moment(r.at).format('ddd, MMM D, YYYY · HH:mm')}</span>
          </div>
        )}
      />
      <ViewAllDialog
        open={view === 'guests'}
        onClose={() => setView(null)}
        title="All Guests"
        items={guests.data}
        searchText={(g) => `${g.name} ${g.residence} ${g.country} ${g.collection}`}
        filters={{ options: GuestsCard.FILTERS, get: (g) => [g.status, g.vip ? 'VIP' : null] }}
        renderItem={(g) => <GuestRow key={g.id} g={g} selected={g.id === guestId} onSelect={selectGuest} />}
      />
      <ViewAllDialog
        open={view === 'history'}
        onClose={() => setView(null)}
        title={`Stay History · ${guest.name}`}
        items={stays.data}
        searchText={(s) => `${s.residence} ${s.purpose}`}
        filters={{ options: ['All', 'Completed', 'Current', 'Upcoming'], get: (s) => s.status }}
        header={<HistoryHeader />}
        renderItem={StayRow}
      />
      <ViewAllDialog
        open={view === 'insights'}
        onClose={() => setView(null)}
        title={`Guest Insights (AI) · ${guest.name}`}
        items={guest.insights}
        searchText={(s) => s}
        renderItem={(r) => (
          <div key={r} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, padding: '8px 0' }}>
            <Icon name="auto_awesome" size={18} color="var(--gold)" />
            {r}
          </div>
        )}
      />

      {dialogs}
    </div>
  );
}
