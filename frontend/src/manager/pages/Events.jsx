import moment from 'moment';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventsApi } from '../api';
import { Ago, Composer, Empty, Facts, ListRow, Pill, SearchBox, SplitView, Tabs, TextInput, Thread, Toolbar } from '../components/kit';
import { Icon, KpiGrid } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import useNav from '../hooks/useNav';
import useSocketEvent from '../hooks/useSocketEvent';
import { currencyCode, money, moneyShort } from './guest360/format';

export const STATUS = {
  new: ['New', '#e8b84a'],
  assessing: ['Assessing', '#5b8ff0'],
  quoted: ['Quoted', '#9b7bf0'],
  accepted: ['Accepted', '#4fc3f7'],
  confirmed: ['Confirmed', '#3fd283'],
  completed: ['Completed', '#8f897d'],
  declined: ['Declined', '#d94040'],
  cancelled: ['Cancelled', '#d94040'],
  lost: ['Lost', '#8f897d'],
};
const MOVE_LABEL = { assessing: 'Back to assessing', quoted: 'Back to quoted', accepted: 'Mark accepted', confirmed: 'Confirm', completed: 'Mark completed', declined: 'Declined', cancelled: 'Cancel event', lost: 'Mark lost', new: 'Back to new' };
const SPACE = { garden: 'Gardens', pool_deck: 'Pool deck', restaurant: 'Restaurant', sky_deck: 'Sky deck', lounge: 'Lounge', wellness_club: 'Wellness club', whole_estate: 'Whole estate' };
const SERVICE = { decor: 'Decor', flowers: 'Flowers', sound: 'Sound / DJ', lighting: 'Lighting', photo: 'Photography', video: 'Video', cake: 'Cake', officiant: 'Officiant', transport: 'Transport', security: 'Security', wellness: 'Spa for the party', kids: 'Children’s corner', accommodation: 'Rooms for guests' };
const CATERING = { faysha: 'Faysha restaurant', external: 'Own caterer', none: 'No catering' };

/** Common lines, so a proposal is quick to build. Prices are typed per event. */
const PRESETS = [
  ['Venue hire', 'event', 1],
  ['Catering', 'guest', 'guests'],
  ['Welcome drinks', 'guest', 'guests'],
  ['Decor & flowers', 'event', 1],
  ['Sound, DJ & lighting', 'event', 1],
  ['Photography', 'event', 1],
  ['Event coordination', 'event', 1],
  ['Residences for guests', 'night', 'rooms'],
  ['Spa for the party', 'person', 1],
  ['Security', 'event', 1],
  ['Transport', 'trip', 1],
];

