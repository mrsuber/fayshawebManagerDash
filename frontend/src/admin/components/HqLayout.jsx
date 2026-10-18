import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../../manager/components/ui';
import { itemFor, visibleNav } from '../nav';
import { useHq } from './parts';

function Monogram({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 10v19h13M18.5 10v14.5H27" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function HqLayout() {
  const { me, property, properties, setProperty, counts } = useHq();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const item = itemFor(pathname);
  const groups = visibleNav(me);

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="HQ navigation">
        <Link to="/admin" className="hq-brand" aria-label="Faysha HQ overview">
          <Monogram />
          <span className="hq-brand__word">
            <span className="hq-brand__name">FAYSHA</span>
            <span className="hq-brand__sub">HEADQUARTERS</span>
          </span>
        </Link>
        <nav className="hq-nav">
          {groups.map((g) => (
            <div key={g.group} style={{ display: 'contents' }}>
              <div className="hq-nav__group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={`/admin${i.to ? `/${i.to}` : ''}`}
                  end={!i.to}
                  className={({ isActive }) => `nav-item${isActive ? ' on' : ' hov-nav'}`}
                >
                  <Icon name={i.icon} size={21} color={item?.to === i.to ? 'var(--gold)' : '#d8d1c4'} />
                  <span>{i.label}</span>
                  {i.badge && counts[i.badge] > 0 && <span className="hq-badge" aria-label={`${counts[i.badge]} waiting`}>{counts[i.badge]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '14px 18px 20px', borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {['superadmin', 'manager'].includes(me.user.role) && (
            <Link to="/manager" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spa" size={18} /> Open FAY OS (operations)
            </Link>
          )}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
            <Icon name="public" size={18} /> View the website
          </Link>
        </div>
      </aside>

      <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="hq-top">
          <button type="button" className="mini-btn hq-menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ width: 40, height: 40 }}>
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="domain" size={20} color="var(--gold)" />
            <span className="sub" style={{ fontSize: 12 }}>Property</span>
            <select className="hq-select" value={property ?? ''} onChange={(e) => setProperty(e.target.value ? Number(e.target.value) : null)} aria-label="Property in focus">
              {properties.length > 1 && <option value="">All properties</option>}
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status !== 'active' ? ` (${p.status})` : ''}
                </option>
              ))}
            </select>
          </label>
          <span style={{ flex: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontSize: 14 }}>{me.user.name}</span>
            <span className="sub" style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)' }}>{me.user.roleName}</span>
          </span>
          <Link to="/admin/change-password" className="mini-btn" aria-label="Change password" title="Change password" style={{ width: 40, height: 40 }}>
            <Icon name="key" size={18} />
          </Link>
          <button type="button" className="mini-btn" onClick={signOut} aria-label="Sign out" title="Sign out" style={{ width: 40, height: 40 }}>
            <Icon name="logout" size={18} />
          </button>
        </div>
        {item && (
          <div className="hq-head">
            <div>
              <h1>{item.title}</h1>
              <p>{item.sub}</p>
            </div>
          </div>
        )}
        <div className="hq-body" style={item ? undefined : { paddingTop: 24 }}>
          <Outlet />
        </div>
      </main>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.4)' }} aria-hidden="true" />}
    </div>
  );
}
