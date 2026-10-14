import moment from 'moment';
import { useState } from 'react';
import { guestsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Card, Chip, Icon, KpiGrid, Placeholder, Toggle } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useCollection from '../hooks/useCollection';
import useGuestOptions from '../hooks/useGuestOptions';
import { money } from './guest360/format';

const CATS = ['All', 'Water', 'Outdoor', 'Cultural', 'Culinary', 'Sport', 'Wellness', 'Family'];
const SC = { Confirmed: '#7c4ddb', Pending: '#2f6fe8', Completed: '#1f9d55', Cancelled: '#5c2b2b' };
/** Suggestions pair a guest with an experience they are likely to enjoy (from their preferences / conversations). */
const SUGGEST = [
  { guestId: 1, experience: 'Private Golf Experience', d: 'Listed golf in preferences, nothing booked yet' },
  { guestId: 3, experience: 'Sunset Yacht Experience', d: 'Asked about yacht availability via WhatsApp' },
  { guestId: 5, experience: 'Sunrise Beach Yoga', d: 'Booked 2 wellness sessions this stay' },
  { guestId: 2, experience: 'Private Chef Experience', d: 'Loves fine dining · celebrates on day 3' },
];

export default function Experiences() {
  const toast = useToast();
  const { options: guestOptions, byId } = useGuestOptions();
  const catalog = useCollection('experiences');
  const bookings = useCollection('experienceBookings');
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [viewAll, setViewAll] = useState(null);

  const query = q.trim().toLowerCase();
  const items = catalog.items.filter((e) => (cat === 0 || e.category === CATS[cat]) && (!query || `${e.name} ${e.description}`.toLowerCase().includes(query)));
  const now = new Date().toISOString();
  const sorted = [...bookings.items].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const upcoming = sorted.filter((b) => b.startsAt >= now && b.status !== 'Cancelled');
  const in7 = moment().add(7, 'days').toISOString();
  const live = bookings.items.filter((b) => b.status !== 'Cancelled');
  const rated = 9.7;
  const kpis = [
    { icon: 'sailing', c: '#4fc3f7', n: String(live.filter((b) => moment(b.startsAt).isSame(moment(), 'day')).length), l: 'Bookings Today' },
    { icon: 'groups', c: '#3fd283', n: String(upcoming.reduce((s, b) => s + Number(b.pax), 0)), l: 'Upcoming Participants' },
    { icon: 'payments', c: '#e8b84a', n: money(live.reduce((s, b) => s + Number(b.total || 0), 0)), l: 'Experience Revenue' },
    { icon: 'star', c: '#e8b84a', n: String(rated), l: 'Avg Rating' },
    { icon: 'event_upcoming', c: '#9b7bf0', n: String(upcoming.filter((b) => b.startsAt <= in7).length), l: 'Upcoming (7 days)' },
  ];

  const openBooking = (experience, guestId) =>
    setForm({ experience: experience?.name || catalog.items[0]?.name, guestId: guestId || guestOptions[0]?.[0] || '', startsAt: moment().add(1, 'day').format('YYYY-MM-DDT10:00'), pax: 2 });
  const book = (v) => {
    const e = catalog.items.find((x) => x.name === v.experience);
    if (Number(v.pax) > e.capacity) return Promise.reject(new Error(`${e.name} takes up to ${e.capacity} guests`));
    return bookings.create(
      { startsAt: new Date(v.startsAt).toISOString(), experience: e.name, guestId: Number(v.guestId), pax: Number(v.pax), status: 'Confirmed', total: e.price * (e.price >= 600 ? 1 : Number(v.pax)) },
      `${e.name} booked for ${byId[v.guestId]?.name}`,
    );
  };
  const offer = (s) => {
    const g = byId[s.guestId];
    if (!g) return;
    guestsApi
      .sendMessage(g.id, { channel: 'whatsapp', body: `Hi ${g.name.split(' ')[0]}, we've held a spot on the ${s.experience} for you. Would you like me to confirm it?` })
      .then(() => toast(`Offer sent to ${g.name}`))
      .catch((e) => toast(e.message, 'error'));
  };

  const bookingRow = (b) => (
    <div key={b.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 60px auto 30px', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 13, opacity: b.status === 'Cancelled' ? 0.5 : 1 }}>
      <span style={{ color: 'var(--text-3)' }}>{moment(b.startsAt).format('MMM D, h:mm A')}</span>
      <span>{b.experience}</span>
      <span style={{ color: 'var(--text-3)' }}>{b.guestName}</span>
      <span style={{ color: 'var(--muted)' }}>{b.pax} pax</span>
      <button
        type="button"
        title={b.status === 'Pending' ? 'Confirm' : ''}
        onClick={() => b.status === 'Pending' && bookings.update(b.id, { status: 'Confirmed' }, `${b.experience} confirmed`)}
        style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: SC[b.status], border: 0, color: 'var(--text)', cursor: b.status === 'Pending' ? 'pointer' : 'default', fontFamily: 'var(--sans)' }}
      >
        {b.status}
      </button>
      {['Confirmed', 'Pending'].includes(b.status) && b.startsAt >= now ? (
        <button type="button" className="mini-btn" title="Cancel" aria-label="Cancel" onClick={() => bookings.update(b.id, { status: 'Cancelled' }, `${b.experience} cancelled`)}>
          <Icon name="close" size={14} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
  const tile = (e) => (
    <div key={e.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: e.active ? 1 : 0.55 }}>
      <Placeholder stripe={10} style={{ height: 150, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="mono-label">{e.img}</span>
        <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(10,12,15,.8)', border: '1px solid rgba(232,184,74,.5)' }}>{e.category}</span>
      </Placeholder>
      <div className="col" style={{ padding: 14, gap: 6, flex: 1 }}>
        <span className="card-title">{e.name}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{e.description}</span>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)', alignItems: 'center' }}>
          <span>{e.duration}</span>
          <span>Up to {e.capacity}</span>
          <span style={{ flex: 1 }} />
          <span className="sub">{live.filter((b) => b.experience === e.name && b.startsAt >= now).length} booked</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
          <span className="serif" style={{ fontSize: 20 }}>
            {money(e.price)}
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Toggle size="sm" on={e.active} label={`${e.name} on sale`} onClick={() => catalog.update(e.id, { active: !e.active }, `${e.name} ${e.active ? 'paused' : 'on sale'}`)} />
            <button
              type="button"
              disabled={!e.active}
              onClick={() => openBooking(e)}
              style={{ padding: '7px 16px', borderRadius: 5, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 13, cursor: e.active ? 'pointer' : 'default', border: 0, fontFamily: 'var(--sans)', opacity: e.active ? 1 : 0.5 }}
            >
              Book
            </button>
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn-outline" onClick={() => setForm({ kind: 'experience' })}>
          <Icon name="add_circle" size={18} />
          New Experience
        </button>
        <button type="button" className="btn-gold" onClick={() => openBooking()}>
          <Icon name="add" size={18} />
          Book Experience
        </button>
      </div>

      <KpiGrid items={kpis} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATS.map((l, i) => (
          <Chip key={l} on={i === cat} onClick={() => setCat(i)} style={{ padding: '9px 16px', fontSize: 14 }}>
            {l}
          </Chip>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search experiences…"
          aria-label="Search experiences"
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, outline: 0 }}
        />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>{items.map(tile)}</section>

      <div className="grid-cols">
        <Card title={`Upcoming Bookings (${upcoming.length})`} link="View All ›" onLink={() => setViewAll('bookings')} gap={4} headGap={6}>
          {upcoming.length ? upcoming.slice(0, 6).map(bookingRow) : <span className="sub">Nothing booked.</span>}
        </Card>

        <Card title="FAY Suggests" link="View All ›" onLink={() => setViewAll('suggest')} gap={8}>
          {SUGGEST.slice(0, 3).map((s) => (
            <div key={s.experience + s.guestId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <Icon name="auto_awesome" size={20} color="var(--gold)" />
              <div className="col" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontSize: 14 }}>
                  {byId[s.guestId]?.name || '…'} — {s.experience}
                </span>
                <span className="sub">{s.d}</span>
              </div>
              <button type="button" onClick={() => offer(s)} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(232,184,74,.5)', fontSize: 12, cursor: 'pointer', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
                Offer
              </button>
              <button type="button" className="mini-btn" title="Book now" aria-label="Book now" onClick={() => openBooking(catalog.items.find((e) => e.name === s.experience), s.guestId)}>
                <Icon name="add" size={16} />
              </button>
            </div>
          ))}
        </Card>
      </div>

      <ViewAllDialog
        open={viewAll === 'bookings'}
        onClose={() => setViewAll(null)}
        title="Experience Bookings"
        items={sorted}
        searchText={(b) => `${b.experience} ${b.guestName}`}
        filters={{ options: ['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled'], get: (b) => b.status }}
        renderItem={bookingRow}
        action={
          <button type="button" className="btn-gold" style={{ fontSize: 14 }} onClick={() => openBooking()}>
            <Icon name="add" size={18} />
            Book Experience
          </button>
        }
      />
      <ViewAllDialog
        open={viewAll === 'suggest'}
        onClose={() => setViewAll(null)}
        title="FAY Suggests"
        items={SUGGEST}
        renderItem={(s) => (
          <div key={s.experience + s.guestId} className="row-line" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0' }}>
            <Icon name="auto_awesome" size={20} color="var(--gold)" />
            <div className="col" style={{ flex: 1 }}>
              <span style={{ fontSize: 14 }}>
                {byId[s.guestId]?.name} — {s.experience}
              </span>
              <span className="sub">{s.d}</span>
            </div>
            <button type="button" className="btn-outline" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => offer(s)}>
              Offer
            </button>
          </div>
        )}
      />

      <FormDialog
        open={!!form && form.kind !== 'experience'}
        title="Book Experience"
        submitLabel="Book"
        fields={[
          { name: 'experience', label: 'Experience', type: 'select', options: catalog.items.filter((e) => e.active).map((e) => [e.name, `${e.name} · ${money(e.price)}`]) },
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions, required: true },
          { name: 'startsAt', label: 'Date & time', type: 'datetime', required: true },
          { name: 'pax', label: 'Participants', type: 'number', required: true },
        ]}
        initial={form || {}}
        onSubmit={book}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form?.kind === 'experience'}
        title="New Experience"
        submitLabel="Add to Catalogue"
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'category', label: 'Category', type: 'select', options: CATS.slice(1) },
          { name: 'description', label: 'Description', type: 'textarea', rows: 2, required: true },
          { name: 'duration', label: 'Duration', type: 'select', options: ['1 h', '2 h', '2.5 h', '3 h', '4 h', '5 h', 'Full day'] },
          { name: 'capacity', label: 'Max guests', type: 'number', required: true },
          { name: 'price', label: 'Price (USD)', type: 'number', required: true },
        ]}
        initial={{ category: 'Outdoor', duration: '2 h', capacity: 6 }}
        onSubmit={(v) => catalog.create({ ...v, img: v.name.toLowerCase(), capacity: Number(v.capacity), price: Number(v.price), active: true }, `${v.name} added`)}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
