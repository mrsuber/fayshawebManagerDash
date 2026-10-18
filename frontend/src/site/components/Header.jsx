import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';
import { Icon, Monogram } from './ui';

const NAV = [
  ['/residences', 'nav.residences'],
  ['/wellness', 'nav.wellness'],
  ['/#dining', 'nav.dining'],
  ['/#app', 'nav.app'],
  ['/about', 'nav.about'],
  ['/contact', 'nav.contact'],
];

/** Site header. `over` lays it transparently over a full-bleed hero. */
export default function Header({ over = false }) {
  const { t, lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  const toggleLang = () => setLang(lang === 'fr' ? 'en' : 'fr');

  return (
    <header className={`fs-header${over ? ' fs-header--over' : ''}${open ? ' menu-open' : ''}`}>
      <div className="fs-container">
        <div className="fs-header__inner">
          <Link to="/" className="fs-brand" aria-label="Faysha home">
            <Monogram size={40} style={{ color: 'var(--gold)' }} />
            <span className="fs-brand__word">
              <span className="fs-brand__name">FAYSHA</span>
              <span className="fs-brand__sub">{t('brand.sub').toUpperCase()}</span>
            </span>
          </Link>

          <nav className="fs-nav" aria-label="Main">
            {NAV.map(([to, key]) =>
              to.includes('#') ? (
                <Link key={to} to={to}>
                  {t(key)}
                </Link>
              ) : (
                <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  {t(key)}
                </NavLink>
              ),
            )}
          </nav>

          <div className="fs-header__actions">
            <button type="button" className="fs-quiet fs-hide-sm" onClick={toggleLang} aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}>
              <span style={{ color: lang === 'en' ? 'var(--gold)' : undefined }}>EN</span>&nbsp;/&nbsp;
              <span style={{ color: lang === 'fr' ? 'var(--gold)' : undefined }}>FR</span>
            </button>
            <Link to="/login" className="fs-quiet fs-hide-md">
              {t('nav.signin')}
            </Link>
            <Link to="/residences" className="fs-btn fs-btn--gold fs-hide-sm">
              {t('nav.book')}
            </Link>
            <button
              type="button"
              className="fs-menu-btn"
              aria-label={t('nav.menu')}
              aria-expanded={open}
              aria-controls="fs-mobile-nav"
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? 'close' : 'menu'} size={20} stroke={1.6} />
            </button>
          </div>
        </div>

        <nav id="fs-mobile-nav" className={`fs-mobile-nav${open ? ' open' : ''}`} aria-label="Mobile">
          {NAV.map(([to, key]) => (
            <Link key={to} to={to}>
              {t(key)}
            </Link>
          ))}
          <Link to="/login">{t('nav.signin')}</Link>
          <button type="button" onClick={toggleLang}>
            {lang === 'fr' ? 'English' : 'Français'}
          </button>
          <Link to="/residences" className="fs-btn fs-btn--gold" style={{ marginTop: 16, borderBottom: 0, justifyContent: 'center' }}>
            {t('nav.book')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