export default function Events() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const selectedId = params.get('id') ? Number(params.get('id')) : null;
  const select = (id) => setParams(id ? { id: String(id) } : {});
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listQ = useApi(() => eventsApi.list({ status: tab === 'all' ? undefined : tab, q: debounced || undefined }), [tab, debounced], { items: [], counts: {}, pipeline: [] });
  const detailQ = useApi(() => (selectedId ? eventsApi.get(selectedId) : Promise.resolve(null)), [selectedId], null);
  const cur = detailQ.data;
  const apply = (e) => {
    if (!e) return;
    detailQ.setData((d) => (d && d.id === e.id ? e : d));
    listQ.reload();
  };
  useEffect(() => {
    if (cur && cur.status === 'new') eventsApi.update(cur.id, {}).then(apply).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);
  useSocketEvent('event:created', () => listQ.reload());
  useSocketEvent('event:updated', (p) => {
    listQ.reload();
    if (p?.id === selectedId) detailQ.reload();
  });

  const counts = listQ.data?.counts || {};
  const open = ['new', 'assessing', 'quoted', 'accepted'].reduce((s, k) => s + (counts[k] || 0), 0);
  const pipeline = (listQ.data?.pipeline || []).map((p) => moneyShort(p.total, p.currency)).join(' + ') || moneyShort(0);
  const kpis = [
    { icon: 'fiber_new', c: '#e8b84a', n: counts.new || 0, l: 'New requests' },
    { icon: 'pending_actions', c: '#5b8ff0', n: open, l: 'Open' },
    { icon: 'request_quote', c: '#9b7bf0', n: counts.quoted || 0, l: 'Awaiting the client' },
    { icon: 'handshake', c: '#4fc3f7', n: counts.accepted || 0, l: 'Deposit to collect' },
    { icon: 'event_available', c: '#3fd283', n: counts.confirmed || 0, l: 'Confirmed' },
    { icon: 'payments', c: '#e8b84a', n: pipeline, l: 'Pipeline value' },
  ];

  const list = (
    <>
      {listQ.data.items.length === 0 && !listQ.loading ? <Empty icon="celebration" title="No event requests here">Requests from the website and the app arrive here.</Empty> : null}
      {listQ.data.items.map((e) => (
        <ListRow
          key={e.id}
          active={e.id === selectedId}
          unread={e.status === 'new'}
          onClick={() => select(e.id)}
          title={`${e.typeLabel} · ${e.name}`}
          meta={`${e.eventDate ? moment(e.eventDate).format('ddd D MMM YYYY') : 'Flexible dates'} · ${e.guests} guests${e.quoteTotal ? ` · ${money(e.quoteTotal, e.quoteCurrency)}` : ''}`}
          aside={
            <>
              <Ago at={e.createdAt} />
              <Pill tone={STATUS[e.status][1]}>{STATUS[e.status][0]}</Pill>
            </>
          }
        />
      ))}
    </>
  );

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={160} />
      <Toolbar right={<SearchBox value={q} onChange={setQ} placeholder="Search name, reference…" style={{ width: 280, maxWidth: '100%' }} />}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            ['open', 'Open', open],
            ['upcoming', 'Confirmed', counts.confirmed || 0],
            ['closed', 'Closed', (counts.completed || 0) + (counts.declined || 0) + (counts.cancelled || 0) + (counts.lost || 0)],
            ['all', 'All'],
          ]}
        />
      </Toolbar>
      <SplitView
        list={list}
        hasSelection={!!selectedId}
        onBack={() => select(null)}
        detail={cur ? <EventDetail ev={cur} apply={apply} toast={toast} /> : <Empty icon="celebration" title="Select a request">Assess the brief, build a proposal, send it, and follow it to the day.</Empty>}
      />
    </div>
  );
}

