import moment from 'moment';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { conversationsApi } from '../api';
import { Avatar, Card, Chip, Icon, Placeholder, QuickActions } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';

// Presentational config; conversations and messages come from the API (see docs/API.md).

const SC = { 'In House': '#e8b84a', Arriving: '#e8b84a', 'Checked Out': '#9fb1e6' };
/** Channel filter chips as label:icon:apiValue. */
const CH = ['All Channels:forum:', 'In-App:smartphone:in_app', 'WhatsApp:chat:whatsapp', 'Email:mail:email', 'SMS:sms:sms', 'Phone:call:phone', 'Staff Notes:sticky_note_2:note'];
const CHANNEL_ICON = { in_app: 'smartphone', whatsapp: 'chat', email: 'mail', sms: 'sms', phone: 'call', note: 'sticky_note_2' };
const CTABS = ['Conversation', 'Guest Context', 'Service Requests (3)', 'Bookings (4)', 'Journey', 'Notes'];
const REPLY_TABS = ['Reply', 'Internal Note', 'Create Request', 'Book Service', 'More Actions'];
const LOCKER = [
  { icon: 'deployed_code', c: '#4fc3f7', t: 'Locker 07', d: '1 package ready for collection', s: 'Ready', sc: '#1f9d55' },
  { icon: 'local_laundry_service', c: '#9b7bf0', t: 'Laundry', d: '2 items in processing', s: 'In Progress', sc: '#2f6fe8' },
  { icon: 'local_shipping', c: '#e8b84a', t: 'Deliveries', d: '1 completed today', s: 'Completed', sc: '#3a3f48' },
  { icon: 'autorenew', c: '#3fd283', t: 'Return Items', d: 'No active returns', s: '—', sc: 'transparent' },
];
const QUICK = [
  { icon: 'assignment_add', c: '#5b8ff0', l: 'Create Request' },
  { icon: 'spa', c: '#9b7bf0', l: 'Book Wellness' },
  { icon: 'restaurant', c: '#e8b84a', l: 'Book Dining' },
  { icon: 'sailing', c: '#4fc3f7', l: 'Book Experience' },
  { icon: 'directions_car', c: '#e6e0d4', l: 'Arrange Transport' },
  { icon: 'more_horiz', c: '#e6e0d4', l: 'More' },
];
const SUGGEST = ['Confirm locker collection instructions', 'Suggest a wellness experience for tomorrow', 'Recommend dinner at Riviera this evening'];
const timeLabel = (iso) => (iso ? moment(iso).format('HH:mm') : '');
/** Conversation list: time today, "Yesterday", else the date. */
const dayLabel = (iso) => {
  if (!iso) return '';
  const m = moment(iso);
  return m.isSame(moment(), 'day') ? m.format('HH:mm') : m.isSame(moment().subtract(1, 'day'), 'day') ? 'Yesterday' : m.format('MMM D');
};

