import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResidences, getTestimonials, mediaUrl } from '../api';
import BookingBar from '../components/BookingBar';
import PhoneMock from '../components/PhoneMock';
import ResidenceCard from '../components/ResidenceCard';
import { Icon, Monogram } from '../components/ui';
import { PageContent, Txt } from '../content';
import { IMG, MOODS } from '../data';
import { defaultStay, stayQuery } from '../format';
import { useLang } from '../i18n';

const PILLARS = [
  ['home', 'owned', 'Owned & curated', 'Fully furnished residences in our own buildings, held to one standard of quality.'],
  ['key', 'keyless', 'Keyless arrival', 'A time-limited digital key reaches you by email, SMS and the app before you arrive.'],
  ['heart', 'wellness', 'Wellness, built in', 'Spa, fitness, sunset rituals and guided journeys — booked in a tap, part of every stay.'],
  ['chat', 'concierge', 'A concierge, always', 'Your on-site team and FAY, our AI concierge, answer day and night.'],
];

const STEPS = [
  ['Reserve online', 'Choose your dates and residence, accept the terms of stay, and pay by card or mobile money.'],
  ['Receive your digital key', 'Your access code and deposit box arrive by email, SMS and in the Faysha app before check-in.'],
  ['Arrive and unwind', 'Let yourself in, then book the spa, order dinner and control your residence from the app or smart TV.'],
];

const APP_FEATURES = ['Digital key', 'Smart home & AI companion', 'Wellness bookings', 'Concierge chat', 'Deposit box', 'Rewards'];

export default function Home() {
  return (
    <PageContent pageId="home">
      <HomeBody />
    </PageContent>
  );
}

