import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export function Icon({ name, size = 24, color, style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span className="icon" style={{ fontSize: size, color, ...style }}>
      {name}
    </span>
  );
}

/** Placeholder link used for "View All ›" style actions until routes exist. */
export function CardLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <a
      href="#"
      className="card-link"
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}

type CardProps = {
  title?: ReactNode;
  /** Text for the header link, e.g. "View All ›". */
  link?: ReactNode;
  /** Arbitrary content on the right of the header (overrides link). */
  aside?: ReactNode;
  /** Space between the header and the first child. */
  headGap?: number;
  titleSize?: number;
  gap?: number;
  padding?: number | string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Card({ title, link, aside, headGap, titleSize, gap = 10, padding, style, children }: CardProps) {
  const right = aside ?? (link ? <CardLink>{link}</CardLink> : null);
  const titleStyle = titleSize ? { fontSize: titleSize } : undefined;
  return (
    <section className="card" style={{ gap, padding, ...style }}>
      {title != null &&
        (right ? (
          <div className="card-head" style={headGap ? { marginBottom: headGap } : undefined}>
            <span className="card-title" style={titleStyle}>
              {title}
            </span>
            {right}
          </div>
        ) : (
          <span className="card-title" style={{ ...titleStyle, marginBottom: headGap }}>
            {title}
          </span>
        ))}
      {children}
    </section>
  );
}

export function Badge({ bg, color, children, style }: { bg?: string; color?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, background: bg, color, ...style }}>{children}</span>
  );
}

