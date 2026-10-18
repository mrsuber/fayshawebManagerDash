import { Link } from 'react-router-dom';
import { money } from '../format';
import { useLang } from '../i18n';
import { ResidenceImage } from './ui';

export function residenceMeta(r, t) {
  const parts = [`${t('res.upto')} ${r.maxGuests} ${t(r.maxGuests === 1 ? 'guest.one' : 'guest.many')}`];
  parts.push(r.bedrooms ? `${r.bedrooms} ${t(r.bedrooms === 1 ? 'res.bed' : 'res.beds')}` : t('res.studio'));
  if (r.bathrooms) parts.push(`${r.bathrooms} ${t(r.bathrooms === 1 ? 'res.bath' : 'res.baths')}`);
  if (r.size) parts.push(`${r.size} m²`);
  return parts.join(' · ');
}

/** Compact card used on the home page. */
export default function ResidenceCard({ residence: r, query = '' }) {
  const { t } = useLang();
  return (
    <Link to={`/residences/${r.id}${query ? `?${query}` : ''}`} className="fs-res-card">
      <div className="fs-res-card__media">
        <ResidenceImage src={r.image} name={r.name} />
      </div>
      <div className="fs-res-card__body">
        <h3 className="fs-h3" style={{ fontSize: 24 }}>
          {r.name}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(236,230,218,.65)' }}>{residenceMeta(r, t)}</p>
        <div className="fs-res-card__foot">
          <span style={{ fontSize: 12, color: 'rgba(236,230,218,.6)' }}>{t('price.from')}</span>
          <span>
            <span className="fs-price" style={{ fontSize: 24 }}>
              {money(r.price)}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(236,230,218,.6)' }}> {t('price.night')}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
