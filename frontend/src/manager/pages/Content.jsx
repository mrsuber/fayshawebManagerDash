import moment from 'moment';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { contentApi } from '../api';
import { Empty, Facts, ImageField, Pill, Tabs, TextInput, Toolbar } from '../components/kit';
import PanoramaDialog from '../components/PanoramaDialog';
import { Icon, Toggle } from '../components/ui';
import { mediaUrl } from '../config';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import Stories from './content/Stories';

const SECTIONS = [
  ['estate', 'Estate & 360° tour'],
  ['legal', 'Terms & privacy'],
  ['stories', 'Stories'],
];

/** FAY OS → Content: what the website and the guest app show, edited without a release. */
export default function Content() {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some(([k]) => k === params.get('section')) ? params.get('section') : 'estate';
  return (
    <div className="stack">
      <Toolbar>
        <Tabs value={section} onChange={(s) => setParams({ section: s })} options={SECTIONS} />
      </Toolbar>
      {section === 'estate' ? <Estate /> : section === 'legal' ? <Legal /> : <Stories />}
    </div>
  );
}

// ---------------------------------------------------------------- Estate places
const ZONES = [
  ['residences', 'Residences'],
  ['wellness', 'Wellness'],
  ['dining', 'Dining'],
  ['outdoors', 'Outdoors'],
  ['sport', 'Sport'],
  ['amenities', 'Amenities'],
];
const blank = { name: '', subtitle: '', description: '', features: [], glyph: '◎', zone: 'amenities', cover: null, panorama: null, yaw: 0, published: true };