function EventDetail({ ev, apply, toast }) {
  const navigate = useNav();
  const team = useCollection('team');
  const [building, setBuilding] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const act = (p, message) =>
    p
      .then((e) => {
        apply(e);
        if (message) toast(message);
      })
      .catch((e) => toast(e.message, 'error'));
  const draft = ev.quotes.find((x) => x.status === 'draft');
  const live = ev.quotes.find((x) => ['sent', 'accepted'].includes(x.status));
  const accepted = ev.quotes.find((x) => x.status === 'accepted');

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="col" style={{ flex: 1, minWidth: 220, gap: 6 }}>
          <span className="kit-label">
            {ev.reference} · from the {ev.source} · <Ago at={ev.createdAt} />
          </span>
          <h2 className="kit-h">{ev.title || `${ev.typeLabel} for ${ev.guests}`}</h2>
        </div>
        <Pill tone={STATUS[ev.status][1]}>{STATUS[ev.status][0]}</Pill>
      </div>

      <Facts
        items={[
          ['Client', ev.organisation ? `${ev.name} · ${ev.organisation}` : ev.name],
          ['Email', <a href={`mailto:${ev.email}`}>{ev.email}</a>],
          ['Phone', ev.phone ? <a href={`tel:${ev.phone.replace(/\s/g, '')}`}>{ev.phone}</a> : null],
          ['Date', ev.eventDate ? `${moment(ev.eventDate).format('ddd D MMM YYYY')}${ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}` : ''}` : 'Flexible'],
          ['Alternative date', ev.altDate ? moment(ev.altDate).format('D MMM YYYY') : null],
          ['Guests', ev.guests],
          ['Spaces', ev.spaces.map((s) => SPACE[s] || s).join(', ') || 'No preference'],
          ['Catering', `${CATERING[ev.catering] || ev.catering}${ev.cateringStyle ? ` · ${ev.cateringStyle}` : ''}`],
          ['Rooms for guests', ev.roomsNeeded || null],
          ['Budget', ev.budgetMin || ev.budgetMax ? `${ev.budgetMin ? money(ev.budgetMin, ev.currency) : '…'} – ${ev.budgetMax ? money(ev.budgetMax, ev.currency) : '…'}` : 'Not given'],
          ['Services', ev.services.map((s) => SERVICE[s] || s).join(', ') || null],
          ['Dietary needs', ev.dietary],
          ['Deposit received', ev.depositPaid ? money(ev.depositPaid, accepted?.currency || ev.currency) : null],
          ['Account', ev.guestId ? <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${ev.guestId}`)}>Open Guest 360</button> : null],
        ]}
      />
      {ev.message ? <div className="kit-message">{ev.message}</div> : null}

      <div className="kit-actions">
        <select className="kit-select" value={ev.assignedTo || ''} onChange={(e) => act(eventsApi.update(ev.id, { assignedTo: e.target.value ? Number(e.target.value) : null }), 'Assignment updated')} aria-label="Event lead">
          <option value="">No event lead</option>
          {team.items.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {!draft && !['completed', 'cancelled'].includes(ev.status) ? (
          <button type="button" className="btn-gold" onClick={() => setBuilding(live ? { ...live, id: null } : { items: [], currency: ev.currency, depositPercent: 30, taxRate: 0, discount: 0, notes: '' })}>
            <Icon name="request_quote" size={18} /> {live ? 'New version of the proposal' : 'Build a proposal'}
          </button>
        ) : null}
        {ev.status === 'accepted' || (ev.status === 'confirmed' && accepted && ev.depositPaid < accepted.total) ? (
          <button type="button" className="btn-gold" onClick={() => setDepositOpen((o) => !o)}>
            <Icon name="payments" size={18} /> Record a payment
          </button>
        ) : null}
        {ev.moves
          .filter((m) => !['quoted', 'confirmed'].includes(m))
          .map((m) => (
            <button
              key={m}
              type="button"
              className="fay-btn-outline"
              onClick={() => {
                const reason = ['declined', 'cancelled', 'lost'].includes(m) ? window.prompt('Reason (kept on file)') : '';
                if (reason === null) return;
                act(eventsApi.update(ev.id, { status: m, reason }), `${STATUS[m][0]}`);
              }}
            >
              {MOVE_LABEL[m]}
            </button>
          ))}
        {ev.status === 'completed' ? (
          <button type="button" className="fay-btn-outline" onClick={() => eventsApi.story(ev.id).then(() => navigate('/content?section=stories')).catch((e) => toast(e.message, 'error'))}>
            <Icon name="auto_stories" size={18} /> {ev.storyId ? 'Open the story' : 'Write the story'}
          </button>
        ) : null}
      </div>

      {depositOpen ? <DepositForm ev={ev} quote={accepted} onDone={(e) => { apply(e); setDepositOpen(false); toast('Payment recorded'); }} toast={toast} /> : null}

      {building || draft ? (
        <QuoteBuilder
          ev={ev}
          quote={building || draft}
          onClose={() => setBuilding(null)}
          onSaved={(e, message) => {
            apply(e);
            setBuilding(null);
            toast(message);
          }}
          toast={toast}
        />
      ) : null}

      {ev.quotes.filter((x) => x.status !== 'draft').map((x) => (
        <QuoteSummary key={x.id} quote={x} />
      ))}

      <Thread items={ev.thread} />
      <Composer
        placeholder={`Write to ${ev.name.split(' ')[0]} by email, or leave an internal note…`}
        actions={[
          { label: 'Internal note', icon: 'sticky_note_2', onSend: (body) => eventsApi.note(ev.id, body).then(apply) },
          { label: 'Email client', icon: 'send', primary: true, onSend: (body) => eventsApi.reply(ev.id, body).then((e) => { apply(e); toast(`Sent to ${ev.email}`); }) },
        ]}
      />
    </>
  );
}

