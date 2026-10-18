import { Link } from 'react-router-dom';
import { PageContent, Txt } from '../content';
import { IMG, MOODS } from '../data';
import { useLang } from '../i18n';

export default function Wellness() {
  return (
    <PageContent pageId="amenities">
      <WellnessBody />
    </PageContent>
  );
}

function WellnessBody() {
  const { t } = useLang();
  return (
    <>
      <section className="fs-hero fs-hero--short" aria-labelledby="well-title">
        <img className="fs-hero__img" src={IMG.spa} alt="" />
        <div className="fs-hero__shade" />
        <div className="fs-container fs-hero__body" style={{ textAlign: 'center', paddingBottom: 72 }}>
          <Txt s="hero" k="kicker" as="p" className="fs-kicker">
            Wellness at Faysha
          </Txt>
          <h1 id="well-title" className="fs-display" style={{ maxWidth: 900, margin: '0 auto', fontSize: 'clamp(48px, 6.6vw, 100px)' }}>
            <Txt s="hero" k="title">How would you like to feel today?</Txt>
          </h1>
          <Txt s="hero" k="subtitle" as="p" className="fs-italic" multiline>
            Choose a mood and we shape your day around it — from the first light to the last.
          </Txt>
          <div className="fs-chips" style={{ justifyContent: 'center', marginTop: 40 }}>
            {MOODS.map((m) => (
              <a key={m.id} href={`#${m.id}`} className="fs-btn fs-btn--ghost">
                {m.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="fs-container" style={{ padding: '60px 32px 120px', display: 'flex', flexDirection: 'column', gap: 120 }}>
        {MOODS.map((m, i) => (
          <section
            key={m.id}
            id={m.id}
            className="fs-split"
            style={{ flexDirection: i % 2 ? 'row-reverse' : 'row', scrollMarginTop: 40 }}
            aria-labelledby={`${m.id}-title`}
          >
            <div style={{ position: 'relative', aspectRatio: '5 / 4', borderRadius: 14, overflow: 'hidden' }}>
              <img src={m.img} alt={m.alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="fs-kicker" style={{ margin: 0 }}>
                0{i + 1} · {m.kicker}
              </span>
              <h2 id={`${m.id}-title`} className="fs-h2" style={{ letterSpacing: 4 }}>
                {m.name.toUpperCase()}
              </h2>
              <Txt s={m.id} k="tagline" as="p" className="fs-italic">
                {m.tagline}
              </Txt>
              <ul
                style={{
                  listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                  gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden',
                }}
              >
                {m.items.map(([name, desc]) => (
                  <li key={name} style={{ background: 'var(--surface)', padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="fs-h3" style={{ fontSize: 20 }}>
                      {name}
                    </span>
                    <span className="fs-muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                      {desc}
                    </span>
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <Link to="/residences" className="fs-btn fs-btn--gold">
                  {t('nav.book')}
                </Link>
                <Link to="/#app" className="fs-btn fs-btn--ghost">
                  {t('nav.app')}
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="fs-band">
        <div className="fs-container fs-container--narrow fs-section" style={{ textAlign: 'center' }}>
          <Txt s="journeys" k="kicker" as="p" className="fs-kicker">
            Wellness journeys
          </Txt>
          <Txt s="journeys" k="title" as="h2" className="fs-h2" >
            A journey, planned for you
          </Txt>
          <Txt s="journeys" k="body" as="p" className="fs-lead" multiline>
            Add a multi-day wellness journey to your stay through the concierge. The access codes for each session arrive by email, and every session appears in the Faysha app.
          </Txt>
          <Link to="/contact" className="fs-btn fs-btn--gold fs-btn--lg" style={{ marginTop: 36 }}>
            <Txt s="journeys" k="cta">Ask the concierge</Txt>
          </Link>
        </div>
      </section>
    </>
  );
}