function Estate() {
  const toast = useToast();
  const q = useApi(contentApi.places, [], []);
  const [editing, setEditing] = useState(null);
  const places = q.data || [];

  const move = (i, dir) => {
    const next = [...places];
    const [p] = next.splice(i, 1);
    next.splice(i + dir, 0, p);
    q.setData(next);
    contentApi.orderPlaces(next.map((x) => x.id)).catch((e) => {
      toast(e.message, 'error');
      q.reload();
    });
  };

  if (editing) {
    return (
      <PlaceEditor
        place={editing}
        onCancel={() => setEditing(null)}
        onSaved={(p, message) => {
          q.setData((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]));
          setEditing(null);
          toast(message);
        }}
        onDeleted={(id) => {
          q.setData((list) => list.filter((x) => x.id !== id));
          setEditing(null);
          toast('Place removed');
        }}
      />
    );
  }

  const inTour = places.filter((p) => p.panorama && p.published).length;
  return (
    <div className="stack">
      <Toolbar
        right={
          <button type="button" className="btn-gold" onClick={() => setEditing(blank)}>
            <Icon name="add" size={18} /> Add a place
          </button>
        }
      >
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>
          The places guests see in the app under <strong>Explore</strong>. Places with a 360° image form the virtual tour ({inTour} now); residence 360° images
          from HQ follow them.
        </span>
      </Toolbar>
      {places.length === 0 && !q.loading ? <Empty icon="map" title="No places yet">Add the pool, the spa, the golf course… with a photo and, if you have one, a 360° image.</Empty> : null}
      <div className="kit-cards">
        {places.map((p, i) => (
          <div key={p.id} className="kit-card" role="button" tabIndex={0} onClick={() => setEditing(p)} onKeyDown={(e) => e.key === 'Enter' && setEditing(p)}>
            <div className="kit-card__img">
              {p.cover ? <img src={mediaUrl(p.cover)} alt="" loading="lazy" /> : null}
              <div className="kit-card__badges">
                {p.published ? <Pill tone="#3fd283" solid>Published</Pill> : <Pill tone="#8f897d" solid>Hidden</Pill>}
                {p.panorama ? <Pill tone="#e8b84a" solid>360°</Pill> : null}
              </div>
            </div>
            <div className="kit-card__body">
              <span className="serif" style={{ fontSize: 22 }}>
                {p.glyph} {p.name}
              </span>
              <span className="sub">{[ZONES.find(([z]) => z === p.zone)?.[1], p.subtitle].filter(Boolean).join(' · ')}</span>
              <div className="kit-actions" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="fay-btn-outline" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}>
                  <Icon name="arrow_upward" size={16} />
                </button>
                <button type="button" className="fay-btn-outline" disabled={i === places.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}>
                  <Icon name="arrow_downward" size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceEditor({ place, onCancel, onSaved, onDeleted }) {
  const [v, setV] = useState({ ...blank, ...place, features: place.features || [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { ...v, features: v.features };
      const saved = place.id ? await contentApi.updatePlace(place.id, body) : await contentApi.createPlace(body);
      onSaved(saved, place.id ? 'Place saved — the app shows it now' : 'Place added');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${place.name}? Guests will no longer see it.`)) return;
    try {
      await contentApi.deletePlace(place.id);
      onDeleted(place.id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="card" style={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="kit-back" style={{ display: 'inline-flex' }} onClick={onCancel}>
          <Icon name="arrow_back" size={18} /> All places
        </button>
        <h2 className="kit-h" style={{ flex: 1 }}>{place.id ? place.name : 'New place'}</h2>
        <Toggle on={v.published} onClick={() => set('published')(!v.published)} label={v.published ? 'Published' : 'Hidden'} />
      </div>
      <div className="kit-two">
        <TextInput label="Name" value={v.name} onChange={set('name')} placeholder="Pool Club" />
        <TextInput label="Subtitle" value={v.subtitle} onChange={set('subtitle')} placeholder="Cabanas & sun deck" />
        <label className="kit-field">
          <span className="kit-label">Zone</span>
          <select className="kit-select" value={v.zone} onChange={(e) => set('zone')(e.target.value)}>
            {ZONES.map(([z, l]) => (
              <option key={z} value={z}>{l}</option>
            ))}
          </select>
        </label>
        <TextInput label="Symbol" value={v.glyph} onChange={set('glyph')} hint="One character shown beside the name in the app, e.g. ≈ ⌂ ✦" />
      </div>
      <TextInput label="Description" multiline rows={3} value={v.description} onChange={set('description')} />
      <TextInput
        label="Highlights (one per line)"
        multiline
        rows={3}
        value={(v.features || []).join('\n')}
        onChange={(t) => set('features')(t.split('\n'))}
        placeholder={'Private cabanas\nPoolside service'}
      />
      <div className="kit-two">
        <ImageField label="Photo" value={v.cover} onChange={set('cover')} upload={contentApi.uploadImage} toUrl={mediaUrl} hint="Landscape, at least 1600 px wide." />
        <ImageField
          label="360° image"
          wide
          value={v.panorama}
          onChange={set('panorama')}
          upload={contentApi.uploadImage}
          toUrl={mediaUrl}
          onPreview={() => setPreview(true)}
          hint="An equirectangular panorama (2:1, e.g. 6000 × 3000) from a 360° camera. With one, the place joins the virtual tour."
        />
      </div>
      {v.panorama ? (
        <TextInput label="Tour opens facing (degrees, 0–359)" type="number" value={v.yaw} onChange={(t) => set('yaw')(Number(t) || 0)} style={{ maxWidth: 260 }} />
      ) : null}
      {error ? <span className="kit-error">{error}</span> : null}
      <div className="kit-actions" style={{ justifyContent: 'space-between' }}>
        {place.id ? (
          <button type="button" className="fay-btn-outline" onClick={remove}>
            <Icon name="delete" size={18} /> Remove
          </button>
        ) : (
          <span />
        )}
        <div className="kit-actions">
          <button type="button" className="fay-btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-gold" onClick={save} disabled={busy || !v.name.trim()}>
            <Icon name="check" size={18} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <PanoramaDialog residence={preview ? { name: v.name || 'Preview', panoramaUrl: mediaUrl(v.panorama) } : null} onClose={() => setPreview(false)} />
    </section>
  );
}

// ---------------------------------------------------------------- Legal documents
function Legal() {
  const toast = useToast();
  const q = useApi(contentApi.legal, [], []);
  const docs = q.data || [];
  const [slug, setSlug] = useState('terms');
  const doc = docs.find((d) => d.slug === slug);
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [effective, setEffective] = useState(moment().format('YYYY-MM-DD'));
  const [busy, setBusy] = useState('');
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    if (doc) {
      setDraft(doc.draft);
      setTitle(doc.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.slug, doc?.updatedAt]);

  const dirty = doc && (draft !== doc.draft || title !== doc.title);
  const replace = (d) => q.setData((list) => list.map((x) => (x.slug === d.slug ? d : x)));
  const run = async (what, fn, message) => {
    setBusy(what);
    try {
      replace(await fn());
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const words = useMemo(() => (draft.match(/\S+/g) || []).length, [draft]);

  if (!doc) return q.loading ? null : <Empty icon="gavel" title="No documents" />;
  return (
    <div className="stack">
      <Toolbar>
        <Tabs value={slug} onChange={setSlug} options={docs.map((d) => [d.slug, d.title])} />
      </Toolbar>
      <section className="card" style={{ gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="col" style={{ flex: 1, minWidth: 240, gap: 6 }}>
            <span className="kit-label">Published version {doc.version}</span>
            <input className="kit-input kit-h" style={{ padding: '4px 8px' }} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          </div>
          {doc.hasChanges || dirty ? <Pill tone="#e8b84a">Unpublished changes</Pill> : <Pill tone="#3fd283">Live</Pill>}
        </div>
        <div className="kit-editor">
          <label className="kit-field">
            <span className="kit-label">Text (Markdown) · {words} words</span>
            <textarea className="kit-input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={26} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
            <span className="sub">## Heading · **bold** · *italic* · - list item · 1. numbered · [link](https://…)</span>
          </label>
          <div className="kit-field">
            <span className="kit-label">Preview</span>
            <div className="kit-input kit-prose" style={{ height: '100%', minHeight: 300, maxHeight: 640, overflowY: 'auto' }}>
              <Markdown source={draft} />
            </div>
          </div>
        </div>
        <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="fay-btn-outline" disabled={!dirty || !!busy} onClick={() => run('save', () => contentApi.saveLegal(slug, { title, draft }), 'Draft saved (not yet published)')}>
            <Icon name="save" size={18} /> {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </section>

      <section className="card" style={{ gap: 12 }}>
        <span className="card-title">Publish</span>
        <span className="sub">
          Publishing makes this text live on the website, in the app and in the booking flow. Guests who book from then on accept the new version; earlier
          bookings keep the version their guest accepted.
        </span>
        <div className="kit-two">
          <TextInput label="What changed (kept with the version)" value={summary} onChange={setSummary} placeholder="Updated the cancellation policy" />
          <TextInput label="In effect from" type="date" value={effective} onChange={setEffective} />
        </div>
        <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-gold"
            disabled={!!busy || !summary.trim() || (!doc.hasChanges && !dirty)}
            onClick={() =>
              run(
                'publish',
                async () => {
                  if (dirty) await contentApi.saveLegal(slug, { title, draft });
                  const d = await contentApi.publishLegal(slug, { summary, effectiveDate: effective });
                  setSummary('');
                  return d;
                },
                `Published — version ${doc.version + 1} is live`,
              )
            }
          >
            <Icon name="publish" size={18} /> {busy === 'publish' ? 'Publishing…' : `Publish version ${doc.version + 1}`}
          </button>
        </div>
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="card-title">History</span>
        <div className="kit-scroll">
          <table className="kit-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>What changed</th>
                <th>In effect from</th>
                <th>Published</th>
                {slug === 'terms' ? <th>Accepted by</th> : null}
                <th />
              </tr>
            </thead>
            <tbody>
              {doc.versions.map((v) => (
                <tr key={v.version}>
                  <td>v{v.version}</td>
                  <td>{v.summary}</td>
                  <td>{moment(v.effectiveDate).format('D MMM YYYY')}</td>
                  <td>
                    {moment(v.publishedAt).format('D MMM YYYY')} · {v.publishedBy}
                  </td>
                  {slug === 'terms' ? <td>{v.acceptedBy} booking{v.acceptedBy === 1 ? '' : 's'}</td> : null}
                  <td>
                    <button type="button" className="card-link" onClick={() => contentApi.legalVersion(slug, v.version).then(setViewing).catch((e) => toast(e.message, 'error'))}>
                      Read
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewing ? (
          <div className="kit-input kit-prose" style={{ maxHeight: 480, overflowY: 'auto' }}>
            <Facts items={[['Version', `v${viewing.version}`], ['Title', viewing.title]]} />
            <Markdown source={viewing.body} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
