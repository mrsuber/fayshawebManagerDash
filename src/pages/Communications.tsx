import { useState } from 'react';
import { Avatar, Card, Chip, Icon, Placeholder, QuickActions } from '../components/ui';

// Mock data — replace with API calls.
const TH: [string, string, string, string, string][] = [
  ['Abba Abdouraman', 'Your package has arrived at the…', '18:13', 'chat', 'In House'],
  ['Sophie Laurent', 'Thank you! The massage was…', '16:42', 'mail', 'In House'],
  ['James & Anna', 'Can we book the sunset yacht…', '15:20', 'chat', 'In House'],
  ['Michael Chen', 'Dinner reservation confirmed.', '14:35', 'chat', 'In House'],
  ['Elena Petrova', 'Is the gym open now?', '11:22', 'chat', 'In House'],
  ['David Kim', 'Airport transfer details please.', '09:18', 'mail', 'Arriving'],
  ['Grace N.', 'Thank you for the wonderful…', 'Yesterday', 'smartphone', 'Checked Out'],
  ['Carlos Mendez', 'Could you arrange groceries…', 'Yesterday', 'mail', 'In House'],
  ['Linda E.', 'What time is the spa available?', 'Yesterday', 'smartphone', 'In House'],
  ['Marie T.', 'Can I have extra towels?', 'Yesterday', 'chat', 'In House'],
];
const SC: Record<string, string> = { 'In House': '#e8b84a', Arriving: '#e8b84a', 'Checked Out': '#9fb1e6' };
const CH = ['All Channels:forum', 'In-App:smartphone', 'WhatsApp:chat', 'Email:mail', 'SMS:sms', 'Phone:call', 'Staff Notes:sticky_note_2'];
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

type Msg = { me: boolean; from: string; text: string; time: string };
const INITIAL: Msg[] = [
  { me: false, from: 'Abba Abdouraman', text: 'Hi FAY, has my grocery delivery arrived?', time: '18:10' },
  { me: true, from: 'FAY AI Concierge', text: 'Yes, your grocery delivery has arrived and is securely stored at the FAY Smart Locker Hub.\n\nLocker 07 is ready for your collection. Open it with your Faysha app, NFC card, or the QR code at the locker.', time: '18:12 ✓✓' },
  { me: true, from: 'Package Ready for Collection', text: 'Locker 07 · 1 package · Delivered at 18:12', time: '18:12 ✓✓' },
  { me: false, from: 'Abba Abdouraman', text: 'Perfect, thank you!', time: '18:13' },
];

export default function Communications() {
  const [sel, setSel] = useState(0);
  const [ch, setCh] = useState(0);
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>(INITIAL);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs((m) => [...m, { me: true, from: 'FAY AI Concierge', text: t, time: 'now' }]);
    setDraft('');
  };
  const active = TH[sel][0];

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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13, color: 'var(--dim)' }}>
              <Icon name="search" size={18} />
              Search guests, messages…
            </div>
            <div style={{ padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 13 }}>Recent ▾</div>
          </div>
          {TH.map(([name, last, time, chan, s], i) => (
            <div
              key={name}
              className="hov-row"
              onClick={() => setSel(i)}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0,1fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: 8,
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${i === sel ? 'var(--gold)' : 'transparent'}`,
                background: i === sel ? 'rgba(232,184,74,.1)' : 'transparent',
              }}
            >
              <Avatar size={44} stripe={4} />
              <div className="col" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last}</span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Icon name={chan} size={15} color={chan === 'chat' ? '#3fd283' : '#cfc8ba'} />
                  {time}
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
              <span key={i} className="icon" style={{ width: 42, height: 42, border: '1px solid var(--border-strong)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}>
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
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 12 }}>Today, Nov 28, 2025</span>
            {msgs.map((m, i) => (
              <div
                key={i}
                className="col"
                style={{
                  maxWidth: '72%',
                  gap: 4,
                  padding: '12px 16px',
                  borderRadius: 10,
                  fontSize: 15,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-line',
                  alignSelf: m.me ? 'flex-end' : 'flex-start',
                  background: m.me ? 'rgba(232,184,74,.08)' : 'var(--surface-3)',
                  border: `1px solid ${m.me ? 'rgba(232,184,74,.35)' : 'rgba(255,255,255,.06)'}`,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--gold)' }}>{m.from}</span>
                {m.text}
                <span style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'flex-end' }}>{m.time}</span>
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 8px 8px 14px' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={`Type a message to ${active}…`}
                style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14 }}
              />
              <Icon name="attach_file" size={20} color="var(--muted)" />
              <div onClick={send} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 6, background: 'var(--gold)', color: 'var(--on-gold)', fontWeight: 500, cursor: 'pointer' }}>
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
                <span onClick={() => setDraft(t)} style={{ padding: '5px 14px', borderRadius: 4, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 12, cursor: 'pointer' }}>
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
