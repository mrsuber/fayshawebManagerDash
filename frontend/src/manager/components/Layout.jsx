import { Dialog } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PAGES, SIDE, TOP, href, isPageId, pageOf } from '../data/pages';
import { LanguageMenu, NotificationsMenu, UserMenu } from './HeaderMenus';
import { Icon } from './ui';

export const LAST_PAGE_KEY = 'fayos.page';

/**
 * The FAY OS shell. On wide screens: sidebar, top navigation and a large page heading. Below 1100px the sidebar
 * becomes a drawer opened from the menu button, the top navigation a single scrolling row, and the heading compact.
 */
export default function Layout() {
  const { pathname } = useLocation();
  const seg = pageOf(pathname);
  const page = isPageId(seg) ? seg : 'guest360';
  const { t } = useTranslation();
  const [drawer, setDrawer] = useState(false);
  const [finder, setFinder] = useState(false);
  const topNav = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_PAGE_KEY, page);
    } catch {
      /* storage unavailable */
    }
    window.scrollTo(0, 0);
    setDrawer(false);
    // Keep the current section visible in the scrolling top navigation.
    topNav.current?.querySelector('.top-item.on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [page]);

  // Ctrl/⌘ + K opens the page finder; Escape closes the drawer.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setFinder(true);
      }
      if (e.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`shell${drawer ? ' shell--drawer' : ''}`}>
      <div className="shell-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />
      <aside className="sidebar" aria-label="FAY OS sections">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 18px' }}>
          <Icon name="spa" size={34} color="var(--gold)" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, flex: 1 }}>
            <span className="serif" style={{ fontSize: 28, letterSpacing: 1, color: '#f3ede2' }}>
              FAY OS
            </span>
            <span style={{ fontSize: 11, letterSpacing: 5, color: 'var(--gold)', marginTop: 4 }}>FAYSHA</span>
          </div>
          <button type="button" className="shell-close" onClick={() => setDrawer(false)} aria-label="Close menu">
            <Icon name="close" size={24} />
          </button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', flex: 1, overflow: 'auto' }}>
          {SIDE.map((id) => {
            const on = id === page;
            return (
              <Link key={id} to={href(id)} className={`nav-item${on ? ' on' : ' hov-nav'}`} aria-current={on ? 'page' : undefined}>
                <Icon name={PAGES[id].icon} size={22} color={on ? 'var(--gold)' : '#d8d1c4'} />
                <span>{t(`pages.${id}.label`)}</span>
              </Link>
            );
          })}
          <a href="/work" className="nav-item hov-nav" title="Work assigned to you">
            <Icon name="task_alt" size={22} color="#d8d1c4" />
            <span>My work</span>
          </a>
        </nav>
        <div className="sidebar-foot">
          <span className="serif" style={{ fontSize: 20, lineHeight: 1.15, color: '#f3ede2' }}>
            Faysha
            <br />
            Wellness Residence
          </span>
          <span className="serif" style={{ fontSize: 17, color: '#c9c1b2', marginTop: 6, lineHeight: 1.2 }}>
            {t('layout.tagline1')}
            <br />
            {t('layout.tagline2')}
          </span>
        </div>
      </aside>

      <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="shell-top">
          <header className="shell-header">
            <button type="button" className="shell-menu" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
              <Icon name="menu" size={26} />
            </button>
            <nav ref={topNav} className="shell-topnav" aria-label="Areas">
              {TOP.map(([key, id, group]) => (
                <Link key={key} to={href(id)} className={`top-item hov-gold-text${group.includes(page) ? ' on' : ''}`}>
                  {t(`nav.${key}`)}
                </Link>
              ))}
            </nav>
            <button type="button" className="shell-icon-btn" onClick={() => setFinder(true)} aria-label="Find a page (Ctrl+K)" title="Find a page (Ctrl+K)">
              <Icon name="search" size={26} />
            </button>
            <LanguageMenu />
            <NotificationsMenu />
            <UserMenu />
          </header>
          <div className="shell-head">
            <div style={{ minWidth: 0 }}>
              <h1 className="serif shell-title">{t(`pages.${page}.title`)}</h1>
              <p className="serif shell-sub">{t(`pages.${page}.sub`)}</p>
            </div>
            <p className="serif shell-tag">{t(`pages.${page}.tag`)}</p>
          </div>
        </div>
        <div className="shell-body">
          <Outlet />
        </div>
      </main>
      <PageFinder open={finder} onClose={() => setFinder(false)} />
    </div>
  );
}

/** A quick way to any page: type part of its name, Enter opens the first match. */
function PageFinder({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const query = q.trim().toLowerCase();
  const matches = SIDE.filter((id) => !query || `${t(`pages.${id}.label`)} ${t(`pages.${id}.sub`)}`.toLowerCase().includes(query));
  const go = (id) => {
    onClose();
    navigate(href(id));
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { alignSelf: 'flex-start', mt: '12vh' } } }}>
      <div style={{ padding: 14 }}>
        <label className="kit-search" style={{ padding: '12px 14px' }}>
          <Icon name="search" size={20} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && matches[0] && go(matches[0])} placeholder="Go to… (reservations, lockers, events)" aria-label="Find a page" />
        </label>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: 8 }}>
          {matches.map((id) => (
            <button key={id} type="button" className="kit-row" onClick={() => go(id)}>
              <Icon name={PAGES[id].icon} size={22} color="var(--gold)" />
              <div className="kit-row__main">
                <span className="kit-row__title">{t(`pages.${id}.label`)}</span>
                <span className="kit-row__meta">{t(`pages.${id}.sub`)}</span>
              </div>
            </button>
          ))}
          {!matches.length ? <span className="sub" style={{ padding: 12, display: 'block' }}>No page matches “{q}”.</span> : null}
        </div>
      </div>
    </Dialog>
  );
}