export function Placeholder({
  label,
  stripe = 8,
  style,
  labelSize = 10,
  children,
}: {
  label?: string;
  stripe?: number;
  style?: CSSProperties;
  labelSize?: number;
  children?: ReactNode;
}) {
  return (
    <div className="ph" style={{ ['--s' as string]: `${stripe}px`, ...style }}>
      {label && (
        <span className="mono-label" style={{ fontSize: labelSize }}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export function Avatar({ size = 36, stripe = 4, style }: { size?: number; stripe?: number; style?: CSSProperties }) {
  return <span className="ph-avatar" style={{ width: size, height: size, ['--s' as string]: `${stripe}px`, ...style }} />;
}

const TOGGLE_SIZES = { sm: [36, 20, 16], md: [38, 22, 18], lg: [42, 24, 20] } as const;

export function Toggle({ on, onClick, size = 'md', label }: { on: boolean; onClick: () => void; size?: keyof typeof TOGGLE_SIZES; label?: string }) {
  const [w, h, k] = TOGGLE_SIZES[size];
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={onClick} style={{ width: w, height: h }}>
      <span style={{ width: k, height: k }} />
    </button>
  );
}

export function Bar({ value, color = 'var(--gold)', height = 6, style }: { value: string; color?: string; height?: number; style?: CSSProperties }) {
  return (
    <div className="bar" style={{ height, borderRadius: height / 2, ...style }}>
      <div style={{ width: value, background: color }} />
    </div>
  );
}

export function Donut({ size, inner, gradient, children }: { size: number; inner: number; gradient: string; children?: ReactNode }) {
  return (
    <div className="donut" style={{ width: size, height: size, background: gradient }}>
      <div style={{ width: inner, height: inner }}>{children}</div>
    </div>
  );
}

/** Builds a conic-gradient from [color, percent] segments. */
export function conic(segments: [string, number][]) {
  let at = 0;
  const parts = segments.map(([c, p], i) => {
    const from = at;
    at += p;
    return i === segments.length - 1 ? `${c} ${from}%` : `${c} ${from}% ${at}%`;
  });
  return `conic-gradient(${parts.join(',')})`;
}

export function Chip({ on, onClick, children, style }: { on: boolean; onClick?: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className={`chip${on ? ' on' : ''}`} onClick={onClick} style={style}>
      {children}
    </span>
  );
}

export function Dot({ color, size = 10, radius = '50%' }: { color: string; size?: number; radius?: string | number }) {
  return <span style={{ width: size, height: size, borderRadius: radius, background: color, flexShrink: 0 }} />;
}

export function LegendItem({ color, children, radius }: { color: string; children: ReactNode; radius?: string | number }) {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <Dot color={color} radius={radius} />
      {children}
    </span>
  );
}

export type KpiData = { icon: string; c: string; n: ReactNode; l: string; d?: string; dc?: string };

export function KpiGrid({
  items,
  min = 170,
  iconSize = 34,
  numSize,
  padding,
  gap,
  labelSize,
  deltaSize,
}: {
  items: KpiData[];
  min?: number;
  iconSize?: number;
  numSize?: number;
  padding?: number;
  gap?: number;
  labelSize?: number;
  deltaSize?: number;
}) {
  return (
    <div className="kpis" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))` }}>
      {items.map((k) => (
        <div key={k.l} className="kpi" style={{ padding, gap }}>
          <Icon name={k.icon} size={iconSize} color={k.c} />
          <div className="col">
            <span className="kpi-n" style={numSize ? { fontSize: numSize } : undefined}>
              {k.n}
            </span>
            <span className="kpi-l" style={labelSize ? { fontSize: labelSize } : undefined}>
              {k.l}
            </span>
            {k.d && <span style={{ fontSize: deltaSize ?? 12, color: k.dc ?? 'var(--green-bright)' }}>{k.d}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export type QuickItem = { icon: string; c: string; l: string };

export function QuickActions({
  items,
  cols = 3,
  iconSize = 24,
  variant = 'border',
  fontSize,
  padding,
  gap,
}: {
  items: QuickItem[];
  cols?: number;
  iconSize?: number;
  variant?: 'border' | 'fill';
  fontSize?: number;
  padding?: string;
  gap?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 8 }}>
      {items.map((q) => (
        <div key={q.l} className={`quick ${variant === 'fill' ? 'hov-quick' : 'hov-border-gold'}`} style={{ fontSize, padding, gap }}>
          <Icon name={q.icon} size={iconSize} color={q.c} />
          {q.l}
        </div>
      ))}
    </div>
  );
}

/** Icon + title/description row used in many list cards. */
export function IconRow({
  icon,
  color,
  title,
  desc,
  iconSize = 22,
  gap = 12,
  padding = '6px 0',
  titleSize = 14,
  line = true,
  align = 'center',
  right,
}: {
  icon: string;
  color?: string;
  title: ReactNode;
  desc?: ReactNode;
  iconSize?: number;
  gap?: number;
  padding?: string;
  titleSize?: number;
  line?: boolean;
  align?: 'center' | 'flex-start';
  right?: ReactNode;
}) {
  return (
    <div className={line ? 'row-line' : undefined} style={{ display: 'flex', gap, alignItems: align, padding }}>
      <Icon name={icon} size={iconSize} color={color} />
      <div className="col" style={{ flex: 1 }}>
        <span style={{ fontSize: titleSize }}>{title}</span>
        {desc != null && <span className="sub">{desc}</span>}
      </div>
      {right}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</div>
      {children}
    </div>
  );
}

/** Image card with striped placeholder, used for recommendations/packages/offers. */
export function MediaCard({ img, imgHeight = 70, children, bodyGap = 4, bodyPadding = 8 }: { img?: string; imgHeight?: number; children: ReactNode; bodyGap?: number; bodyPadding?: number | string }) {
  return (
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Placeholder label={img} labelSize={9} style={{ height: imgHeight, padding: img ? 5 : undefined }} />
      <div className="col" style={{ padding: bodyPadding, gap: bodyGap, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function VenueTile({ img, n, d, height }: { img: string; n: string; d: string; height: number }) {
  return (
    <div
      className="ph hov-border-gold"
      style={{
        ['--s' as string]: '10px',
        height,
        borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 14,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span className="mono-label" style={{ position: 'absolute', top: 10, left: 12 }}>
        {img}
      </span>
      <span className="serif" style={{ fontSize: 22, fontWeight: 600 }}>
        {n}
      </span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{d}</span>
        <span
          className="icon"
          style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
        >
          arrow_forward
        </span>
      </div>
    </div>
  );
}
