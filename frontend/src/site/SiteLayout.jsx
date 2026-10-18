import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Footer from './components/Footer';
import Header from './components/Header';
import { useLang } from './i18n';
import './site.css';

/** Pages with a full-bleed hero lay the header over it. */
const OVER = ['/', '/wellness'];

export default function SiteLayout() {
  const { pathname, hash } = useLocation();
  const { t, lang } = useLang();

  useEffect(() => {
    document.body.classList.add('fs-body');
    return () => document.body.classList.remove('fs-body');
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // New page → top; /#section → that section once it has rendered.
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const t0 = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return () => clearTimeout(t0);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  return (
    <div className="fs">
      <a className="fs-skip" href="#main">
        {t('nav.skip')}
      </a>
      <Header over={OVER.includes(pathname)} />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
