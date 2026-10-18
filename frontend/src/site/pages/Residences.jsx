import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAvailability, getResidences } from '../api';
import BookingBar from '../components/BookingBar';
import { residenceMeta } from '../components/ResidenceCard';
import { Loading, ResidenceImage } from '../components/ui';
import { PageContent, Txt } from '../content';
import { money, nightsBetween, prettyDate, stayFromParams, stayQuery } from '../format';
import { plural, useLang } from '../i18n';

/** Joins categories with the units free for the stay: lowest available nightly rate and count per category. */
export function withAvailability(residences, units, guests) {
  return residences.map((r) => {
    const free = units
      .filter((u) => u.categoryId === r.id && u.available && u.maxGuests >= guests)
      .sort((a, b) => a.price - b.price);
    const fits = r.maxGuests >= guests;
    return {
      ...r,
      fits,
      freeUnits: fits ? free : [],
      fromPrice: free.length ? free[0].price : r.price,
      image: r.image || units.find((u) => u.categoryId === r.id && u.image)?.image || null,
    };
  });
}

export default function Residences() {
  return (
    <PageContent pageId="booking">
      <ResidencesBody />
    </PageContent>
  );
}

function ResidencesBody() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stay = stayFromParams(params);
  const [residences, setResidences] = useState(null);
  const [units, setUnits] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(() => {
    getResidences().then(setResidences).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setUnits(null);
    getAvailability(stay.checkIn, stay.checkOut)
      .then(setUnits)
      .catch((e) => setError(e.message));
  }, [stay.checkIn, stay.checkOut]);

  const rows = useMemo(
    () => (residences && units ? withAvailability(residences, units, stay.guests) : null),
    [residences, units, stay.guests],
  );
  const shown = rows ? rows.filter((r) => cat === 'all' || String(r.id) === cat) : [];
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const query = stayQuery(stay);

  const search = ({ type, ...s }) => navigate(type && type !== 'all' ? `/residences/${type}?${stayQuery(s)}` : `/residences?${stayQuery(s)}`);

  return (
    <>
      <section className="fs-container fs-page-head">
        <Txt s="hero" k="kicker" as="p" className="fs-kicker">
          The residences
        </Txt>
        <h1 className="fs-h1">
          <Txt s="hero" k="title">Find your residence</Txt>
        </h1>
        <div style={{ marginTop: 40 }}>
          <BookingBar stay={stay} onSearch={search} solid submitLabel={t('bar.update')} />
        </div>
        {residences && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 36 }}>
            <div className="fs-chips" role="group" aria-label={t('bar.residence')}>
              <button type="button" className="fs-chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
                {t('res.all')}
              </button>
              {residences.map((r) => (
                <button key={r.id} type="button" className="fs-chip" aria-pressed={cat === String(r.id)} onClick={() => setCat(String(r.id))}>
                  {r.name}
                </button>
              ))}
            </div>
            <span className="fs-muted" style={{ fontSize: 13 }}>
              {plural(t, nights, 'night.one', 'night.many')} · {prettyDate(stay.checkIn, { lang })} – {prettyDate(stay.checkOut, { lang })} ·{' '}
              {plural(t, stay.guests, 'guest.one', 'guest.many')}
            </span>
          </div>
        )}
      </section>

      <section className="fs-container" style={{ paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 20 }} aria-live="polite">
        {error && <div className="fs-alert fs-alert--error">{error}</div>}
        {!rows && !error && <Loading label={t('common.loading')} />}
        {rows && shown.length === 0 && <div className="fs-card fs-empty">{t('res.none')}</div>}
        {shown.map((r) => {
          const free = r.freeUnits.length;
          return (
            <article key={r.id} className="fs-res-row">
              <div className="fs-res-row__media">
                <ResidenceImage src={r.image} name={r.name} />
              </div>
              <div className="fs-res-row__body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h2 className="fs-h3" style={{ fontSize: 30 }}>
                      {r.name}
                    </h2>
                    <p className="fs-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                      {residenceMeta(r, t)}
                    </p>
                  </div>
                  <span className={`fs-badge ${free ? 'fs-badge--ok' : 'fs-badge--off'}`} style={{ alignSelf: 'flex-start' }}>
                    {free ? `${free} ${t('res.available')}` : t('res.soldout')}
                  </span>
                </div>
                {r.description && (
                  <p className="fs-lead" style={{ fontSize: 15, maxWidth: 620 }}>
                    {r.description}
                  </p>
                )}
                {r.features.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {r.features.slice(0, 6).map((f) => (
                      <span key={f} className="fs-tag">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap',
                    justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  }}
                >
                  <div>
                    <div>
                      <span className="fs-price" style={{ fontSize: 28 }}>
                        {money(r.fromPrice)}
                      </span>
                      <span className="fs-muted" style={{ fontSize: 13 }}>
                        {' '}
                        {t('price.night')}
                      </span>
                    </div>
                    {free > 0 && nights > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>
                        {money(r.fromPrice * nights)} XAF · {plural(t, nights, 'night.one', 'night.many')}, {t('res.beforetax')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to={`/residences/${r.id}?${query}`} className="fs-btn fs-btn--ghost">
                      {t('res.details')}
                    </Link>
                    {free > 0 && (
                      <Link to={`/book?unit=${r.freeUnits[0].id}&${query}`} className="fs-btn fs-btn--gold">
                        {t('res.reserve')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
