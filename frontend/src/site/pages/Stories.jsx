import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { getStories, getStory } from '../api';
import PhotoViewer from '../components/PhotoViewer';
import { Loading } from '../components/ui';
import { useLang } from '../i18n';

const CATS = [
  ['', 'stories.all'],
  ['wedding', 'stories.wedding'],
  ['corporate', 'stories.corporate'],
  ['celebration', 'stories.celebration'],
  ['retreat', 'stories.retreat'],
  ['wellness', 'stories.wellness'],
  ['news', 'stories.news'],
];
const catLabel = (t, c) => t(CATS.find(([k]) => k === c)?.[1] || 'stories.all');
const longDate = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function StoryCard({ s, big = false }) {
  const { t, lang } = useLang();
  return (
    <Link to={`/stories/${s.slug}`} className={`fs-story-card${big ? ' fs-story-card--big' : ''}`}>
      <div className="fs-story-card__img">{s.cover ? <img src={s.cover} alt="" loading="lazy" /> : null}</div>
      <div className="fs-story-card__body">
        <p className="fs-kicker" style={{ margin: 0 }}>{catLabel(t, s.category)}{s.guests ? ` · ${s.guests} ${t('stories.guests')}` : ''}</p>
        <h3 className="fs-h3">{s.title}</h3>
        {s.excerpt ? <p className="fs-muted" style={{ margin: 0, lineHeight: 1.7 }}>{s.excerpt}</p> : null}
        <span className="fs-story-card__date">{longDate(s.eventDate || s.publishedAt, lang)}</span>
      </div>
    </Link>
  );
}

/** /stories — the journal: weddings, retreats and celebrations held at Faysha. */
export function Stories() {
  const { t } = useLang();
  const [cat, setCat] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setList(null);
    getStories(cat).then(setList).catch((e) => setError(e.message));
  }, [cat]);
  const [first, ...rest] = list || [];
  return (
    <>
      <section className="fs-container fs-page-head" style={{ paddingBottom: 40 }}>
        <p className="fs-kicker">{t('stories.kicker')}</p>
        <h1 className="fs-h1">{t('stories.title')}</h1>
        <p className="fs-lead">{t('stories.lead')}</p>
        <div className="fs-filters" style={{ marginTop: 36 }}>
          {CATS.map(([k, key]) => (
            <button key={k || 'all'} type="button" aria-pressed={cat === k} className="fs-chip" onClick={() => setCat(k)}>
              {t(key)}
            </button>
          ))}
        </div>
      </section>
      <section className="fs-container" style={{ paddingBottom: 120 }}>
        {error ? <div className="fs-alert fs-alert--error">{error}</div> : null}
        {list === null && !error ? <Loading label={t('common.loading')} /> : null}
        {list && list.length === 0 ? (
          <div className="fs-empty">
            <p>{t('stories.empty')}</p>
            <Link to="/events" className="fs-btn fs-btn--gold">{t('events.cta')}</Link>
          </div>
        ) : null}
        {first ? <StoryCard s={first} big /> : null}
        {rest.length ? (
          <div className="fs-story-grid">
            {rest.map((s) => (
              <StoryCard key={s.slug} s={s} />
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}

/** /stories/:slug — one story with its gallery. */
export function Story() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const [s, setS] = useState(undefined);
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    setS(undefined);
    window.scrollTo(0, 0);
    getStory(slug).then(setS).catch(() => setS(null));
  }, [slug]);
  useEffect(() => {
    if (s?.title) document.title = `${s.title} · Faysha`;
  }, [s?.title]);

  if (s === undefined) return <Loading label={t('common.loading')} />;
  if (s === null) {
    return (
      <div className="fs-container fs-section fs-empty">
        <p>{t('stories.notFound')}</p>
        <Link to="/stories" className="fs-btn fs-btn--ghost">{t('stories.back')}</Link>
      </div>
    );
  }
  const photos = s.gallery.map((url, i) => ({ id: i, url }));
  return (
    <>
      <section className="fs-story-hero">
        {s.cover ? <img src={s.cover} alt="" /> : null}
        <div className="fs-story-hero__shade" />
        <div className="fs-container fs-container--narrow fs-story-hero__text">
          <Link to="/stories" className="fs-kicker" style={{ textDecoration: 'none' }}>← {t('stories.kicker')}</Link>
          <h1 className="fs-h1">{s.title}</h1>
          <p className="fs-muted" style={{ margin: 0 }}>
            {[catLabel(t, s.category), longDate(s.eventDate || s.publishedAt, lang), s.guests ? `${s.guests} ${t('stories.guests')}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </section>
      <section className="fs-container fs-container--narrow" style={{ paddingTop: 56, paddingBottom: 40 }}>
        {s.excerpt ? <p className="fs-lead" style={{ marginTop: 0 }}>{s.excerpt}</p> : null}
        <Markdown source={s.body} className="fs-prose fs-story-body" />
      </section>
      {photos.length ? (
        <section className="fs-container" style={{ paddingBottom: 56 }}>
          <div className="fs-story-gallery">
            {photos.map((p, i) => (
              <button key={p.id} type="button" className="fs-gallery__tile" onClick={() => setViewing(i)} aria-label={`Photo ${i + 1}`}>
                <img src={p.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="fs-container" style={{ paddingBottom: 120 }}>
        <div className="fs-cta" style={{ marginBottom: 64 }}>
          <p className="fs-kicker">{t('events.kicker')}</p>
          <h2 className="fs-h2">{t('stories.yourTurn')}</h2>
          <Link to="/events#plan" className="fs-btn fs-btn--gold" style={{ marginTop: 24 }}>{t('events.cta')}</Link>
        </div>
        {s.more.length ? (
          <>
            <h2 className="fs-h2" style={{ marginBottom: 28 }}>{t('stories.more')}</h2>
            <div className="fs-story-grid">
              {s.more.map((m) => (
                <StoryCard key={m.slug} s={m} />
              ))}
            </div>
          </>
        ) : null}
      </section>
      <PhotoViewer photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} title={s.title} />
    </>
  );
}
