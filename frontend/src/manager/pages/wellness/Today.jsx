import moment from 'moment';
import { useMemo, useState } from 'react';
import { opsApi } from '../../api';
import FormDialog from '../../components/FormDialog';
import { Empty, Pill } from '../../components/kit';
import { Icon, KpiGrid } from '../../components/ui';
import { mediaUrl } from '../../config';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useGuestOptions from '../../hooks/useGuestOptions';
import useNav from '../../hooks/useNav';
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

/** A photo tile: the uploaded picture, or a calm gradient while there is none. */
function Photo({ src, height, children, onClick, active }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        position: 'relative',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
        background: src ? `center / cover no-repeat url("${mediaUrl(src)}")` : 'linear-gradient(135deg, #1c2a24, #12161d)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.82))' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>{children}</div>
    </div>
  );
}

/**
 * Wellness today: the places (HQ → Wellness catalogue → Zones) and experiences (Activities) with their photos, today's
 * schedule and what is coming, from the real bookings. Every booking keeps its code and its history in the guest's journey.
 */
export default function WellnessToday({ openTab }) {
  const toast = useToast();
  const navigate = useNav();
  const today = useApi(() => opsApi.wellnessBookings('today'), [], { items: [], counts: {} });
  const open = useApi(() => opsApi.wellnessBookings('open'), [], { items: [], counts: {} });
  const zones = useApi(opsApi.wellnessZones, [], []);
  const catalog = useApi(opsApi.wellnessCatalog, [], []);
  const { options: guestOptions } = useGuestOptions();
  const [form, setForm] = useState(null);
  const reload = () => {
    today.reload();
    open.reload();
  };
  useSocketEvent('wellness:updated', reload);

  const todayStr = moment().format('YYYY-MM-DD');
  const todays = (today.data?.items || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  const upcoming = (open.data?.items || []).filter((b) => b.date > todayStr && b.status !== 'requested');
  const counts = open.data?.counts || {};
  const experiences = (catalog.data || []).filter((a) => a.active !== false);

  const byDay = useMemo(() => {
    const m = new Map();
    upcoming.forEach((b) => m.set(b.date, [...(m.get(b.date) || []), b]));
    return [...m.entries()].slice(0, 7);
  }, [upcoming]);

  const act = (p, message) =>
    p
      .then(() => {
        reload();
        toast(message);
      })
      .catch((e) => toast(e.message, 'error'));

  const kpis = [
    { icon: 'pending_actions', c: '#e8b84a', n: counts.requested || 0, l: 'Requests to confirm', dc: counts.requested ? '#e8b84a' : undefined },
    { icon: 'event_note', c: '#5b8ff0', n: todays.filter((b) => !['cancelled', 'declined'].includes(b.status)).length, l: 'Booked today' },
    { icon: 'how_to_reg', c: '#3fd283', n: todays.filter((b) => b.checkedInAt).length, l: 'Arrived today' },
    { icon: 'verified', c: '#3fd283', n: todays.filter((b) => b.status === 'completed').length, l: 'Completed today' },
    { icon: 'person_off', c: '#ff6b6b', n: todays.filter((b) => b.status === 'no_show').length, l: 'No-shows today' },
    { icon: 'calendar_month', c: '#9b7bf0', n: upcoming.length, l: 'Coming up' },
  ];

  const imageOf = (activityId) => experiences.find((a) => a.id === activityId)?.image;

  const row = (b, future) => (
    <div key={b.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '58px 46px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.35 }}>
        {b.start}
        <span className="sub" style={{ display: 'block' }}>{b.end}</span>
      </span>
      <div style={{ width: 46, height: 46, borderRadius: 8, background: imageOf(b.activityId) ? `center / cover url("${mediaUrl(imageOf(b.activityId))}")` : 'linear-gradient(135deg, #1c2a24, #12161d)' }} />
      <div className="col" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14.5 }}>{b.activity}{b.people > 1 ? ` · ${b.people} people` : ''}</span>
        <span className="sub">
          <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${b.guestId}`)}>{b.guest}</button>
          {b.residence ? ` · ${b.residence}` : ''} · <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}>{b.code}</span>
          {b.checkedInAt ? ` · arrived ${moment(b.checkedInAt).format('HH:mm')}` : ''}
          {b.rating ? <span style={{ color: b.rating <= 2 ? 'var(--red-soft)' : 'var(--gold)' }}>{` · ${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}`}</span> : null}
        </span>
      </div>
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        <Pill tone={STATUS[b.status]?.[1]}>{STATUS[b.status]?.[0] || b.status}</Pill>
        {b.status === 'requested' ? <button type="button" className="fay-btn-outline" onClick={() => openTab('bookings')}>Answer</button> : null}
        {b.status === 'upcoming' && !future ? <button type="button" className="btn-gold" onClick={() => act(opsApi.wellnessAction(b.id, 'check-in'), `${b.guest} checked in`)}>Arrived</button> : null}
        {b.status === 'in_progress' ? <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.wellnessAction(b.id, 'complete'), 'Completed')}>Completed</button> : null}
        {b.status === 'upcoming' && !future ? <button type="button" className="fay-btn-outline" onClick={() => window.confirm(`Mark ${b.guest} as no-show?`) && act(opsApi.wellnessAction(b.id, 'no-show'), 'Marked as no-show')}>No-show</button> : null}
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        <a className="fay-btn-outline" href="/admin/wellness/availability" target="_blank" rel="noreferrer"><Icon name="event_available" size={18} /> Open times</a>
        <button type="button" className="btn-gold" onClick={() => setForm({ date: todayStr, start: '10:00', people: 1, activityId: experiences[0]?.id || '', guestId: guestOptions[0]?.[0] || '' })}>
          <Icon name="add" size={18} /> New booking
        </button>
      </div>

      {(zones.data || []).length ? (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {zones.data.map((z) => (
            <Photo key={z.id} src={z.image} height={170}>
              <div className="serif" style={{ fontSize: 22, color: '#fff' }}>{z.name}</div>
              {z.subtitle ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>{z.subtitle}</div> : null}
            </Photo>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty icon="photo_library" title="Add your wellness places">Create the places (thermal suite, wellness club, spa, float…) with a photo in HQ → Wellness catalogue → Zones; they appear here.</Empty>
        </section>
      )}

      <KpiGrid items={kpis} min={170} />

      <div className="grid-cols" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        <section className="card" style={{ gap: 4 }}>
          <span className="card-title">Today · {moment().format('dddd D MMMM')}</span>
          {todays.length === 0 && !today.loading ? <span className="sub" style={{ padding: '12px 0' }}>No wellness bookings today.</span> : null}
          {todays.map((b) => row(b, false))}
        </section>
        <section className="card" style={{ gap: 4 }}>
          <span className="card-title">Coming up</span>
          {byDay.length === 0 && !open.loading ? <span className="sub" style={{ padding: '12px 0' }}>Nothing confirmed for the coming days yet.</span> : null}
          {byDay.map(([d, items]) => (
            <div key={d}>
              <div className="sub" style={{ marginTop: 10, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>{moment(d).format('dddd D MMMM')}</div>
              {items.map((b) => row(b, true))}
            </div>
          ))}
          {counts.requested ? (
            <button type="button" className="fay-btn-outline" style={{ marginTop: 12 }} onClick={() => openTab('bookings')}>
              {counts.requested} request{counts.requested > 1 ? 's' : ''} to confirm →
            </button>
          ) : null}
        </section>
      </div>

      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="card-title" style={{ flex: 1 }}>Experiences</span>
          <button type="button" className="card-link" onClick={() => openTab('catalogue')}>Edit the catalogue ›</button>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {experiences.map((a) => (
            <Photo key={a.id} src={a.image} height={130} onClick={() => setForm({ date: todayStr, start: '10:00', people: 1, activityId: a.id, guestId: guestOptions[0]?.[0] || '' })}>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>{a.displayName || a.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
                {a.category} · {a.duration} min{a.type === 'journey' ? ' · journey' : ''}{a.accessMode === 'pin' ? ' · PIN' : ''}
              </div>
            </Photo>
          ))}
        </div>
      </section>

      <FormDialog
        open={!!form}
        title="New wellness booking"
        submitLabel="Book and confirm"
        fields={[
          { name: 'guestId', label: 'Guest', type: 'select', options: guestOptions },
          { name: 'activityId', label: 'Experience', type: 'select', options: experiences.map((a) => [a.id, `${a.displayName || a.name} · ${a.duration} min`]) },
          { name: 'date', label: 'Day', type: 'date' },
          { name: 'start', label: 'Time', type: 'time' },
          { name: 'people', label: 'People', type: 'number' },
          { name: 'notes', label: 'Notes for the team', type: 'textarea', rows: 2 },
        ]}
        initial={form || {}}
        onSubmit={(v) =>
          opsApi.createWellnessBooking({ ...v, guestId: Number(v.guestId), activityId: Number(v.activityId), people: Number(v.people) || 1 }).then((b) => {
            reload();
            toast(`Booked · code ${b.code} — the guest is notified`);
          })
        }
        onClose={() => setForm(null)}
      />
    </div>
  );
}