function QuoteSummary({ quote: q }) {
  const tone = { sent: '#9b7bf0', accepted: '#3fd283', declined: '#d94040', superseded: '#8f897d', expired: '#8f897d' }[q.status] || '#8f897d';
  return (
    <div className="card" style={{ background: 'var(--surface-2)', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="serif" style={{ fontSize: 20, flex: 1 }}>Proposal v{q.version} · {money(q.total, q.currency)}</span>
        <Pill tone={tone}>{q.status}</Pill>
      </div>
      <span className="sub">
        Sent {q.sentAt ? moment(q.sentAt).format('D MMM, HH:mm') : '—'}
        {q.viewedAt ? ` · opened ${moment(q.viewedAt).fromNow()}` : ' · not opened yet'}
        {q.respondedAt ? ` · ${q.status} ${moment(q.respondedAt).fromNow()}${q.responseName ? ` by ${q.responseName}` : ''}` : ''}
        {q.validUntil ? ` · valid until ${moment(q.validUntil).format('D MMM')}` : ''}
      </span>
      {q.responseNote ? <div className="kit-message" style={{ fontSize: 14 }}>“{q.responseNote}”</div> : null}
      {q.link && q.status === 'sent' ? (
        <button type="button" className="card-link" style={{ alignSelf: 'flex-start' }} onClick={() => navigator.clipboard?.writeText(q.link)}>
          Copy the client’s link
        </button>
      ) : null}
    </div>
  );
}

function QuoteBuilder({ ev, quote, onClose, onSaved, toast }) {
  const [v, setV] = useState({
    currency: quote.currency || ev.currency || currencyCode(),
    items: quote.items?.length ? quote.items.map((it) => ({ ...it })) : [{ label: 'Venue hire', detail: '', qty: 1, unit: 'event', unitPrice: 0 }],
    discount: quote.discount || 0,
    taxRate: quote.taxRate || 0,
    depositPercent: quote.depositPercent ?? 30,
    validUntil: quote.validUntil || moment().add(14, 'days').format('YYYY-MM-DD'),
    notes: quote.notes || '',
  });
  const [busy, setBusy] = useState('');
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));
  const setItem = (i, k, val) => setV((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: val } : it)) }));
  const subtotal = v.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const disc = Math.min(subtotal, Number(v.discount) || 0);
  const tax = ((subtotal - disc) * (Number(v.taxRate) || 0)) / 100;
  const total = subtotal - disc + tax;
  const deposit = (total * (Number(v.depositPercent) || 0)) / 100;

  const addPreset = (label) => {
    const p = PRESETS.find(([l]) => l === label);
    if (!p) return;
    const qty = p[2] === 'guests' ? ev.guests : p[2] === 'rooms' ? ev.roomsNeeded || 1 : 1;
    setV((x) => ({ ...x, items: [...x.items, { label: p[0], detail: '', qty, unit: p[1], unitPrice: 0 }] }));
  };
  const save = async (andSend) => {
    setBusy(andSend ? 'send' : 'save');
    try {
      let e = quote.id ? await eventsApi.updateQuote(ev.id, quote.id, v) : await eventsApi.createQuote(ev.id, v);
      if (andSend) {
        const qid = quote.id || e.quotes.find((x) => x.status === 'draft')?.id;
        e = await eventsApi.sendQuote(ev.id, qid);
      }
      onSaved(e, andSend ? `Proposal sent to ${ev.email}` : 'Draft saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="card" style={{ gap: 14, borderColor: 'rgba(232,184,74,.45)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="card-title" style={{ flex: 1 }}>{quote.id ? `Proposal v${quote.version} (draft)` : 'New proposal'}</span>
        <select className="kit-select" value="" onChange={(e) => addPreset(e.target.value)} aria-label="Add a common line">
          <option value="">+ Add a common line…</option>
          {PRESETS.map(([l]) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <input className="kit-select" style={{ width: 80 }} value={v.currency} onChange={(e) => set('currency')(e.target.value.toUpperCase().slice(0, 3))} aria-label="Currency" />
      </div>
      <div className="kit-scroll">
        <table className="kit-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit price</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {v.items.map((it, i) => (
              <tr key={i}>
                <td>
                  <input className="kit-input" value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="Item" />
                  <input className="kit-input" style={{ marginTop: 6, fontSize: 12.5 }} value={it.detail || ''} onChange={(e) => setItem(i, 'detail', e.target.value)} placeholder="Detail shown to the client (optional)" />
                </td>
                <td><input className="kit-input" type="number" min="0" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} style={{ width: 80 }} /></td>
                <td><input className="kit-input" value={it.unit || ''} onChange={(e) => setItem(i, 'unit', e.target.value)} style={{ width: 90 }} /></td>
                <td><input className="kit-input" type="number" min="0" value={it.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0), v.currency)}</td>
                <td>
                  <button type="button" className="fay-btn-outline" onClick={() => setV((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} aria-label="Remove line">
                    <Icon name="close" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="card-link" style={{ alignSelf: 'flex-start' }} onClick={() => setV((x) => ({ ...x, items: [...x.items, { label: '', detail: '', qty: 1, unit: '', unitPrice: 0 }] }))}>
        + Add a line
      </button>
      <div className="kit-two">
        <TextInput label={`Discount (${v.currency})`} type="number" value={v.discount} onChange={set('discount')} />
        <TextInput label="Tax (%)" type="number" value={v.taxRate} onChange={set('taxRate')} hint="e.g. 19.25 for VAT in Cameroon, if it applies" />
        <TextInput label="Deposit to confirm (%)" type="number" value={v.depositPercent} onChange={set('depositPercent')} />
        <TextInput label="Valid until" type="date" value={v.validUntil} onChange={set('validUntil')} />
      </div>
      <TextInput label="Included, conditions and payment terms (shown to the client)" multiline rows={4} value={v.notes} onChange={set('notes')} placeholder="Includes tables, chairs, linen and service staff until midnight. Balance due 14 days before the event." />
      <Facts
        items={[
          ['Subtotal', money(subtotal, v.currency)],
          ['Discount', disc ? `− ${money(disc, v.currency)}` : null],
          ['Tax', tax ? money(tax, v.currency) : null],
          ['Total', <strong style={{ color: 'var(--gold)' }}>{money(total, v.currency)}</strong>],
          ['Deposit', money(deposit, v.currency)],
          ['Per guest', money(total / Math.max(1, ev.guests), v.currency)],
        ]}
      />
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        {!quote.id ? <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button> : null}
        <button type="button" className="fay-btn-outline" disabled={!!busy} onClick={() => save(false)}>
          <Icon name="save" size={18} /> {busy === 'save' ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" className="btn-gold" disabled={!!busy || !total} onClick={() => window.confirm(`Send this proposal (${money(total, v.currency)}) to ${ev.email}?`) && save(true)}>
          <Icon name="send" size={18} /> {busy === 'send' ? 'Sending…' : 'Send to client'}
        </button>
      </div>
    </div>
  );
}

function DepositForm({ ev, quote, onDone, toast }) {
  const due = quote ? Math.max(0, (ev.depositPaid ? quote.total : quote.depositAmount) - ev.depositPaid) : 0;
  const [v, setV] = useState({ amount: due || '', method: 'mobile_money', reference: '' });
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" style={{ gap: 12, background: 'var(--surface-2)' }}>
      <span className="card-title">Payment received</span>
      <span className="sub">
        {quote ? `Deposit ${money(quote.depositAmount, quote.currency)} of ${money(quote.total, quote.currency)}. Already received: ${money(ev.depositPaid, quote.currency)}.` : ''} Recording the first payment confirms the date.
      </span>
      <div className="kit-two">
        <TextInput label={`Amount (${quote?.currency || ev.currency})`} type="number" value={v.amount} onChange={(a) => setV({ ...v, amount: a })} />
        <label className="kit-field">
          <span className="kit-label">Method</span>
          <select className="kit-select" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            <option value="mobile_money">Mobile money</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </select>
        </label>
        <TextInput label="Reference" value={v.reference} onChange={(r) => setV({ ...v, reference: r })} />
      </div>
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn-gold"
          disabled={busy || !(Number(v.amount) > 0)}
          onClick={() => {
            setBusy(true);
            eventsApi.deposit(ev.id, v).then(onDone).catch((e) => toast(e.message, 'error')).finally(() => setBusy(false));
          }}
        >
          <Icon name="check" size={18} /> Record
        </button>
      </div>
    </div>
  );
}
