import { useCallback, useEffect, useMemo, useState } from 'react';
import { Empty, Pill, SearchBox, Tabs, Toolbar } from '../../manager/components/kit';
import { Icon } from '../../manager/components/ui';
import { FEATURES, STATUS, SURFACES } from '../guide/catalogue';
import { ACTORS, JOURNEYS, STEP_STATUS, stepsOf } from '../guide/journeys';
import '../guide/guide.css';

const surfaceName = (id) => SURFACES.find(([k]) => k === id)?.[1] || id;
const matches = (f, q) =>
  !q || [f.name, f.area, f.where, ...(f.does || []), ...(f.limits || []), ...(f.improve || [])].join(' ').toLowerCase().includes(q);

// Which steps have been tested on this computer (a checklist for test sessions, kept in the browser).
const TESTED_KEY = 'faysha.guide.tested';
const readTested = () => {
  try {
    return JSON.parse(localStorage.getItem(TESTED_KEY) || '{}');
  } catch {
    return {};
  }
};
const stepKey = (j, ci, si) => `${j.id}:${ci}:${si}`;

const tally = (steps) => steps.reduce((t, s) => ({ ...t, [s.status]: (t[s.status] || 0) + 1 }), {});

/** Platform guide: how Faysha works end to end (journeys, presentable on a TV), every feature, and what to improve. */
export default function Guide() {
  const [view, setView] = useState('journeys');
  const [present, setPresent] = useState(null); // index of the first slide, or null
  const slides = useMemo(buildSlides, []);
  const allSteps = useMemo(() => JOURNEYS.flatMap(stepsOf), []);
  const totals = tally(allSteps);

  return (
    <div className="stack">
      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="card-title">How Faysha works</span>
            <p className="sub" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
              Every journey — booking, requests, maintenance, payments, the stay — told step by step: who does it, where, and whether it
              works today. Present it on a screen, use it to train the team, and tick each step as you test it.
            </p>
          </div>
          <button type="button" className="btn-gold" onClick={() => setPresent(0)}>
            <Icon name="slideshow" size={18} /> Present
          </button>
        </div>
        <div className="guide-legend">
          {Object.entries(STEP_STATUS).map(([k, [label, tone]]) => (
            <span key={k}>
              <Pill tone={tone}>{label}</Pill> <strong>{totals[k] || 0}</strong> steps
            </span>
          ))}
        </div>
      </section>

      <Toolbar>
        <Tabs
          value={view}
          onChange={setView}
          options={[
            ['journeys', 'Journeys', JOURNEYS.length],
            ['features', 'Features', FEATURES.length],
            ['backlog', 'To improve'],
          ]}
        />
      </Toolbar>

      {view === 'journeys' ? (
        <Journeys onPresent={(id) => setPresent(slides.findIndex((s) => s.journey.id === id))} />
      ) : (
        <FeatureCatalogue backlogOnly={view === 'backlog'} />
      )}

      {present !== null ? <Presenter slides={slides} start={present} onClose={() => setPresent(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Journeys
function Journeys({ onPresent }) {
  const [open, setOpen] = useState(JOURNEYS[0].id);
  const [tested, setTested] = useState(readTested);

  const toggle = (key) =>
    setTested((t) => {
      const next = { ...t, [key]: !t[key] };
      if (!next[key]) delete next[key];
      try {
        localStorage.setItem(TESTED_KEY, JSON.stringify(next));
      } catch {
        // checklist still works for this visit
      }
      return next;
    });

  const journey = JOURNEYS.find((j) => j.id === open);

  return (
    <>
      <div className="kit-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        {JOURNEYS.map((j) => {
          const steps = stepsOf(j);
          const t = tally(steps);
          const done = steps.filter((_, i) => tested[flatKey(j, i)]).length;
          return (
            <button key={j.id} type="button" className="kit-card" style={{ padding: 14, gap: 6, borderColor: open === j.id ? 'var(--gold)' : undefined }} onClick={() => setOpen(j.id)}>
              <Icon name={j.icon} size={24} color="var(--gold)" />
              <strong style={{ fontSize: 16 }}>{j.title}</strong>
              <StatusBar counts={t} total={steps.length} />
              <span className="sub" style={{ fontSize: 12 }}>
                {t.live || 0} of {steps.length} steps live{t.coming ? ` · ${t.coming} coming soon` : ''}
                {done ? ` · ${done} tested` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <section className="card" style={{ gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Icon name={journey.icon} size={30} color="var(--gold)" />
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="serif" style={{ fontSize: 26 }}>{journey.title}</span>
            <p className="sub" style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{journey.summary}</p>
          </div>
          <button type="button" className="fay-btn-outline" onClick={() => onPresent(journey.id)}>
            <Icon name="slideshow" size={18} /> Present this journey
          </button>
        </div>

        {journey.chapters.map((c, ci) => (
          <div key={c.title} className="guide-chapter">
            <div className="guide-chapter__head">
              <span className="guide-chapter__n">{ci + 1}</span>
              <div>
                <strong style={{ fontSize: 17 }}>{c.title}</strong>
                {c.intro ? <span className="sub" style={{ display: 'block' }}>{c.intro}</span> : null}
              </div>
            </div>
            <ol className="guide-steps">
              {c.steps.map((s, si) => {
                const key = stepKey(journey, ci, si);
                return (
                  <li key={key} className={`guide-step guide-step--${s.status}`}>
                    <StepBody s={s} />
                    <label className="guide-tested" title="Tick when you have tested this step">
                      <input type="checkbox" checked={Boolean(tested[key])} onChange={() => toggle(key)} />
                      Tested
                    </label>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </>
  );
}

/** Key of the i-th step of a journey counted across chapters (for the tested tally on cards). */
function flatKey(j, i) {
  let n = i;
  for (let ci = 0; ci < j.chapters.length; ci += 1) {
    if (n < j.chapters[ci].steps.length) return stepKey(j, ci, n);
    n -= j.chapters[ci].steps.length;
  }
  return '';
}

function StepBody({ s, big = false }) {
  const [label, tone] = STEP_STATUS[s.status];
  return (
    <div className="guide-step__body">
      <div className="guide-step__top">
        <span className="guide-who">
          <Icon name={ACTORS[s.who] || 'person'} size={big ? 26 : 17} color="var(--gold)" /> {s.who}
        </span>
        <span className="guide-where">
          <Icon name="place" size={big ? 20 : 14} /> {s.where}
        </span>
        <Pill tone={tone} style={big ? { fontSize: 16, padding: '4px 12px' } : undefined}>{label}</Pill>
      </div>
      <p className="guide-step__text">{s.text}</p>
      {s.check ? (
        <p className="guide-step__check">
          <Icon name={/^Coming/.test(s.check) ? 'schedule' : s.status === 'live' ? 'task_alt' : 'info'} size={big ? 20 : 14} color={/^Coming/.test(s.check) ? '#b48cff' : undefined} /> {s.check}
        </p>
      ) : null}
    </div>
  );
}

function StatusBar({ counts, total, tall = false }) {
  return (
    <div className="guide-bar" style={tall ? { height: 8 } : undefined}>
      {Object.entries(STEP_STATUS).map(([k, [, tone]]) =>
        counts[k] ? <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: tone }} /> : null,
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Presenter
/** One slide per journey (cover) and per chapter; long chapters are split so text stays readable on a TV. */
function buildSlides() {
  const out = [];
  JOURNEYS.forEach((journey) => {
    out.push({ kind: 'cover', journey });
    journey.chapters.forEach((chapter, ci) => {
      const size = 4;
      const parts = Math.ceil(chapter.steps.length / size);
      for (let p = 0; p < parts; p += 1) {
        out.push({ kind: 'chapter', journey, chapter, ci, part: p, parts, offset: p * size, steps: chapter.steps.slice(p * size, p * size + size) });
      }
    });
  });
  return out;
}

function Presenter({ slides, start, onClose }) {
  const [i, setI] = useState(Math.max(0, start));
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length]);

  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    const onKey = (e) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(slides.length - 1);
      else if (e.key === 'Escape') onClose();
    };
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    };
  }, [go, onClose, slides.length]);

  const s = slides[i];
  const steps = stepsOf(s.journey);
  const t = tally(steps);

  return (
    <div className="guide-present" role="dialog" aria-modal="true" aria-label="Platform presentation">
      <header className="guide-present__top">
        <span className="guide-present__brand">FAYSHA</span>
        <span className="guide-present__crumb">
          {s.journey.title}
          {s.kind === 'chapter' ? ` · ${s.chapter.title}${s.parts > 1 ? ` (${s.part + 1}/${s.parts})` : ''}` : ''}
        </span>
        <span className="guide-present__count">{i + 1} / {slides.length}</span>
        <button type="button" className="guide-present__close" onClick={onClose} aria-label="Close presentation">
          <Icon name="close" size={26} />
        </button>
      </header>

      <main className="guide-present__slide" onClick={(e) => (e.clientX > window.innerWidth / 3 ? go(1) : go(-1))}>
        {s.kind === 'cover' ? (
          <div className="guide-cover">
            <Icon name={s.journey.icon} size={88} color="var(--gold)" />
            <h1>{s.journey.title}</h1>
            <p>{s.journey.summary}</p>
            <ol className="guide-cover__chapters">
              {s.journey.chapters.map((c, ci) => (
                <li key={c.title}>
                  <span>{ci + 1}</span> {c.title}
                </li>
              ))}
            </ol>
            <div className="guide-cover__status">
              <StatusBar counts={t} total={steps.length} tall />
              <div>
                {Object.entries(STEP_STATUS).map(([k, [label, tone]]) =>
                  t[k] ? (
                    <span key={k} style={{ color: tone }}>
                      {t[k]} {label.toLowerCase()}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="guide-deck">
            <div className="guide-deck__head">
              <span className="guide-chapter__n guide-chapter__n--big">{s.ci + 1}</span>
              <div>
                <h2>{s.chapter.title}</h2>
                {s.chapter.intro && s.part === 0 ? <p>{s.chapter.intro}</p> : null}
              </div>
            </div>
            <ol className="guide-steps guide-steps--big" start={s.offset + 1}>
              {s.steps.map((step, k) => (
                <li key={k} className={`guide-step guide-step--${step.status}`}>
                  <StepBody s={step} big />
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>

      <footer className="guide-present__progress" aria-hidden="true">
        <span style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
      </footer>
      <span className="guide-present__hint">← → or click to move · Esc to leave</span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Features (catalogue)
function FeatureCatalogue({ backlogOnly }) {
  const [surface, setSurface] = useState('all');
  const [status, setStatus] = useState('all');
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
      list.flatMap((f) => [
        ...(f.limits || []).map((t) => ({ kind: 'limit', text: t, f })),
        ...(f.improve || []).map((t) => ({ kind: 'idea', text: t, f })),
        ...(f.status === 'planned' ? (f.does || []).map((t) => ({ kind: 'planned', text: `${f.name}: ${t}`, f })) : []),
      ]),
    [list],
  );

  return (
    <>
      <div className="kit-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {SURFACES.map(([id, label, icon, sub]) => (
          <button key={id} type="button" className="kit-card" style={{ padding: 14, gap: 2, borderColor: surface === id ? 'var(--gold)' : undefined }} onClick={() => setSurface(surface === id ? 'all' : id)}>
            <Icon name={icon} size={22} color="var(--gold)" />
            <strong style={{ marginTop: 6 }}>{label}</strong>
            <span className="sub">{count(id)} features · {sub}</span>
          </button>
        ))}
      </div>

      <Toolbar right={<SearchBox value={q} onChange={setQ} placeholder="Search features, screens, ideas…" />}>
        <Tabs value={status} onChange={setStatus} options={[['all', 'Any status'], ...Object.entries(STATUS).map(([k, [label]]) => [k, label, statusCount(k)])]} />
      </Toolbar>

      {list.length === 0 ? (
        <section className="card">
          <Empty icon="search_off" title="Nothing matches">Try another word or clear the filters.</Empty>
        </section>
      ) : null}

      {!backlogOnly
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
    </>
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
