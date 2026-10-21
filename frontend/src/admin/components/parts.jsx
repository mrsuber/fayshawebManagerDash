import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '../../manager/components/ui';

/** HQ session: who is signed in, what they can open, and the property in focus. */
export const HqContext = createContext(null);
export const useHq = () => useContext(HqContext);

export const money = (n, currency = 'XAF') => `${Math.round(Number(n) || 0).toLocaleString('en-US')} ${currency}`;
export const compact = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)}k`;
  return String(Math.round(v));
};
export const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const shiftDays = (iso, n) => {
  const [y, m, dd] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, dd + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Loads data with `fn`, re-running when `deps` change. Returns { data, error, loading, reload, setData }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const reload = useCallback(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn()
      .then((data) => n === seq.current && setState({ data, error: null, loading: false }))
      .catch((error) => n === seq.current && setState((s) => ({ ...s, error, loading: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="hq-empty" role="status">
      {label}…
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card" role="alert" style={{ borderColor: 'rgba(255,107,107,.45)', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Icon name="error" color="var(--red-soft)" />
      <span style={{ flex: 1 }}>{error.message || String(error)}</span>
      {onRetry && (
        <button type="button" className="fay-btn-outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, hero, icon, trend }) {
  return (
    <div className={`hq-stat${hero ? ' hq-stat--hero' : ''}`}>
      <span className="hq-stat__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={16} color="var(--gold)" />}
        {label}
      </span>
      <span className="hq-stat__value">{value}</span>
      {(sub || trend != null) && (
        <span className="hq-stat__sub">
          {trend != null && <Trend value={trend} />} {sub}
        </span>
      )}
    </div>
  );
}

export function Trend({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={up ? 'hq-up' : 'hq-down'}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

const PILL = {
  active: 'green', completed: 'green', approved: 'green', confirmed: 'green', checked_in: 'green',
  pending: 'gold', processing: 'gold', opening: 'gold', checked_out: 'blue',
  inactive: 'red', rejected: 'red', failed: 'red', cancelled: 'red', refunded: 'blue', suspended: 'red',
};
export function Pill({ children, tone }) {
  const t = tone || PILL[String(children).toLowerCase().replace(/\s/g, '_')];
  return <span className={`hq-pill${t ? ` hq-pill--${t}` : ''}`}>{String(children).replace(/_/g, ' ')}</span>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`tab${value === id ? ' on' : ''}`}
          onClick={() => onChange(id)}
          style={{ background: 'none', border: 0, borderBottom: '2px solid transparent', font: 'inherit', cursor: 'pointer' }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, title, subtitle, onClose, children, actions, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="hq-dialog-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`hq-dialog${wide ? ' hq-dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>
              {title}
            </div>
            {subtitle && <div className="sub" style={{ marginTop: 6, fontSize: 13 }}>{subtitle}</div>}
          </div>
          <button type="button" className="mini-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {actions && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Daily bars for one measure (revenue). One series, so no legend: the card title names it.
 * Thin bars with a 2px gap, rounded data ends, recessive grid, a tooltip per bar.
 */
export function DailyBars({ rows, value = (r) => r.total, label = (r) => r.day, format = money, height = 220, detail }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const W = 720;
  const H = height;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const max = Math.max(1, ...rows.map(value));
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / p) * p;
  })();
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / Math.max(rows.length, 1);
  const bw = Math.max(2, Math.min(28, slot - 2));
  // With nothing yet (or tiny values) a half-way tick would just repeat a rounded label.
  const ticks = (nice < 2 ? [0, 1] : [0, 0.5, 1]).map((f) => nice * f);
  const every = Math.ceil(rows.length / 8);
  const tip = hover != null ? rows[hover] : null;

  return (
    <div className="hq-chart" ref={box} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily values, highest ${format(max)}`}>
        {ticks.map((tv) => {
          const y = pad.t + ih - (tv / nice) * ih;
          return (
            <g key={tv}>
              <line className="grid" x1={pad.l} x2={W - pad.r} y1={y} y2={y} />
              <text className="axis" x={pad.l - 8} y={y + 4} textAnchor="end">
                {compact(tv)}
              </text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          const v = value(r);
          const h = Math.max(v > 0 ? 2 : 0, (v / nice) * ih);
          const x = pad.l + i * slot + (slot - bw) / 2;
          const y = pad.t + ih - h;
          const rad = Math.min(4, bw / 2, h);
          return (
            <g key={label(r)} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${label(r)}: ${format(v)}`}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
              {h > 0 && (
                <path
                  className={`bar${hover != null && hover !== i ? ' dim' : ''}`}
                  d={`M${x},${y + h}V${y + rad}Q${x},${y} ${x + rad},${y}H${x + bw - rad}Q${x + bw},${y} ${x + bw},${y + rad}V${y + h}Z`}
                />
              )}
              {i % every === 0 && (
                <text className="axis" x={x + bw / 2} y={H - 6} textAnchor="middle">
                  {label(r).slice(5).replace('-', '/')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tip && box.current && (
        <div className="hq-tip" style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`, top: `${((pad.t + ih - (value(tip) / nice) * ih) / H) * 100}%` }}>
          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{new Date(`${label(tip)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div style={{ fontWeight: 500 }}>{format(value(tip))}</div>
          {detail && <div style={{ marginTop: 4, color: 'var(--text-3)' }}>{detail(tip)}</div>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a breakdown (one hue — magnitude only), value labels on the right. */
export function HBars({ items, format = money }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="hq-empty">Nothing in this period yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((i) => (
        <div key={i.label} className="hq-hbar" title={`${i.label}: ${format(i.value)}`}>
          <span style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
          <span className="hq-hbar__track">
            <span className="hq-hbar__fill" style={{ display: 'block', width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="hq-num">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}
