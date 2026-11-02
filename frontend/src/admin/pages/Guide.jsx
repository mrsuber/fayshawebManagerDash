import { useMemo, useState } from 'react';
import { Empty, Pill, SearchBox, Tabs, Toolbar } from '../../manager/components/kit';
import { Icon } from '../../manager/components/ui';
import { FEATURES, STATUS, SURFACES } from '../guide/catalogue';

const surfaceName = (id) => SURFACES.find(([k]) => k === id)?.[1] || id;
const matches = (f, q) =>
  !q || [f.name, f.area, f.where, ...(f.does || []), ...(f.limits || []), ...(f.improve || [])].join(' ').toLowerCase().includes(q);

/** Platform guide: everything the website, the guest app, FAY OS, HQ and the server do, and what to improve next. */
export default function Guide() {
  const [surface, setSurface] = useState('all');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('features');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const list = useMemo(
    () => FEATURES.filter((f) => (surface === 'all' || f.surface === surface) && (status === 'all' || f.status === status) && matches(f, needle)),
    [surface, status, needle],
  );
  const count = (s) => FEATURES.filter((f) => f.surface === s).length;
  const statusCount = (s) => FEATURES.filter((f) => (surface === 'all' || f.surface === surface) && f.status === s).length;

  const groups = useMemo(() => {
    const out = [];
    for (const [id, label, icon, sub] of SURFACES) {
      const items = list.filter((f) => f.surface === id);
      if (items.length) out.push({ id, label, icon, sub, items });
    }
    return out;
  }, [list]);

  const backlog = useMemo(
    () =>
      list
        .flatMap((f) => [
          ...(f.limits || []).map((t) => ({ kind: 'limit', text: t, f })),
          ...(f.improve || []).map((t) => ({ kind: 'idea', text: t, f })),
          ...(f.status === 'planned' ? (f.does || []).map((t) => ({ kind: 'planned', text: `${f.name}: ${t}`, f })) : []),
        ]),
    [list],
  );

  return (
    <div className="stack">
      <section className="card" style={{ gap: 12 }}>
        <span className="card-title">What Faysha can do</span>
        <p className="sub" style={{ margin: 0, lineHeight: 1.6 }}>
          Every feature of the website, the guest app, FAY OS and HQ: what it does, where to find it, how complete it is, and ideas to
          make it better. Use it to train the team, to check what exists before asking for something new, and to choose what to improve next.
        </p>
        <div className="kit-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {SURFACES.map(([id, label, icon, sub]) => (
            <button key={id} type="button" className="kit-card" style={{ padding: 14, gap: 2, borderColor: surface === id ? 'var(--gold)' : undefined }} onClick={() => setSurface(surface === id ? 'all' : id)}>
              <Icon name={icon} size={22} color="var(--gold)" />
              <strong style={{ marginTop: 6 }}>{label}</strong>
              <span className="sub">{count(id)} features · {sub}</span>
            </button>
          ))}
        </div>
      </section>

      <Toolbar right={<SearchBox value={q} onChange={setQ} placeholder="Search features, screens, ideas…" />}>
        <Tabs value={view} onChange={setView} options={[['features', 'Features', list.length], ['backlog', 'To improve', backlog.length]]} />
        <Tabs
          value={status}
          onChange={setStatus}
          options={[['all', 'Any status'], ...Object.entries(STATUS).map(([k, [label]]) => [k, label, statusCount(k)])]}
        />
      </Toolbar>

      {list.length === 0 ? <section className="card"><Empty icon="search_off" title="Nothing matches">Try another word or clear the filters.</Empty></section> : null}

      {view === 'features'
        ? groups.map((g) => (
            <section key={g.id} className="stack" style={{ gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Icon name={g.icon} size={22} color="var(--gold)" />
                <span className="serif" style={{ fontSize: 22 }}>{g.label}</span>
                <span className="sub">{g.sub}</span>
              </div>
              <div className="kit-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {g.items.map((f) => (
                  <Feature key={`${f.surface}-${f.name}`} f={f} />
                ))}
              </div>
            </section>
          ))
        : backlog.length ? (
            <section className="card" style={{ gap: 4 }}>
              <span className="card-title">Improvement backlog</span>
              <span className="sub">Known limits first, then ideas and planned features. Each line names the feature it belongs to.</span>
              {['limit', 'idea', 'planned'].map((kind) =>
                backlog
                  .filter((b) => b.kind === kind)
                  .map((b, i) => (
                    <div key={`${kind}-${i}`} className="row-line" style={{ display: 'flex', gap: 10, padding: '10px 0', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Pill tone={kind === 'limit' ? '#ff6b6b' : kind === 'idea' ? '#e8b84a' : '#8f897d'}>{kind === 'limit' ? 'Limit' : kind === 'idea' ? 'Idea' : 'Planned'}</Pill>
                      <span style={{ flex: 1, minWidth: 200 }}>{b.text}</span>
                      <span className="sub">{surfaceName(b.f.surface)} · {b.f.name}</span>
                    </div>
                  )),
              )}
            </section>
          ) : null}
    </div>
  );
}

function Feature({ f }) {
  const [label, tone] = STATUS[f.status];
  return (
    <article className="kit-card" style={{ padding: 16, gap: 8, cursor: 'default' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <span className="sub" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>{f.area}</span>
          <strong style={{ display: 'block', fontSize: 16 }}>{f.name}</strong>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </div>
      {f.where ? (
        <span className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="place" size={15} /> {f.where}
        </span>
      ) : null}
      <List items={f.does} />
      {f.limits?.length ? <List title="Limits" color="var(--red-soft)" items={f.limits} /> : null}
      {f.improve?.length ? <List title="To improve" color="var(--gold)" items={f.improve} /> : null}
    </article>
  );
}

function List({ title, color, items }) {
  if (!items?.length) return null;
  return (
    <div>
      {title ? <span style={{ fontSize: 12, color, fontWeight: 600 }}>{title}</span> : null}
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
