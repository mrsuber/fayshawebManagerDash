import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { conversationsApi, guestsApi, serviceRequestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Avatar, Card, Chip, Icon, Placeholder, QuickActions } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useGuestOptions from '../hooks/useGuestOptions';
import useSocketEvent from '../hooks/useSocketEvent';
import { BookingRow, RequestRow, ServiceRow, TimelineRow } from './guest360/cards';
import useGuestActions from './guest360/GuestActions';
import { BOOKING_TYPES, CHANNELS, fmtDate, nights, statusColors } from './guest360/format';

const SC = { 'In House': '#e8b84a', Arriving: '#e8b84a', Upcoming: '#c9a8ff', 'Checked Out': '#9fb1e6' };
/** Channel filter chips as label:icon:apiValue. */
const CH = ['All Channels:forum:', 'In-App:smartphone:in_app', 'WhatsApp:chat:whatsapp', 'Email:mail:email', 'SMS:sms:sms', 'Phone:call:phone', 'Staff Notes:sticky_note_2:note'];
const CHANNEL_ICON = { in_app: 'smartphone', whatsapp: 'chat', email: 'mail', sms: 'sms', phone: 'call', note: 'sticky_note_2' };
const RANGES = [
  ['All time', null],
  ['Today', 0],
  ['Last 2 days', 1],
  ['Last 7 days', 6],
];
const STAY_FILTERS = ['All guests', 'In House', 'Arriving', 'Checked Out'];
const timeLabel = (iso) => (iso ? moment(iso).format('HH:mm') : '');
/** Conversation list: time today, "Yesterday", else the date. */
const dayLabel = (iso) => {
  if (!iso) return '';
  const m = moment(iso);
  return m.isSame(moment(), 'day') ? m.format('HH:mm') : m.isSame(moment().subtract(1, 'day'), 'day') ? 'Yesterday' : m.format('MMM D');
};
const dayHeading = (iso) => {
  const m = moment(iso);
  return m.isSame(moment(), 'day') ? `Today, ${m.format('MMM D, YYYY')}` : m.isSame(moment().subtract(1, 'day'), 'day') ? `Yesterday, ${m.format('MMM D, YYYY')}` : m.format('dddd, MMM D, YYYY');
};
const iconBox = {
  width: 42,
  height: 42,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 22,
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text)',
};
const empty = (t) => <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{t}</div>;