function HomeBody() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [residences, setResidences] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const stay = defaultStay();

  useEffect(() => {
    getResidences().then(setResidences).catch(() => setResidences([]));
    getTestimonials(3).then(setTestimonials);
  }, []);

  const search = ({ type, ...s }) => {
    const q = stayQuery(s);
    navigate(type && type !== 'all' ? `/residences/${type}?${q}` : `/residences?${q}`);
  };

  return (
    <>
      <section className="fs-hero" aria-labelledby="hero-title">
        <img className="fs-hero__img fs-hero__img--right" src={IMG.hero} alt="The Faysha monogram monument at dusk" />
        <div className="fs-hero__shade fs-hero__shade--side" />
        <div className="fs-container fs-hero__body">
          <Txt s="hero" k="kicker" as="p" className="fs-kicker">
            Smart wellness residences · Cameroon
          </Txt>
          <h1 id="hero-title" className="fs-display" style={{ maxWidth: 980 }}>
            <Txt s="hero" k="title">One destination, endless serenity</Txt>
          </h1>
          <Txt s="hero" k="subtitle" as="p" className="fs-lead" multiline>
            The privacy of your own residence, the care of a grand hotel, and a wellness ritual for every mood — all opened with a single digital key.
          </Txt>
          <BookingBar stay={stay} residences={residences || []} onSearch={search} />
        </div>
      </section>

      <section id="about" className="fs-section">
        <div className="fs-container">
          <div className="fs-split" style={{ alignItems: 'flex-end' }}>
            <div>
              <Txt s="intro" k="kicker" as="p" className="fs-kicker">
                The Faysha way
              </Txt>
              <Txt s="intro" k="title" as="h2" className="fs-h2">
                A residence that knows how you like to live
              </Txt>
            </div>
            <Txt s="intro" k="body" as="p" className="fs-lead" multiline>
              Every residence is owned, furnished and cared for by Faysha — never sublet, never compromised. Arrive to a home that is ready for you, with a team and a concierge one message away.
            </Txt>
          </div>
          <div className="fs-pillars">
            {PILLARS.map(([icon, key, title, body]) => (
              <div key={key} className="fs-pillar">
                <span className="fs-gold">
                  <Icon name={icon} size={34} stroke={1.2} />
                </span>
                <Txt s="pillars" k={`${key}_title`} as="h3" className="fs-h3" >
                  {title}
                </Txt>
                <Txt s="pillars" k={`${key}_body`} as="p" multiline>
                  {body}
                </Txt>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fs-section" style={{ paddingTop: 40 }} aria-labelledby="res-title">
        <div className="fs-container">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 48 }}>
            <div>
              <Txt s="residences" k="kicker" as="p" className="fs-kicker">
                The residences
              </Txt>
              <h2 id="res-title" className="fs-h2">
                <Txt s="residences" k="title">Choose your sanctuary</Txt>
              </h2>
            </div>
            <Link to="/residences" className="fs-btn fs-btn--ghost">
              {t('nav.residences')} →
            </Link>
          </div>
          {residences === null ? (
            <div className="fs-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="fs-res-card fs-ph" style={{ minHeight: 380 }} aria-hidden="true" />
              ))}
            </div>
          ) : (
            <div className="fs-grid">
              {residences.slice(0, 4).map((r) => (
                <ResidenceCard key={r.id} residence={r} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="fs-band" aria-labelledby="mood-title">
        <div className="fs-container fs-section">
          <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 64px' }}>
            <Txt s="moods" k="kicker" as="p" className="fs-kicker">
              Wellness
            </Txt>
            <h2 id="mood-title" className="fs-h2">
              <Txt s="moods" k="title">How would you like to feel today?</Txt>
            </h2>
            <Txt s="moods" k="subtitle" as="p" className="fs-italic" multiline>
              Four moods, one residence. Choose yours, and we shape the day around it.
            </Txt>
          </div>
          <div className="fs-grid fs-grid--moods">
            {MOODS.map((m) => (
              <Link key={m.id} to={`/wellness#${m.id}`} className="fs-mood">
                <img src={m.img} alt={m.alt} loading="lazy" />
                <div className="fs-mood__shade" />
                <div className="fs-mood__body">
                  <span style={{ fontSize: 10, letterSpacing: 3, color: 'var(--gold)', textTransform: 'uppercase' }}>{m.kicker}</span>
                  <span className="fs-mood__name">{m.name.toUpperCase()}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(236,230,218,.82)' }}>{m.short}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="fs-section" aria-labelledby="steps-title">
        <div className="fs-container">
          <div className="fs-split" style={{ alignItems: 'flex-start' }}>
            <div style={{ flexBasis: 360 }}>
              <Txt s="steps" k="kicker" as="p" className="fs-kicker">
                Your smart stay
              </Txt>
              <h2 id="steps-title" className="fs-h2" style={{ marginBottom: 22 }}>
                <Txt s="steps" k="title">From booking to unwinding</Txt>
              </h2>
              <Txt s="steps" k="body" as="p" className="fs-lead" multiline>
                No front desk queue and no keys to collect. Just three quiet steps between you and your residence.
              </Txt>
            </div>
            <ol className="fs-steps" style={{ flexGrow: 2 }}>
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <span className="fs-steps__n">0{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Txt s="steps" k={`s${i + 1}_title`} className="fs-h3">
                      {title}
                    </Txt>
                    <Txt s="steps" k={`s${i + 1}_body`} multiline className="fs-muted">
                      {body}
                    </Txt>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="dining" className="fs-band-img" aria-labelledby="dining-title">
        <img className="fs-hero__img" src={IMG.club} alt="The Faysha Signature Wellness Club and Cafe Bar at night" />
        <div className="fs-band-img__shade" />
        <div className="fs-container" style={{ position: 'relative', padding: '100px 32px' }}>
          <div style={{ maxWidth: 520 }}>
            <Txt s="dining" k="kicker" as="p" className="fs-kicker">
              Dining
            </Txt>
            <h2 id="dining-title" className="fs-h2" style={{ marginBottom: 22 }}>
              <Txt s="dining" k="title">The table is set whenever you are</Txt>
            </h2>
            <Txt s="dining" k="body" as="p" className="fs-lead" multiline>
              Breakfast on your terrace, dinner at the Sky Deck, or a nourishing plate from the Vitality Café — ordered from your phone and charged to your stay.
            </Txt>
            <Link to="/wellness#explore" className="fs-btn fs-btn--ghost" style={{ marginTop: 36 }}>
              <Txt s="dining" k="cta">Discover the estate</Txt>
            </Link>
          </div>
        </div>
      </section>

      <section id="app" className="fs-section" aria-labelledby="app-title">
        <div className="fs-container">
          <div className="fs-split" style={{ gap: 80 }}>
            <div>
              <Txt s="app" k="kicker" as="p" className="fs-kicker">
                The Faysha app
              </Txt>
              <h2 id="app-title" className="fs-h2" style={{ marginBottom: 22 }}>
                <Txt s="app" k="title">Your residence, in your hand</Txt>
              </h2>
              <Txt s="app" k="body" as="p" className="fs-lead" multiline>
                Open your door, adjust your residence, book a massage, chat with the concierge and collect rewards — all in one place, from the moment you book.
              </Txt>
              <ul className="fs-dot-list" style={{ margin: '36px 0 40px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {APP_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="fs-muted" style={{ margin: 0, fontSize: 13 }}>
                <Txt s="app" k="stores">Available for residents on iPhone and Android. Sign in with the email you booked with.</Txt>
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', flexBasis: 360 }}>
              <PhoneMock />
            </div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="fs-band" aria-labelledby="voices-title">
          <div className="fs-container fs-section--tight">
            <p className="fs-kicker" style={{ textAlign: 'center' }}>
              Guest voices
            </p>
            <h2 id="voices-title" className="fs-h2" style={{ textAlign: 'center', marginBottom: 48 }}>
              <Txt s="testimonials" k="title">In their words</Txt>
            </h2>
            <div className="fs-grid">
              {testimonials.map((q) => (
                <figure key={q.id} className="fs-card" style={{ margin: 0, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <span className="fs-gold" aria-label={`${q.rating} out of 5`}>
                    {'★'.repeat(Math.round(q.rating || 5))}
                  </span>
                  <blockquote className="fs-italic" style={{ margin: 0, fontSize: 21 }}>
                    “{q.testimonial_text}”
                  </blockquote>
                  <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                    {q.image_url && <img src={mediaUrl(q.image_url)} alt="" width="40" height="40" style={{ borderRadius: '50%', objectFit: 'cover' }} />}
                    <span>
                      <span style={{ display: 'block', fontWeight: 500 }}>{q.name}</span>
                      {q.role && <span className="fs-muted" style={{ fontSize: 13 }}>{q.role}</span>}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="fs-section" style={{ paddingTop: testimonials.length ? 120 : 0 }}>
        <div className="fs-container">
          <div className="fs-cta">
            <Monogram size={56} stroke={1.2} style={{ color: 'var(--gold)' }} />
            <h2 className="fs-h2" style={{ margin: '28px 0 18px' }}>
              <Txt s="cta" k="title">Your residence is waiting</Txt>
            </h2>
            <Txt s="cta" k="body" as="p" className="fs-lead" multiline>
              Book directly with Faysha for your digital key before arrival and a welcome ritual on us.
            </Txt>
            <Link to="/residences" className="fs-btn fs-btn--gold fs-btn--lg" style={{ marginTop: 40 }}>
              {t('nav.book')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
