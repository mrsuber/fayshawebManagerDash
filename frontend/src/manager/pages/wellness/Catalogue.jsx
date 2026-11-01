import { useState } from 'react';
import { contentApi, opsApi } from '../../api';
import { Empty, ImageField, Pill, Tabs, TextInput, Toolbar } from '../../components/kit';
import { Icon, Toggle } from '../../components/ui';
import { mediaUrl } from '../../config';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { money } from '../guest360/format';

const MOODS = [['restore', 'Restore'], ['recharge', 'Recharge'], ['reflect', 'Reflect'], ['explore', 'Explore'], ['fitness', 'Fitness'], ['spa', 'Spa'], ['dining', 'Dining'], ['other', 'Other']];
const WHERE = [['indoor', 'Indoors (a floor of the club)'], ['outdoor', 'Outdoors (golf, pool, gardens)'], ['residence', 'In the guest’s residence'], ['offsite', 'Off the estate']];
const ACCESS = [['none', 'Open — no code'], ['pin', 'PIN code (sent with the booking)'], ['qr', 'QR code at the door'], ['staff', 'Escorted by the team']];
const LOANS = [['', 'Nothing'], ['golf', 'Golf clubs & balls'], ['sport', 'Sport equipment'], ['beach', 'Pool & beach kit'], ['kids', 'For children'], ['locker', 'A locker'], ['other', 'Other']];
const blank = { name: '', category: 'restore', description: '', image: null, gallery: [], duration: 60, price: 0, maxCapacity: 1, requiresBooking: true, requiresStaff: false, accessMode: 'none', locationKind: 'indoor', location: '', floor: '', openingHours: '', bookAheadHours: 0, equipmentCategory: '', benefits: [], active: true, stages: [] };
const label = (list, v) => list.find(([k]) => k === v)?.[1] || v;

