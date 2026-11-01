import moment from 'moment';
import { useState } from 'react';
import { Icon } from './ui';

/**
 * Building blocks for the operational pages added in v2.1 (Enquiries, Events, Assets, Lockers, Content).
 * They share the FAY OS look and are responsive: on a phone a SplitView shows the list, then the detail
 * with a back button.
 */

/** A coloured status label. `tone` is a CSS colour. */
export function Pill({ tone = 'var(--gold)', children, solid = false, style }) {
  return (
    <span
      className="kit-pill"
      style={{
        color: solid ? 'var(--on-gold)' : tone,
        background: solid ? tone : `color-mix(in srgb, ${tone} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <label className="kit-search" style={style}>
      <Icon name="search" size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </label>
  );
}

/** Filter chips with counts: options = [[value, label, count?]]. */
export function Tabs({ options, value, onChange }) {
  return (
    <div className="kit-tabs" role="tablist">
      {options.map(([v, label, count]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
          {count !== undefined && count !== null ? <span className="kit-tabs__n">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * List on the left, detail on the right. On narrow screens only one shows: the list until something is selected,
 * then the detail with a back button (onBack clears the selection).
 */
export function SplitView({ list, detail, hasSelection, onBack, listWidth = 400 }) {
  return (
    <div className={`kit-split ${hasSelection ? 'kit-split--detail' : ''}`} style={{ '--kit-list': `${listWidth}px` }}>
      <section className="card kit-split__list">{list}</section>
      <section className="card kit-split__detail">
        {hasSelection ? (
          <>
            <button type="button" className="kit-back" onClick={onBack}>
              <Icon name="arrow_back" size={18} /> Back
            </button>
            {detail}
          </>
        ) : (
          detail
        )}
      </section>
    </div>
  );
}

export function Empty({ icon = 'inbox', title, children }) {
  return (
    <div className="kit-empty">
      <Icon name={icon} size={40} color="var(--gold)" />
      <span className="serif" style={{ fontSize: 22 }}>{title}</span>
      {children ? <span style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 360 }}>{children}</span> : null}
    </div>
  );
}

/** Row in a list pane. */
export function ListRow({ active, onClick, title, meta, aside, unread, children }) {
  return (
    <button type="button" className={`kit-row ${active ? 'on' : ''}`} onClick={onClick}>
      <div className="kit-row__main">
        <span className="kit-row__title">
          {unread ? <span className="kit-dot" aria-label="New" /> : null}
          {title}
        </span>
        {meta ? <span className="kit-row__meta">{meta}</span> : null}
        {children}
      </div>
      {aside ? <div className="kit-row__aside">{aside}</div> : null}
    </button>
  );
}

/** "3 min ago" with the exact time on hover. */
export function Ago({ at }) {
  if (!at) return null;
  return <time title={moment(at).format('ddd D MMM YYYY, HH:mm')}>{moment(at).fromNow()}</time>;
}

/** A thread of notes / replies / events. items: [{ id, kind, body, author, at }] */
export function Thread({ items }) {
  if (!items?.length) return null;
  return (
    <ol className="kit-thread">
      {items.map((n) => (
        <li key={n.id} className={`kit-thread__item kit-thread__item--${n.kind}`}>
          {n.kind === 'event' ? (
            <span className="kit-thread__event">
              {n.body} · {n.author} · <Ago at={n.at} />
            </span>
          ) : (
            <>
              <div className="kit-thread__head">
                <Icon name={n.kind === 'reply' ? 'reply' : 'sticky_note_2'} size={16} />
                <strong>{n.author}</strong>
                <span>{n.kind === 'reply' ? 'replied by email' : 'internal note'}</span>
                <Ago at={n.at} />
              </div>
              <div className="kit-thread__body">{n.body}</div>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A text box with one or more send actions: actions = [{ label, icon, onSend(text) → Promise, primary? }].
 * Clears on success; shows the error on failure.
 */
export function Composer({ placeholder, actions, rows = 3 }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const run = async (a) => {
    if (!text.trim()) return;
    setBusy(a.label);
    setError('');
    try {
      await a.onSend(text.trim());
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="kit-composer">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={rows} aria-label={placeholder} />
      {error ? <span className="kit-error">{error}</span> : null}
      <div className="kit-composer__actions">
        {actions.map((a) => (
          <button key={a.label} type="button" className={a.primary ? 'btn-gold' : 'fay-btn-outline'} disabled={!text.trim() || !!busy} onClick={() => run(a)}>
            <Icon name={a.icon} size={18} />
            {busy === a.label ? 'Sending…' : a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Label + value pairs in a responsive grid. items: [[label, value]] */
export function Facts({ items }) {
  return (
    <dl className="kit-facts">
      {items
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Page header row: title on the left, actions on the right (wraps on phones). */
export function Toolbar({ children, right }) {
  return (
    <div className="kit-toolbar">
      <div className="kit-toolbar__left">{children}</div>
      {right ? <div className="kit-toolbar__right">{right}</div> : null}
    </div>
  );
}

/**
 * An image chosen by upload: preview, Replace and Remove. `upload(file) → Promise<url>`; `toUrl(url)` builds the
 * preview address. `wide` shows a 2:1 preview (360° panoramas).
 */
export function ImageField({ label, value, onChange, upload, toUrl, hint, wide = false, onPreview }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await upload(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="kit-image">
      <span className="kit-label">{label}</span>
      <div className={`kit-image__frame ${wide ? 'kit-image__frame--wide' : ''}`}>
        {value ? <img src={toUrl(value)} alt="" /> : <span className="kit-image__none">{busy ? 'Uploading…' : 'No image'}</span>}
      </div>
      <div className="kit-actions">
        <label className="fay-btn-outline" style={{ cursor: busy ? 'progress' : 'pointer' }}>
          <Icon name="upload" size={18} /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} disabled={busy} />
        </label>
        {value && onPreview ? (
          <button type="button" className="fay-btn-outline" onClick={onPreview}>
            <Icon name="360" size={18} /> Preview
          </button>
        ) : null}
        {value ? (
          <button type="button" className="fay-btn-outline" onClick={() => onChange(null)}>
            <Icon name="delete" size={18} /> Remove
          </button>
        ) : null}
      </div>
      {hint ? <span className="sub">{hint}</span> : null}
      {error ? <span className="kit-error">{error}</span> : null}
    </div>
  );
}

/** Labelled text input / textarea bound to a value. */
export function TextInput({ label, value, onChange, multiline, rows = 4, placeholder, hint, type = 'text', style }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <label className="kit-field" style={style}>
      <span className="kit-label">{label}</span>
      <Tag className="kit-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={multiline ? rows : undefined} type={multiline ? undefined : type} />
      {hint ? <span className="sub">{hint}</span> : null}
    </label>
  );
}
