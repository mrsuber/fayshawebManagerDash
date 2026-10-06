import { useEffect, type CSSProperties } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LAST_PAGE_KEY } from '../App';
import { PAGES, SIDE, TOP, isPageId } from '../data/pages';
import { Icon } from './ui';

export default function Layout() {
  const { pathname } = useLocation();
  const seg = pathname.split('/')[1];
  const page = isPageId(seg) ? seg : 'guest360';
  const cur = PAGES[page];

  useEffect(() => {
    try {
      localStorage.setItem(LAST_PAGE_KEY, page);
    } catch {
      /* storage unavailable */
    }
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 18px' }}>
          <Icon name="spa" size={34} color="var(--gold)" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span className="serif" style={{ fontSize: 28, letterSpacing: 1, color: '#f3ede2' }}>
              FAY OS
            </span>
            <span style={{ fontSize: 11, letterSpacing: 5, color: 'var(--gold)', marginTop: 4 }}>FAYSHA</span>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', flex: 1, overflow: 'auto' }}>
          {SIDE.map((id) => {
            const on = id === page;
            return (
              <Link key={id} to={`/${id}`} className={`nav-item${on ? ' on' : ' hov-nav'}`} aria-current={on ? 'page' : undefined}>
                <Icon name={PAGES[id].icon} size={22} color={on ? 'var(--gold)' : '#d8d1c4'} />
                <span>{PAGES[id].label}</span>
              </Link>
            );
          })}
        </nav>
        <div
          className="ph"
          style={{
            position: 'relative',
            height: 210,
            marginTop: 8,
            background: 'repeating-linear-gradient(135deg,#141820 0 10px,#10131a 10px 20px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '18px 20px',
          }}
        >
          <span style={{ position: 'absolute', top: 12, left: 16, fontFamily: 'monospace', fontSize: 10, color: 'var(--faint)' }}>resort at dusk photo</span>
          <span className="serif" style={{ fontSize: 20, lineHeight: 1.15, color: '#f3ede2' }}>
            Faysha
            <br />
            Wellness Residence
          </span>
          <span className="serif" style={{ fontSize: 17, color: '#c9c1b2', marginTop: 6, lineHeight: 1.2 }}>
            One destination.
            <br />
            Endless serenity.
          </span>
        </div>
      </aside>

      <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg,rgba(10,12,15,.2),#0a0c0f 100%),repeating-linear-gradient(135deg,#151a22 0 12px,#11151c 12px 24px)',
          }}
        >
          <span style={{ position: 'absolute', right: 24, bottom: 12, fontFamily: 'monospace', fontSize: 10, color: '#4f5562' }}>hero photo: resort pool at dusk</span>
          <header style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <nav style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
              {TOP.map(([label, id, group]) => (
                <Link key={label} to={`/${id}`} className={`top-item hov-gold-text${group.includes(page) ? ' on' : ''}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <Icon name="search" size={26} style={{ padding: 8, cursor: 'pointer' }} />
            <div style={{ position: 'relative', padding: 8, cursor: 'pointer' }}>
              <Icon name="notifications" size={26} />
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--red)',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                3
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  border: '2px solid var(--gold)',
                  background: 'repeating-linear-gradient(135deg,#2a2520 0 4px,#221e1a 4px 8px)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: 17 }}>FAY</span>
                <span style={{ fontSize: 13, color: '#b9b2a5' }}>AI Concierge</span>
              </div>
            </div>
          </header>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, padding: '22px 24px 20px', flexWrap: 'wrap' }}>
            <div>
              <h1 className="serif" style={{ margin: 0, fontWeight: 600, fontSize: 46, lineHeight: 1, color: '#f6f0e4' }}>
                {cur.title}
              </h1>
              <p className="serif" style={{ margin: '8px 0 0', fontSize: 21, color: '#d9d2c4' }}>
                {cur.sub}
              </p>
            </div>
            <p className="serif" style={{ margin: 0, fontSize: 22, textAlign: 'right', color: '#f0e9dc', maxWidth: 360, textWrap: 'balance' } as CSSProperties}>
              {cur.tag}
            </p>
          </div>
        </div>
        <div style={{ padding: '4px 24px 32px', minWidth: 0 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