export default function Communications() {
  const toast = useToast();
  const [ch, setCh] = useState(0);
  const channel = CH[ch].split(':')[2];
  const threads = useApi(() => conversationsApi.list(channel ? { channel } : undefined), [channel], []);
  const list = threads.data || [];
  // ?conversation=<id> (e.g. from Guest 360 → Open in Communications) preselects a thread.
  const [params] = useSearchParams();
  const [selId, setSelId] = useState(() => Number(params.get('conversation')) || null);
  const current = list.find((c) => c.id === selId) || list[0];
  const [draft, setDraft] = useState('');
  const thread = useApi(() => (current ? conversationsApi.messages(current.id) : Promise.resolve([])), [current?.id], []);
  const msgs = thread.data || [];

  useEffect(() => setDraft(''), [current?.id]);

  // Live updates: append to the open thread, bump the conversation's preview.
  useSocketEvent('message:new', (m) => {
    if (m.conversationId === current?.id) thread.setData((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    threads.setData((list) => list.map((c) => (c.id === m.conversationId ? { ...c, lastMessage: m.body, lastAt: m.createdAt } : c)));
  });

  const send = () => {
    const t = draft.trim();
    if (!t || !current) return;
    setDraft('');
    conversationsApi
      .send(current.id, t)
      .then((m) => thread.setData((list) => (list.some((x) => x.id === m.id) ? list : [...list, m])))
      .catch((e) => {
        setDraft(t);
        toast(e.message, 'error');
      });
  };
  const active = current?.guestName ?? '';
  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CH.map((c, i) => {
          const [label, icon] = c.split(':');
          return (
            <Chip
              key={label}
              on={i === ch}
              onClick={() => setCh(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 14 }}
            >
              <Icon name={icon} size={18} />
              {label}
            </Chip>
          );
        })}
        <div style={{ flex: 1 }} />
        <div className="btn-outline" style={{ padding: '9px 14px' }}>
          <Icon name="calendar_month" size={18} />
          Nov 28 – Nov 30, 2025
        </div>
        <div className="btn-outline" style={{ padding: '9px 14px' }}>
          <Icon name="filter_list" size={18} />
          Filters
        </div>
        <div className="btn-gold" style={{ padding: '9px 18px', fontSize: 14 }}>
          <Icon name="add" size={18} />
          New Message
        </div>
      </div>

      <div className="grid-cols">
        <section className="card" style={{ padding: 10, gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div
              style={{
                flex: 1,
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
              Search guests, messages…
            </div>
            <div style={{ padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13 }}>Recent ▾</div>
          </div>
          {list.map(({ id, guestName: name, lastMessage: last, lastAt, lastAtLabel, channel: chan, stayStatus: s }) => (
            <div
              key={id}
              className="hov-row"
              onClick={() => setSelId(id)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Avatar size={64} stripe={5} />
            <div className="col" style={{ flex: 1, gap: 2 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>
                  {active}
                </span>
                <span style={{ background: 'var(--gold)', color: 'var(--on-gold)', padding: '1px 8px', borderRadius: 3, fontSize: 12 }}>VIP</span>
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Serenity Collection · Residence 1 · Nov 28 – Nov 30</span>
            </div>
            {['call', 'videocam', 'more_vert'].map((i) => (
              <span
                key={i}
                className="icon"
                style={{
                  width: 42,
                  height: 42,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                {i}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
            {CTABS.map((l, i) => (
              <Chip key={l} on={i === 0} style={{ padding: '7px 14px', fontSize: 13, borderRadius: 5, cursor: 'default' }}>
                {l}
              </Chip>
            ))}
          </div>
          <div className="col" style={{ flex: 1, gap: 14, padding: 16, overflow: 'auto' }}>
            <span
              style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 12 }}
            >
              Today, Nov 28, 2025
            </span>
            {msgs.map((m) => (
              <div
                key={m.id}
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
            ))}
          </div>
          <div className="col" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {REPLY_TABS.map((l, i) => (
                <Chip key={l} on={i === 0} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5, cursor: 'default' }}>
                  {l}
                </Chip>
              ))}
            </div>
            <div
              style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 8px 8px 14px' }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={`Type a message to ${active}…`}
                style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14 }}
              />
              <Icon name="attach_file" size={20} color="var(--muted)" />
              <div
                onClick={send}
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
                }}
              >
                Send
                <Icon name="send" size={18} />
              </div>
            </div>
          </div>
        </section>

        <div className="stack">
          <Card title="Current Stay" link="View Details ›" gap={8} aside={undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
              <Placeholder label="residence" style={{ height: 80, borderRadius: 6, padding: 6 }} />
              <div className="col" style={{ fontSize: 14, gap: 2 }}>
                <span className="serif" style={{ fontSize: 20 }}>
                  Serenity 1
                </span>
                <span style={{ color: 'var(--muted)' }}>Serenity Collection</span>
                <span style={{ color: 'var(--muted)' }}>In House (2 nights)</span>
              </div>
            </div>
          </Card>
          <Card title="Smart Locker & Services" link="View All ›" gap={6}>
            {LOCKER.map((r) => (
              <div key={r.t} className="row-line" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
                <Icon name={r.icon} size={24} color={r.c} />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 14 }}>{r.t}</span>
                  <span className="sub">{r.d}</span>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: r.sc }}>{r.s}</span>
              </div>
            ))}
          </Card>
          <Card title="Quick Actions">
            <QuickActions items={QUICK} variant="border" iconSize={24} />
          </Card>
          <Card title="AI Suggested Replies" gap={8}>
            {SUGGEST.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{t}</span>
                <span
                  onClick={() => setDraft(t)}
                  style={{ padding: '5px 14px', borderRadius: 4, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 12, cursor: 'pointer' }}
                >
                  Use
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
