/** Small presentational pieces shared by the site's pages. */

export function Monogram({ size = 40, stroke = 1.5, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className} style={style}>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth={stroke} />
      <path d="M14 10v19h13M18.5 10v14.5H27" fill="none" stroke="currentColor" strokeWidth={stroke + 0.1} />
    </svg>
  );
}

const PATHS = {
  home: 'M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6',
  key: 'M12 12h9M18 12v3M21 12v2',
  heart: 'M12 21c-5-3-8-7-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 4-3 8-8 11z',
  chat: 'M4 5h16v11H9l-5 4z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3',
  globe: 'M2 12h20',
  calendar: 'M4 10h16M9 3v4M15 3v4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
};

export function Icon({ name, size = 24, stroke = 1.3, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {name === 'key' && <circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={stroke} />}
      {name === 'lock' && <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth={stroke} />}
      {name === 'globe' && (
        <>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={stroke} />
          <ellipse cx="12" cy="12" rx="4" ry="10" fill="none" stroke="currentColor" strokeWidth={stroke} />
        </>
      )}
      {name === 'calendar' && <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth={stroke} />}
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A residence photo, or the dashboard-style striped placeholder until staff upload one. */
export function ResidenceImage({ src, name, children }) {
  if (src) {
    return (
      <>
        <img src={src} alt={name} loading="lazy" />
        {children}
      </>
    );
  }
  return (
    <div className="fs-ph" style={{ position: 'absolute', inset: 0 }}>
      <Monogram size={64} stroke={1} style={{ color: 'var(--gold)', opacity: 0.35 }} />
      <span className="fs-ph__label">{name}</span>
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="fs-loading" role="status">
      {label}…
    </div>
  );
}
