import { Link } from 'react-router-dom';
import { Monogram } from '../components/ui';
import { PageContent, Txt } from '../content';
import { IMG } from '../data';
import { useLang } from '../i18n';

// Copy carried over from the v1 About page; all of it stays editable in Page Management ("about").
const VALUES = [
  ['quality', 'Quality without compromise', 'Every property is owned and maintained by us to ensure consistent excellence.'],
  ['innovation', 'Smart by design', 'Smart locks with time-limited codes mean seamless check-in, no waiting.'],
  ['value', 'Honest value', 'Competitive pricing with hotel-grade amenities and services included.'],
  ['care', 'Care, around the clock', 'Our on-site team is always ready to assist with any request.'],
];

export default function About() {
  return (
    <PageContent pageId="about">
      <AboutBody />
    </PageContent>
  );
}

function AboutBody() {
  const { t } = useLang();
  return (
    <>
      <section className="fs-container fs-page-head" style={{ paddingBottom: 72 }}>
        <Txt s="hero" k="kicker" as="p" className="fs-kicker">
          About Faysha
        </Txt>
        <h1 className="fs-h1" style={{ maxWidth: 900 }}>
          <Txt s="hero" k="title">Redefining rental living</Txt>
        </h1>
        <Txt s="hero" k="description" as="p" className="fs-lead" multiline>
          Owned properties, smart technology and exceptional service — the freedom of your own home with the care of a luxury hotel.
        </Txt>
      </section>

      <section className="fs-container" style={{ paddingBottom: 120 }}>
        <div className="fs-split" style={{ alignItems: 'stretch' }}>
          <div style={{ position: 'relative', minHeight: 420, borderRadius: 14, overflow: 'hidden' }}>
            <img src={IMG.club} alt="The Faysha Signature Wellness Club at night" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
            <Txt s="story" k="title" as="h2" className="fs-h2">
              The Faysha story
            </Txt>
            <Txt s="story" k="p1" as="p" className="fs-lead" multiline>
              Faysha was born from a simple idea: what if rental properties could offer the freedom of Airbnb with the reliability and amenities of a luxury hotel?
            </Txt>
            <Txt s="story" k="p2" as="p" className="fs-lead" multiline>
              By owning our properties outright, we maintain complete control over every aspect of your experience. From the quality of furnishings to the functionality of our smart systems, everything is designed with your comfort in mind.
            </Txt>
            <Txt s="story" k="p3" as="p" className="fs-lead" multiline>
              We're not just a booking platform — we're property owners, technology innovators and hospitality experts all in one. Our buildings in Cameroon feature fully furnished apartments, complete with pool, gym, spa and smart access technology.
            </Txt>
          </div>
        </div>
      </section>

      <section className="fs-band">
        <div className="fs-container fs-section">
          <div className="fs-info-grid" style={{ gap: 24 }}>
            <div className="fs-card fs-card--gold" style={{ padding: 40 }}>
              <p className="fs-kicker">
                <Txt s="mission" k="label">Our mission</Txt>
              </p>
              <Txt s="mission" k="text" as="p" className="fs-italic" multiline>
                To provide smart, comfortable and convenient living spaces that combine the best of modern technology with exceptional hospitality.
              </Txt>
            </div>
            <div className="fs-card fs-card--gold" style={{ padding: 40 }}>
              <p className="fs-kicker">
                <Txt s="vision" k="label">Our vision</Txt>
              </p>
              <Txt s="vision" k="text" as="p" className="fs-italic" multiline>
                To become Cameroon's leading smart wellness residence, setting new standards for property management and guest experience.
              </Txt>
            </div>
          </div>
        </div>
      </section>

      <section className="fs-container fs-section">
        <div style={{ maxWidth: 680, marginBottom: 56 }}>
          <Txt s="values" k="kicker" as="p" className="fs-kicker">
            What makes us different
          </Txt>
          <Txt s="values" k="title" as="h2" className="fs-h2">
            Not a hotel. Not a rental. Something better.
          </Txt>
        </div>
        <div className="fs-pillars" style={{ marginTop: 0 }}>
          {VALUES.map(([key, title, body]) => (
            <div key={key} className="fs-pillar">
              <Txt s="values" k={`${key}_title`} as="h3" className="fs-h3">
                {title}
              </Txt>
              <Txt s="values" k={`${key}_body`} as="p" multiline>
                {body}
              </Txt>
            </div>
          ))}
        </div>
      </section>

      <section className="fs-container" style={{ paddingBottom: 120 }}>
        <div className="fs-cta">
          <Monogram size={56} stroke={1.2} style={{ color: 'var(--gold)' }} />
          <Txt s="cta" k="title" as="h2" className="fs-h2" >
            Experience the Faysha difference
          </Txt>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 36 }}>
            <Link to="/residences" className="fs-btn fs-btn--gold fs-btn--lg">
              {t('nav.book')}
            </Link>
            <Link to="/wellness" className="fs-btn fs-btn--ghost fs-btn--lg">
              {t('nav.wellness')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