/** Every wellness experience the app offers: single services and multi-stage journeys, with photos, place and access. */
export default function Catalogue() {
  const toast = useToast();
  const q = useApi(opsApi.wellnessCatalog, [], []);
  const [mood, setMood] = useState('');
  const [editing, setEditing] = useState(null);
  const list = (q.data || []).filter((a) => !mood || a.category === mood);

  if (editing) {
    return (
      <Editor
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={(a, message) => {
          q.reload();
          setEditing(a);
          toast(message);
        }}
        onDeleted={(message) => {
          q.reload();
          setEditing(null);
          toast(message);
        }}
      />
    );
  }
  return (
    <div className="stack">
      <Toolbar right={<button type="button" className="btn-gold" onClick={() => setEditing(blank)}><Icon name="add" size={18} /> Add an experience</button>}>
        <Tabs value={mood} onChange={setMood} options={[['', 'All', (q.data || []).length], ...MOODS.map(([k, l]) => [k, l, (q.data || []).filter((a) => a.category === k).length || undefined])]} />
      </Toolbar>
      {list.length === 0 && !q.loading ? <Empty icon="spa" title="Nothing here yet">Add a treatment, a class, the golf range or a multi-stage journey.</Empty> : null}
      <div className="kit-cards">
        {list.map((a) => (
          <button key={a.id} type="button" className="kit-card" onClick={() => setEditing(a)} style={{ opacity: a.active ? 1 : 0.55 }}>
            <div className="kit-card__img">
              {a.image ? <img src={mediaUrl(a.image)} alt="" loading="lazy" /> : null}
              <div className="kit-card__badges">
                <Pill tone={a.active ? '#3fd283' : '#8f897d'} solid>{a.active ? label(MOODS, a.category) : 'Hidden'}</Pill>
                {a.stages.length ? <Pill tone="#e8b84a" solid>{a.stages.length} stages</Pill> : null}
              </div>
            </div>
            <div className="kit-card__body">
              <span className="serif" style={{ fontSize: 21 }}>{a.displayName || a.name}</span>
              <span className="sub">
                {a.duration} min · {a.price ? money(a.price, a.currency) : 'Included'} · {label(WHERE, a.locationKind).split(' (')[0]}
                {a.floor ? `, floor ${a.floor}` : ''}
                {a.accessMode !== 'none' ? ` · ${a.accessMode.toUpperCase()}` : ''}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ item, onClose, onSaved, onDeleted }) {
  const [v, setV] = useState({ ...blank, ...item, equipmentCategory: item.equipmentCategory || '', stages: (item.stages || []).map((s) => ({ ...s })) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));
  const setStage = (i, k, val) => setV((x) => ({ ...x, stages: x.stages.map((s, j) => (j === i ? { ...s, [k]: val } : s)) }));
  const moveStage = (i, d) =>
    setV((x) => {
      const st = [...x.stages];
      const [s] = st.splice(i, 1);
      st.splice(i + d, 0, s);
      return { ...x, stages: st };
    });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { ...v, equipmentCategory: v.equipmentCategory || null };
      const saved = item.id ? await opsApi.updateWellness(item.id, body) : await opsApi.createWellness(body);
      onSaved(saved, item.id ? 'Saved — guests see it in the app now' : 'Added to the app');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="kit-back" style={{ display: 'inline-flex' }} onClick={onClose}><Icon name="arrow_back" size={18} /> Catalogue</button>
        <h2 className="kit-h" style={{ flex: 1 }}>{item.id ? item.displayName || item.name : 'New experience'}</h2>
        <Toggle on={v.active} onClick={() => set('active')(!v.active)} label={v.active ? 'Shown in the app' : 'Hidden'} />
      </div>
      <div className="kit-two">
        <TextInput label="Name" value={v.name} onChange={set('name')} placeholder="Restore journey, Deep tissue massage, Golf range" />
        <TextInput label="Name shown to guests (optional)" value={v.displayName || ''} onChange={set('displayName')} />
        <label className="kit-field"><span className="kit-label">Mood</span>
          <select className="kit-select" value={v.category} onChange={(e) => set('category')(e.target.value)}>{MOODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <TextInput label={`Price (${v.currency || 'XAF'}, 0 = included)`} type="number" value={v.price} onChange={set('price')} />
      </div>
      <TextInput label="Description" multiline rows={3} value={v.description || ''} onChange={set('description')} />
      <TextInput label="Benefits (one per line)" multiline rows={3} value={(v.benefits || []).join('\n')} onChange={(t) => set('benefits')(t.split('\n'))} />

      <span className="card-title">Where and how guests get in</span>
      <div className="kit-two">
        <label className="kit-field"><span className="kit-label">Where</span>
          <select className="kit-select" value={v.locationKind} onChange={(e) => set('locationKind')(e.target.value)}>{WHERE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <TextInput label="Place" value={v.location || ''} onChange={set('location')} placeholder="Wellness Club, Pool Club, Golf range" />
        <TextInput label="Floor" value={v.floor || ''} onChange={set('floor')} />
        <label className="kit-field"><span className="kit-label">Access</span>
          <select className="kit-select" value={v.accessMode} onChange={(e) => set('accessMode')(e.target.value)}>{ACCESS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <TextInput label="Opening hours" value={v.openingHours || ''} onChange={set('openingHours')} placeholder="07:00–21:00" />
        <label className="kit-field"><span className="kit-label">Lent with it</span>
          <select className="kit-select" value={v.equipmentCategory} onChange={(e) => set('equipmentCategory')(e.target.value)}>{LOANS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
      </div>

      <span className="card-title">Booking</span>
      <div className="kit-two">
        {!v.stages.length ? <TextInput label="Duration (minutes)" type="number" value={v.duration} onChange={set('duration')} /> : <TextInput label="Duration (sum of the stages)" value={`${v.stages.reduce((t, s) => t + (Number(s.duration) || 0), 0)} min`} onChange={() => {}} />}
        <TextInput label="Guests per time slot" type="number" value={v.maxCapacity} onChange={set('maxCapacity')} />
        <TextInput label="Book at least (hours ahead)" type="number" value={v.bookAheadHours} onChange={set('bookAheadHours')} />
      </div>
      <div className="kit-actions">
        <Toggle on={v.requiresBooking} onClick={() => set('requiresBooking')(!v.requiresBooking)} label="Booked in advance" />
        <Toggle on={v.requiresStaff} onClick={() => set('requiresStaff')(!v.requiresStaff)} label="Needs a therapist or coach" />
      </div>

      <span className="card-title">Photos</span>
      <div className="kit-two">
        <ImageField label="Main photo" value={v.image} onChange={set('image')} upload={contentApi.uploadImage} toUrl={mediaUrl} />
        <div className="kit-field">
          <span className="kit-label">Gallery ({(v.gallery || []).length})</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {(v.gallery || []).map((u) => (
              <div key={u} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={mediaUrl(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" aria-label="Remove photo" onClick={() => set('gallery')(v.gallery.filter((x) => x !== u))} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, border: 0, background: 'rgba(0,0,0,.65)', color: '#fff', cursor: 'pointer' }}>×</button>
              </div>
            ))}
          </div>
          <ImageField label="" value={null} onChange={() => {}} upload={async (file) => { const url = await contentApi.uploadImage(file); set('gallery')([...(v.gallery || []), url]); return null; }} toUrl={mediaUrl} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="card-title" style={{ flex: 1 }}>Stages {v.stages.length ? `(a journey of ${v.stages.length})` : '(none — a single service)'}</span>
        <button type="button" className="fay-btn-outline" onClick={() => set('stages')([...v.stages, { name: '', duration: 20, location: v.location || '', floor: v.floor || '', image: null, requiresPin: v.accessMode === 'pin' }])}><Icon name="add" size={18} /> Add a stage</button>
      </div>
      {v.stages.map((st, i) => (
        <div key={i} className="card" style={{ background: 'var(--surface-2)', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="serif" style={{ fontSize: 22, color: 'var(--gold)', width: 28 }}>{i + 1}</span>
            <TextInput label="Stage" value={st.name} onChange={(t) => setStage(i, 'name', t)} style={{ flex: 1 }} />
            <TextInput label="Minutes" type="number" value={st.duration} onChange={(t) => setStage(i, 'duration', t)} style={{ width: 110 }} />
            <div className="kit-actions" style={{ alignSelf: 'flex-end' }}>
              <button type="button" className="fay-btn-outline" disabled={i === 0} onClick={() => moveStage(i, -1)} aria-label="Move up"><Icon name="arrow_upward" size={16} /></button>
              <button type="button" className="fay-btn-outline" disabled={i === v.stages.length - 1} onClick={() => moveStage(i, 1)} aria-label="Move down"><Icon name="arrow_downward" size={16} /></button>
              <button type="button" className="fay-btn-outline" onClick={() => set('stages')(v.stages.filter((_, j) => j !== i))} aria-label="Remove stage"><Icon name="delete" size={16} /></button>
            </div>
          </div>
          <div className="kit-two">
            <div className="col" style={{ gap: 12 }}>
              <TextInput label="What happens" multiline rows={3} value={st.description || ''} onChange={(t) => setStage(i, 'description', t)} />
              <div className="kit-two">
                <TextInput label="Room / place" value={st.location || ''} onChange={(t) => setStage(i, 'location', t)} />
                <TextInput label="Floor" value={st.floor || ''} onChange={(t) => setStage(i, 'floor', t)} />
              </div>
              <Toggle on={Boolean(st.requiresPin)} onClick={() => setStage(i, 'requiresPin', !st.requiresPin)} label="This room opens with the guest’s PIN" />
            </div>
            <ImageField label="Stage photo" value={st.image} onChange={(url) => setStage(i, 'image', url)} upload={contentApi.uploadImage} toUrl={mediaUrl} />
          </div>
        </div>
      ))}

      {error ? <span className="kit-error">{error}</span> : null}
      <div className="kit-actions" style={{ justifyContent: 'space-between' }}>
        {item.id ? (
          <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Remove this experience?') && opsApi.deleteWellness(item.id).then((r) => onDeleted(r.hidden ? r.message : 'Removed')).catch((e) => setError(e.message))}>
            <Icon name="delete" size={18} /> Remove
          </button>
        ) : <span />}
        <div className="kit-actions">
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-gold" onClick={save} disabled={busy || !v.name.trim()}><Icon name="check" size={18} /> {busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </section>
  );
}