export default function Communications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { options: guestOptions } = useGuestOptions();
  const [params] = useSearchParams();

  // ---- thread list: channel, search, date range, stay filter, sort ----
  const [ch, setCh] = useState(0);
  const channel = CH[ch].split(':')[2];
  const [q, setQ] = useState('');
  const [range, setRange] = useState(0);
  const [stay, setStay] = useState(0);
  const [sortAZ, setSortAZ] = useState(false);
  const [filterMenu, setFilterMenu] = useState(null);
  const threads = useApi(() => conversationsApi.list(channel ? { channel } : undefined), [channel], []);
  const query = q.trim().toLowerCase();
  const [, days] = RANGES[range];
  const list = (threads.data || [])
    .filter((c) => !query || `${c.guestName} ${c.lastMessage || ''}`.toLowerCase().includes(query))
    .filter((c) => days == null || moment(c.lastAt).isSameOrAfter(moment().startOf('day').subtract(days, 'days')))
    .filter((c) => stay === 0 || c.stayStatus === STAY_FILTERS[stay])
    .sort((a, b) => (sortAZ ? a.guestName.localeCompare(b.guestName) : a.lastAt < b.lastAt ? 1 : -1));

  // ?conversation=<id> (e.g. from Guest 360 → Open in Communications) preselects a thread.
  const [selId, setSelId] = useState(() => Number(params.get('conversation')) || null);
  const current = list.find((c) => c.id === selId) || list[0];
  const guestId = current?.guestId;

  // ---- open conversation + its guest ----
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((r) => r + 1), []);
  const thread = useApi(() => (current ? conversationsApi.messages(current.id) : Promise.resolve([])), [current?.id], []);
  const msgs = thread.data || [];
  const profile = useApi(() => (guestId ? guestsApi.get(guestId) : Promise.resolve(null)), [guestId, rev]);
  const guest = profile.data?.id === guestId ? profile.data : null;
  const requests = useApi(() => (guestId ? serviceRequestsApi.list({ guestId }) : Promise.resolve([])), [guestId, rev], []);
  const bookings = useApi(() => (guestId ? guestsApi.bookings(guestId) : Promise.resolve([])), [guestId, rev], []);
  const timeline = useApi(() => (guestId ? guestsApi.timeline(guestId) : Promise.resolve([])), [guestId, rev], []);
  const notes = useApi(() => (guestId ? guestsApi.notes(guestId) : Promise.resolve([])), [guestId, rev], []);
  const { actions, dialogs } = useGuestActions(guest, refresh);

  const [tab, setTab] = useState('Conversation');
  const [mode, setMode] = useState('Reply');
  const [draft, setDraft] = useState('');
  const [more, setMore] = useState(null);
  const [bookMenu, setBookMenu] = useState(null);
  const [newMessage, setNewMessage] = useState(false);
  const [lockerOpen, setLockerOpen] = useState(false);
  const fileInput = useRef(null);
  const scroller = useRef(null);

  useEffect(() => setDraft(''), [current?.id]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [msgs.length, tab]);

  const appendMessage = (m) => {
    thread.setData((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    threads.setData((l) => l.map((c) => (c.id === m.conversationId ? { ...c, lastMessage: m.body, lastAt: m.createdAt, lastAtLabel: undefined } : c)));
  };

  // Live updates: append to the open thread, bump the conversation's preview.
  useSocketEvent('message:new', (m) => {
    if (m.conversationId === current?.id) thread.setData((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    threads.setData((l) => l.map((c) => (c.id === m.conversationId ? { ...c, lastMessage: m.body, lastAt: m.createdAt } : c)));
  });

  const sendText = (text) =>
    conversationsApi
      .send(current.id, text)
      .then(appendMessage)
      .catch((e) => {
        toast(e.message, 'error');
        throw e;
      });

  const submit = () => {
    const t = draft.trim();
    if (!t || !current) return;
    setDraft('');
    if (mode === 'Internal Note') {
      guestsApi
        .addNote(guestId, t)
        .then(() => {
          toast('Internal note saved');
          refresh();
        })
        .catch((e) => {
          setDraft(t);
          toast(e.message, 'error');
        });
      return;
    }
    sendText(t).catch(() => setDraft(t));
  };

  const attach = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && current) sendText(`📎 ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`).then(() => toast('Attachment sent'));
  };

  const replyTab = (l) => {
    if (l === 'Reply' || l === 'Internal Note') setMode(l);
    else if (l === 'Create Request') actions.open('request');
  };

  const active = current?.guestName ?? '';
  const ctabs = [
    ['Conversation', 'Conversation'],
    ['Guest Context', 'Guest Context'],
    ['Service Requests', `Service Requests (${requests.data.filter((r) => r.status !== 'Completed').length})`],
    ['Bookings', `Bookings (${bookings.data.filter((b) => new Date(b.endsAt) > new Date() && b.status !== 'Cancelled').length})`],
    ['Journey', 'Journey'],
    ['Notes', `Notes (${notes.data.length})`],
  ];
  const quick = guest
    ? [
        { icon: 'assignment_add', c: '#5b8ff0', l: 'Create Request', onClick: () => actions.open('request') },
        { icon: 'spa', c: '#9b7bf0', l: 'Book Wellness', onClick: () => actions.open('booking', { type: 'wellness' }) },
        { icon: 'restaurant', c: '#e8b84a', l: 'Book Dining', onClick: () => actions.open('booking', { type: 'dining' }) },
        { icon: 'sailing', c: '#4fc3f7', l: 'Book Experience', onClick: () => actions.open('booking', { type: 'experience' }) },
        { icon: 'directions_car', c: '#e6e0d4', l: 'Arrange Transport', onClick: () => actions.open('booking', { type: 'transport' }) },
        { icon: 'more_horiz', c: '#e6e0d4', l: 'More', onClick: (e) => setMore(e?.currentTarget || document.body) },
      ]
    : [];
  const first = guest?.name.split(' ')[0] || '';
  const suggestions = [
    `Hi ${first}, your package is ready at the Smart Locker — open it with the Faysha app or the QR code.`,
    `Hi ${first}, may I suggest a FAY Thermal Recovery session tomorrow morning? I can book it for you.`,
    `Good evening ${first}, would you like a table at Riviera tonight? Sunset seating is at 7:30 PM.`,
  ];

  let lastDay = null;
  const conversationView = (
    <>
      {msgs.length === 0 && empty('No messages yet.')}
      {msgs.map((m) => {
        const d = moment(m.createdAt).format('YYYY-MM-DD');
        const heading = d !== lastDay;
        lastDay = d;
        return (
          <div key={m.id} className="col" style={{ gap: 14 }}>
            {heading && (
              <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 12 }}>{dayHeading(m.createdAt)}</span>
            )}
            <div
              className="col"
              style={{
                maxWidth: '72%',
                gap: 4,
                padding: '12px 16px',
                borderRadius: 10,
                fontSize: 15,
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
                {timeLabel(m.createdAt)}
                {m.fromStaff ? ' ✓✓' : ''}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );

  const tabView = () => {
    if (!guest) return empty('Loading guest…');
    switch (tab) {
      case 'Guest Context':
        return (
          <div className="col" style={{ gap: 4 }}>
            {guest.preferences.map((p) => (
              <div key={p.key} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <Icon name={p.icon} size={22} color={p.color} />
                <div className="col">
                  <span style={{ fontSize: 14 }}>{p.title}</span>
                  <span className="sub">{p.detail}</span>
                </div>
              </div>
            ))}
            <span style={{ fontSize: 13, color: 'var(--dim)', marginTop: 10 }}>FAY insights</span>
            {guest.insights.map((t) => (
              <span key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <Icon name="auto_awesome" size={16} color="var(--gold)" />
                {t}
              </span>
            ))}
          </div>
        );
      case 'Service Requests':
        return (
          <div className="col">
            {requests.data.length ? requests.data.map((r) => <RequestRow key={r.id} r={r} onComplete={(x) => serviceRequestsApi.update(x.id, { status: 'Completed' }).then(refresh)} />) : empty('No requests.')}
            <button type="button" className="card-link" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => actions.open('request')}>
              + New request
            </button>
          </div>
        );
      case 'Bookings':
        return (
          <div className="col">
            {bookings.data.length ? bookings.data.map((b) => <BookingRow key={b.id} b={b} />) : empty('No bookings.')}
            <button type="button" className="card-link" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={(e) => setBookMenu(e.currentTarget)}>
              + New booking
            </button>
          </div>
        );
      case 'Journey':
        return <div className="col">{timeline.data.length ? timeline.data.map(TimelineRow) : empty('No activity yet.')}</div>;
      case 'Notes':
        return (
          <div className="col">
            {notes.data.length
              ? notes.data.map((n) => (
                  <div key={n.id} className="row-line" style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
                    <Icon name="sticky_note_2" size={20} color="var(--gold)" />
                    <div className="col">
                      <span style={{ fontSize: 14 }}>{n.body}</span>
                      <span className="sub">
                        {n.author} · {fmtDate(n.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              : empty('No notes. Switch the composer to “Internal Note” to add one.')}
          </div>
        );
      default:
        return conversationView;
    }
  };

  const services = guest?.services || [];

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CH.map((c, i) => {
          const [label, icon] = c.split(':');
          return (
            <Chip key={label} on={i === ch} onClick={() => setCh(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 14 }}>
              <Icon name={icon} size={18} />
              {label}
            </Chip>
          );
        })}
        <div style={{ flex: 1 }} />
        <button type="button" className="btn-outline" style={{ padding: '9px 14px', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }} onClick={() => setRange((r) => (r + 1) % RANGES.length)} title="Click to change range">
          <Icon name="calendar_month" size={18} />
          {RANGES[range][0]}
        </button>
        <button
          type="button"
          className="btn-outline"
          style={{ padding: '9px 14px', background: 'transparent', color: stay ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
          onClick={(e) => setFilterMenu(e.currentTarget)}
        >
          <Icon name="filter_list" size={18} />
          {stay ? STAY_FILTERS[stay] : 'Filters'}
        </button>
        <button type="button" className="btn-gold" style={{ padding: '9px 18px', fontSize: 14, border: 0, fontFamily: 'var(--sans)' }} onClick={() => setNewMessage(true)}>
          <Icon name="add" size={18} />
          New Message
        </button>
      </div>
      <Menu anchorEl={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)}>
        {STAY_FILTERS.map((f, i) => (
          <MenuItem
            key={f}
            selected={i === stay}
            onClick={() => {
              setStay(i);
              setFilterMenu(null);
            }}
          >
            {f}
          </MenuItem>
        ))}
      </Menu>

      <div className="grid-cols">
        <section className="card" style={{ padding: 10, gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13, color: 'var(--dim)' }}>
              <Icon name="search" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guests, messages…"
                aria-label="Search conversations"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)' }}
              />
            </label>
            <button
              type="button"
              onClick={() => setSortAZ((v) => !v)}
              style={{ padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13, background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              {sortAZ ? 'A–Z ▾' : 'Recent ▾'}
            </button>
          </div>
          {list.length === 0 && empty('No conversations match.')}
          {list.map(({ id, guestName: name, lastMessage: last, lastAt, lastAtLabel, channel: chan, stayStatus: s }) => (
            <div
              key={id}
              className="hov-row"
              onClick={() => {
                setSelId(id);
                setTab('Conversation');
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0,1fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: 8,
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${id === current?.id ? 'var(--gold)' : 'transparent'}`,
                background: id === current?.id ? 'rgba(232,184,74,.1)' : 'transparent',
              }}
            >
              <Avatar size={44} stripe={4} />
              <div className="col" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last}</span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Icon name={CHANNEL_ICON[chan] || 'forum'} size={15} color={chan === 'whatsapp' ? '#3fd283' : '#cfc8ba'} />
                  {lastAtLabel || dayLabel(lastAt)}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: SC[s], color: 'var(--on-gold)' }}>{s}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="card" style={{ padding: 0, minHeight: 760 }}>
          {!current ? (
            empty('Select a conversation or start a new message.')
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <Avatar size={64} stripe={5} />
                <div className="col" style={{ flex: 1, gap: 2 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>
                      {active}
                    </span>
                    {guest?.vip && <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '1px 8px', borderRadius: 3, fontSize: 12 }}>VIP</span>}
                  </div>
                  {guest && (
                    <span style={{ fontSize: 14, color: 'var(--text-3)' }}>
                      {guest.collection} · {guest.residence} · {moment(guest.checkIn).format('MMM D')} – {moment(guest.checkOut).format('MMM D')}
                    </span>
                  )}
                </div>
                <button type="button" className="icon" style={iconBox} title="Call" onClick={() => toast(`Calling ${guest?.contact.phone || active}…`, 'info')}>
                  call
                </button>
                <button type="button" className="icon" style={iconBox} title="Video call" onClick={() => toast(`Starting a video call with ${active}…`, 'info')}>
                  videocam
                </button>
                <button type="button" className="icon" style={iconBox} title="More" onClick={(e) => setMore(e.currentTarget)}>
                  more_vert
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                {ctabs.map(([key, label]) => (
                  <Chip key={key} on={key === tab} onClick={() => setTab(key)} style={{ padding: '7px 14px', fontSize: 13, borderRadius: 5 }}>
                    {label}
                  </Chip>
                ))}
              </div>
              <div ref={scroller} className="col" style={{ flex: 1, gap: 14, padding: 16, overflow: 'auto', maxHeight: 560 }}>
                {tabView()}
              </div>
              <div className="col" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', gap: 10 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['Reply', 'Internal Note', 'Create Request'].map((l) => (
                    <Chip key={l} on={l === mode} onClick={() => replyTab(l)} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5 }}>
                      {l}
                    </Chip>
                  ))}
                  <Chip on={false} onClick={(e) => setBookMenu(e.currentTarget)} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5 }}>
                    Book Service
                  </Chip>
                  <Chip on={false} onClick={(e) => setMore(e.currentTarget)} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5 }}>
                    More Actions
                  </Chip>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    border: `1px solid ${mode === 'Internal Note' ? 'rgba(232,184,74,.5)' : 'rgba(255,255,255,.1)'}`,
                    background: mode === 'Internal Note' ? 'rgba(232,184,74,.05)' : 'transparent',
                    borderRadius: 8,
                    padding: '8px 8px 8px 14px',
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder={mode === 'Internal Note' ? `Internal note about ${active} (staff only)…` : `Type a message to ${active}…`}
                    style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14, fontFamily: 'var(--sans)' }}
                  />
                  <input ref={fileInput} type="file" hidden onChange={attach} />
                  <button type="button" className="icon" title="Attach a file" onClick={() => fileInput.current?.click()} style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>
                    attach_file
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 18px',
                      borderRadius: 6,
                      background: 'var(--gold)',
                      color: 'var(--on-gold)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: 0,
                      fontFamily: 'var(--sans)',
                      fontSize: 14,
                    }}
                  >
                    {mode === 'Internal Note' ? 'Save Note' : 'Send'}
                    <Icon name={mode === 'Internal Note' ? 'sticky_note_2' : 'send'} size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="stack">
          {guest && (
            <Card title={guest.status === 'In House' ? 'Current Stay' : 'Stay'} link="View Details ›" onLink={() => navigate(`/guest360?guest=${guest.id}`)} gap={8}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <Placeholder label="residence" style={{ height: 80, borderRadius: 6, padding: 6 }} />
                <div className="col" style={{ fontSize: 14, gap: 2 }}>
                  <span className="serif" style={{ fontSize: 20 }}>
                    {guest.residence}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>{guest.collection}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    {guest.status} ({nights(guest)} nights)
                  </span>
                </div>
              </div>
            </Card>
          )}
          <Card title="Smart Locker & Services" link="View All ›" onLink={() => setLockerOpen(true)} gap={6}>
            {services.slice(0, 4).map((r) => {
              const [bg] = statusColors(r.status);
              return (
                <div key={r.key} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                  <Icon name={r.icon} size={24} color={r.color} />
                  <div className="col" style={{ flex: 1 }}>
                    <span style={{ fontSize: 14 }}>{r.title}</span>
                    <span className="sub">{r.detail}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: bg }}>{r.status}</span>
                </div>
              );
            })}
          </Card>
          <Card title="Quick Actions">
            <QuickActions items={quick} variant="border" iconSize={24} />
          </Card>
          <Card title="AI Suggested Replies" gap={8}>
            {suggestions.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{t}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('Reply');
                    setTab('Conversation');
                    setDraft(t);
                  }}
                  style={{ padding: '5px 14px', borderRadius: 4, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 12, cursor: 'pointer', border: 0, fontFamily: 'var(--sans)' }}
                >
                  Use
                </button>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Menu anchorEl={bookMenu} open={!!bookMenu} onClose={() => setBookMenu(null)} onClick={() => setBookMenu(null)}>
        {Object.entries(BOOKING_TYPES).map(([type, t]) => (
          <MenuItem key={type} onClick={() => actions.open('booking', { type })}>
            <ListItemIcon>
              <Icon name={t.icon} size={20} color={t.color} />
            </ListItemIcon>
            Book {t.label}
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={more} open={!!more} onClose={() => setMore(null)} onClick={() => setMore(null)}>
        <MenuItem onClick={() => guest && navigate(`/guest360?guest=${guest.id}`)}>
          <ListItemIcon>
            <Icon name="person" size={20} />
          </ListItemIcon>
          Open Guest 360
        </MenuItem>
        <MenuItem onClick={() => guest && navigate(`/journey?guest=${guest.id}`)}>
          <ListItemIcon>
            <Icon name="route" size={20} />
          </ListItemIcon>
          Open Guest Journey
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => actions.open('message', { channel: current?.channel })}>
          <ListItemIcon>
            <Icon name="swap_horiz" size={20} />
          </ListItemIcon>
          Send via another channel
        </MenuItem>
        <MenuItem onClick={() => actions.open('note')}>
          <ListItemIcon>
            <Icon name="sticky_note_2" size={20} />
          </ListItemIcon>
          Add Staff Note
        </MenuItem>
        <MenuItem onClick={() => actions.open('preferences')}>
          <ListItemIcon>
            <Icon name="manage_accounts" size={20} />
          </ListItemIcon>
          Edit Preferences
        </MenuItem>
      </Menu>

      <ViewAllDialog
        open={lockerOpen}
        onClose={() => setLockerOpen(false)}
        title={`Smart Locker & Services · ${active}`}
        items={services}
        searchText={(s) => `${s.title} ${s.detail}`}
        renderItem={ServiceRow}
      />
      <FormDialog
        open={newMessage}
        title="New Message"
        submitLabel="Send"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'channel', label: 'Channel', type: 'select', options: CHANNELS },
          { name: 'body', label: 'Message', type: 'textarea', rows: 4, required: true },
        ]}
        initial={{ guestId: guestOptions[0]?.[0] || '', channel: 'whatsapp' }}
        onSubmit={({ guestId: gid, channel: chan, body }) =>
          guestsApi.sendMessage(gid, { channel: chan, body }).then((m) => {
            toast('Message sent');
            setCh(0);
            setQ('');
            setRange(0);
            setStay(0);
            threads.reload();
            setSelId(m.conversationId);
            setTab('Conversation');
          })
        }
        onClose={() => setNewMessage(false)}
      />
      {dialogs}
    </div>
  );
}
