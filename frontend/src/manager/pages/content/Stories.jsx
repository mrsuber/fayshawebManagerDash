import moment from 'moment';
import { useState } from 'react';
import Markdown from '../../../components/Markdown';
import { contentApi } from '../../api';
import { Empty, ImageField, Pill, TextInput, Toolbar } from '../../components/kit';
import { Icon, Toggle } from '../../components/ui';
import { mediaUrl } from '../../config';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';

export const STORY_CATEGORIES = [
  ['wedding', 'Wedding'],
  ['corporate', 'Corporate'],
  ['celebration', 'Celebration'],
  ['retreat', 'Retreat'],
  ['wellness', 'Wellness'],
  ['news', 'News'],
];
const label = (c) => STORY_CATEGORIES.find(([k]) => k === c)?.[1] || c;
const blank = { title: '', excerpt: '', body: '', category: 'wedding', cover: null, gallery: [], eventDate: '', guests: '', featured: false, status: 'draft' };

/** The website journal: success stories of events held at Faysha, and news. */
export default function Stories() {
  const toast = useToast();
  const q = useApi(contentApi.stories, [], []);
  const [editing, setEditing] = useState(null);
  const list = q.data || [];

  if (editing) {
    return (
      <StoryEditor
        story={editing}
        onClose={() => setEditing(null)}
        onSaved={(s, message) => {
          q.setData((l) => (l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [s, ...l]));
          setEditing(s);
          toast(message);
        }}
        onDeleted={(id) => {
          q.setData((l) => l.filter((x) => x.id !== id));
          setEditing(null);
          toast('Story deleted');
        }}
      />
    );
  }
  return (
    <div className="stack">
      <Toolbar
        right={
          <button type="button" className="btn-gold" onClick={() => setEditing(blank)}>
            <Icon name="edit_note" size={18} /> Write a story
          </button>
        }
      >
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>
          Stories appear in the website journal (<a href="/stories" target="_blank" rel="noreferrer">/stories</a>). Tell the story of a wedding or retreat held
          here, with photos — the best proof for the next client.
        </span>
      </Toolbar>
      {list.length === 0 && !q.loading ? <Empty icon="auto_stories" title="No stories yet">Write about the last event you hosted. Drafts stay private until you publish.</Empty> : null}
      <div className="kit-cards">
        {list.map((s) => (
          <button key={s.id} type="button" className="kit-card" onClick={() => setEditing(s)}>
            <div className="kit-card__img">
              {s.cover ? <img src={mediaUrl(s.cover)} alt="" loading="lazy" /> : null}
              <div className="kit-card__badges">
                {s.status === 'published' ? <Pill tone="#3fd283" solid>Published</Pill> : <Pill tone="#8f897d" solid>Draft</Pill>}
                {s.featured ? <Pill tone="#e8b84a" solid>Featured</Pill> : null}
              </div>
            </div>
            <div className="kit-card__body">
              <span className="kit-label">{label(s.category)}</span>
              <span className="serif" style={{ fontSize: 21, lineHeight: 1.2 }}>{s.title}</span>
              <span className="sub">{s.status === 'published' ? `Published ${moment(s.publishedAt).format('D MMM YYYY')}` : `Edited ${moment(s.updatedAt).fromNow()}`}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryEditor({ story, onClose, onSaved, onDeleted }) {
  const [v, setV] = useState({ ...blank, ...story, eventDate: story.eventDate || '', guests: story.guests || '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  const save = async (status) => {
    setBusy(status || 'save');
    setError('');
    try {
      const body = { ...v, status: status || v.status };
      const saved = story.id ? await contentApi.updateStory(story.id, body) : await contentApi.createStory(body);
      let out = saved;
      if (!story.id && status === 'published') out = await contentApi.updateStory(saved.id, { status: 'published' });
      setV((x) => ({ ...x, status: out.status }));
      onSaved(out, out.status === 'published' ? (status === 'published' ? 'Published on the website' : 'Saved — live on the website') : 'Draft saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const addPhoto = async (file) => {
    const url = await contentApi.uploadImage(file);
    set('gallery')([...(v.gallery || []), url]);
    return null;
  };

  return (
    <section className="card" style={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="kit-back" style={{ display: 'inline-flex' }} onClick={onClose}>
          <Icon name="arrow_back" size={18} /> All stories
        </button>
        <span style={{ flex: 1 }} />
        {v.status === 'published' ? <Pill tone="#3fd283">Published</Pill> : <Pill tone="#8f897d">Draft</Pill>}
        <Toggle on={v.featured} onClick={() => set('featured')(!v.featured)} label="Featured" />
      </div>
      <TextInput label="Title" value={v.title} onChange={set('title')} placeholder="A garden wedding for 140 under the palms" />
      <TextInput label="Summary (shown in the journal and on social media)" multiline rows={2} value={v.excerpt} onChange={set('excerpt')} />
      <div className="kit-two">
        <label className="kit-field">
          <span className="kit-label">Category</span>
          <select className="kit-select" value={v.category} onChange={(e) => set('category')(e.target.value)}>
            {STORY_CATEGORIES.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <TextInput label="Date of the event" type="date" value={v.eventDate} onChange={set('eventDate')} />
        <TextInput label="Guests" type="number" value={v.guests} onChange={set('guests')} />
      </div>
      <div className="kit-two">
        <ImageField label="Cover photo" value={v.cover} onChange={set('cover')} upload={contentApi.uploadImage} toUrl={mediaUrl} hint="Required to publish. Landscape, 2000 px wide is ideal." />
        <div className="kit-field">
          <span className="kit-label">Gallery ({(v.gallery || []).length})</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {(v.gallery || []).map((u) => (
              <div key={u} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={mediaUrl(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => set('gallery')(v.gallery.filter((x) => x !== u))}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, border: 0, background: 'rgba(0,0,0,.65)', color: '#fff', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <ImageField label="" value={null} onChange={() => {}} upload={addPhoto} toUrl={mediaUrl} hint="Add photos one at a time; they appear under the story." />
        </div>
      </div>
      <div className="kit-editor">
        <TextInput label="Story (Markdown)" multiline rows={18} value={v.body} onChange={set('body')} hint="## Heading · **bold** · *italic* · - list · [link](https://…)" />
        <div className="kit-field">
          <span className="kit-label">Preview</span>
          <div className="kit-input kit-prose" style={{ minHeight: 300, maxHeight: 560, overflowY: 'auto' }}>
            <Markdown source={v.body} />
          </div>
        </div>
      </div>
      {error ? <span className="kit-error">{error}</span> : null}
      <div className="kit-actions" style={{ justifyContent: 'space-between' }}>
        {story.id ? (
          <button
            type="button"
            className="fay-btn-outline"
            onClick={async () => {
              if (window.confirm('Delete this story?')) await contentApi.deleteStory(story.id).then(() => onDeleted(story.id)).catch((e) => setError(e.message));
            }}
          >
            <Icon name="delete" size={18} /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="kit-actions">
          {v.status === 'published' ? (
            <button type="button" className="fay-btn-outline" disabled={!!busy} onClick={() => save('draft')}>
              <Icon name="visibility_off" size={18} /> Unpublish
            </button>
          ) : null}
          <button type="button" className="fay-btn-outline" disabled={!!busy || !v.title.trim()} onClick={() => save()}>
            <Icon name="save" size={18} /> {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          {v.status !== 'published' ? (
            <button type="button" className="btn-gold" disabled={!!busy || !v.title.trim()} onClick={() => save('published')}>
              <Icon name="publish" size={18} /> {busy === 'published' ? 'Publishing…' : 'Publish'}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
