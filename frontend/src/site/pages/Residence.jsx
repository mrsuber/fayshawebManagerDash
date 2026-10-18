import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAvailability, getResidences, getUnitMedia } from '../api';
import PanoramaDialog from '../components/PanoramaDialog';
import { residenceMeta } from '../components/ResidenceCard';
import { Icon, Loading, ResidenceImage } from '../components/ui';
import { CHECK_IN_TIME, CHECK_OUT_TIME, IMG } from '../data';
import { addDays, money, nightsBetween, stayFromParams, stayQuery, today } from '../format';
import { plural, useLang } from '../i18n';
import { withAvailability } from './Residences';

export default function Residence() {
  const { id } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stay = stayFromParams(params);
  const [residences, setResidences] = useState(null);
  const [units, setUnits] = useState(null);
  const [media, setMedia] = useState([]);
  const [error, setError] = useState('');
  const [tour, setTour] = useState(false);

  useEffect(() => {
    getResidences().then(setResidences).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    getAvailability(stay.checkIn, stay.checkOut).then(setUnits).catch((e) => setError(e.message));
  }, [stay.checkIn, stay.checkOut]);

  const r = useMemo(() => {
    if (!residences || !units) return null;
    return withAvailability(residences, units, stay.guests).find((x) => String(x.id) === String(id)) || false;
  }, [residences, units, id, stay.guests]);

  const anyUnitId = units?.find((u) => String(u.categoryId) === String(id))?.id;
  useEffect(() => {
    if (anyUnitId) getUnitMedia(anyUnitId).then(setMedia).catch(() => setMedia([]));
  }, [anyUnitId]);

  if (error) return <div className="fs-container fs-section"><div className="fs-alert fs-alert--error">{error}</div></div>;
  if (r === null) return <Loading label={t('common.loading')} />;
  if (r === false) {
    return (
      <div className="fs-container fs-section fs-empty">
        <p>This residence could not be found.</p>
        <Link to="/residences" className="fs-btn fs-btn--ghost">{t('nav.residences')}</Link>
      </div>
    );
  }

  const photos = media.filter((m) => m.type === 'image');
  const panorama = media.find((m) => m.type === 'panorama_360')?.url || units.find((u) => u.categoryId === r.id && u.panorama)?.panorama;
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const unit = r.freeUnits[0];
  const setStay = (patch) => {
    const next = { ...stay, ...patch };
    if (next.checkOut <= next.checkIn) next.checkOut = addDays(next.checkIn, 1);
    setParams(stayQuery(next), { replace: true });
  };
  const tiles = photos.slice(panorama ? 0 : 1, panorama ? 4 : 5);

  return (
    <>
      <div className="fs-container fs-crumbs">
        <Link to={`/residences?${stayQuery(stay)}`}>{t('nav.residences')}</Link> <span aria-hidden="true">/</span> {r.name}
      </div>

      <section className="fs-container" style={{ paddingTop: 20 }}>
        <div className="fs-gallery">
          {panorama ? (
            <div className="fs-tour">
              <Icon name="globe" size={70} stroke={0.8} className="fs-gold" />
              <span className="fs-h3" style={{ letterSpacing: 2 }}>Step inside</span>
              <button type="button" className="fs-btn fs-btn--gold" onClick={() => setTour(true)}>
                {t('res.startTour')}
              </button>
            </div>
          ) : (
            <div>
              <ResidenceImage src={photos[0]?.url || r.image} name={r.name} />
            </div>
          )}
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              {tiles[i] ? (
                <img src={tiles[i].url} alt={tiles[i].title || r.name} loading="lazy" />
              ) : i === 3 ? (
                <img src={IMG.spa} alt="The Faysha spa, included with every stay" loading="lazy" />
              ) : (
                <ResidenceImage src={null} name={r.name} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="fs-container fs-section" style={{ paddingTop: 56 }}>
        <div className="fs-detail">
          <div className="fs-detail__main">
            <div>
              <p className="fs-kicker">{t('res.kicker')}</p>
              <h1 className="fs-h1">{r.name}</h1>
              <div className="fs-facts" style={{ marginTop: 26 }}>
                {residenceMeta(r, t).split(' · ').map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              {r.description && (
                <p className="fs-lead" style={{ marginTop: 30, maxWidth: 680, fontSize: 17 }}>
                  {r.description}
                </p>
              )}
            </div>

            {r.features.length > 0 && (
              <div>
                <h2 className="fs-h3" style={{ marginBottom: 24 }}>{t('res.inside')}</h2>
                <ul className="fs-dot-list">
                  {r.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.amenities.length > 0 && (
              <div>
                <h2 className="fs-h3" style={{ marginBottom: 24 }}>{t('res.includes')}</h2>
                <ul className="fs-dot-list">
                  {r.amenities.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="fs-info-grid">
              <div className="fs-card fs-info">
                <div className="fs-info__k">{t('res.checkin')}</div>
                <div className="fs-info__v">{CHECK_IN_TIME}</div>
                <div className="fs-info__s">{t('res.selfcheckin')}</div>
              </div>
              <div className="fs-card fs-info">
                <div className="fs-info__k">{t('res.checkout')}</div>
                <div className="fs-info__v">{CHECK_OUT_TIME}</div>
                <div className="fs-info__s">{t('res.leave')}</div>
              </div>
              <div className="fs-card fs-info">
                <div className="fs-info__k">{t('res.cancel')}</div>
                <div className="fs-info__v">{t('res.cancelV')}</div>
                <div className="fs-info__s">
                  {t('res.cancelS')} <Link to="/terms">{t('res.readterms')}</Link>
                </div>
              </div>
            </div>
          </div>

          <aside className="fs-card fs-card--gold fs-aside" aria-label={t('res.reserve')}>
            <div>
              <span className="fs-price" style={{ fontSize: 32 }}>{money(unit ? unit.price : r.price)}</span>
              <span className="fs-muted" style={{ fontSize: 13 }}> {t('price.night')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <label className="fs-field">
                {t('bar.checkin')}
                <input className="fs-input" type="date" min={today()} value={stay.checkIn} onChange={(e) => e.target.value && setStay({ checkIn: e.target.value })} style={{ colorScheme: 'dark' }} />
              </label>
              <label className="fs-field">
                {t('bar.checkout')}
                <input className="fs-input" type="date" min={addDays(stay.checkIn, 1)} value={stay.checkOut} onChange={(e) => e.target.value && setStay({ checkOut: e.target.value })} style={{ colorScheme: 'dark' }} />
              </label>
              <label className="fs-field" style={{ gridColumn: 'span 2' }}>
                {t('bar.guests')}
                <select className="fs-input" value={stay.guests} onChange={(e) => setStay({ guests: Number(e.target.value) })}>
                  {Array.from({ length: Math.max(r.maxGuests, stay.guests) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {plural(t, n, 'guest.one', 'guest.many')}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {unit ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                  <div className="fs-sum-row">
                    <span>
                      {money(unit.price)} × {plural(t, nights, 'night.one', 'night.many')}
                    </span>
                    <span>{money(unit.price * nights)}</span>
                  </div>
                  <div className="fs-sum-row fs-sum-total">
                    <span style={{ fontWeight: 500 }}>{t('price.total')}</span>
                    <span className="fs-price" style={{ fontSize: 22 }}>{money(unit.price * nights)}</span>
                  </div>
                </div>
                <button type="button" className="fs-btn fs-btn--gold fs-btn--lg fs-btn--block" onClick={() => navigate(`/book?unit=${unit.id}&${stayQuery(stay)}`)}>
                  {t('res.reserve')}
                </button>
                <p className="fs-muted" style={{ margin: 0, textAlign: 'center', fontSize: 12 }}>{t('res.nocharge')}</p>
              </>
            ) : (
              <div className="fs-alert">{r.fits ? t('res.soldout') : t('res.none')}</div>
            )}
          </aside>
        </div>
      </section>

      <PanoramaDialog open={tour} image={panorama} title={r.name} onClose={() => setTour(false)} />
    </>
  );
}
