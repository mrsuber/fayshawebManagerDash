import { useEffect, useState } from 'react';

/**
 * The clock of a task (the API's `timer`: { minutes, startedAt, dueAt, endedAt, running, takenMinutes, lateMinutes, onTime }).
 * Running: time left, ticking each second; past the time allowed it keeps counting in red ("Late +12:04").
 * Done: how long it took and whether it was on time. Used by My work (/work) and FAY OS → Service Requests.
 */
const pad = (n) => String(n).padStart(2, '0');

/** 754 s → "12:34"; 3 h → "3:00:00" */
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** 95 → "1 h 35 min"; 40 → "40 min" */
export function minutesText(min) {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Seconds left (negative when late) and the state of a timer at `now`. */
export function timerState(timer, now = Date.now()) {
  if (!timer) return null;
  const due = new Date(timer.dueAt).getTime();
  if (timer.endedAt || timer.running === false) {
    const end = timer.endedAt ? new Date(timer.endedAt).getTime() : now;
    return { done: true, late: end > due, seconds: (due - end) / 1000, taken: timer.takenMinutes };
  }
  const left = (due - now) / 1000;
  return { done: false, late: left < 0, seconds: left, warn: left >= 0 && left < Math.min(300, timer.minutes * 12) };
}

/**
 * A timer from a work order as the collections API returns it ({ minutes, assignedAt, completedAt, status }), the same shape
 * as the server's clock.
 */
export function orderTimer(o) {
  if (!o?.minutes || !o.assignedAt) return null;
  const start = new Date(o.assignedAt).getTime();
  const due = start + o.minutes * 60000;
  const end = o.completedAt ? new Date(o.completedAt).getTime() : null;
  return {
    minutes: o.minutes,
    startedAt: o.assignedAt,
    dueAt: new Date(due).toISOString(),
    endedAt: o.completedAt || null,
    running: !end && !['Closed', 'Cancelled'].includes(o.status),
    takenMinutes: end ? Math.round((end - start) / 60000) : null,
    lateMinutes: end ? Math.max(0, Math.round((end - due) / 60000)) : null,
    onTime: end ? end <= due : null,
  };
}

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const COLORS = { ok: '#3fd283', warn: '#e8b84a', late: '#ff6b6b', idle: 'var(--muted, #8f897d)' };

/**
 * <TaskTimer timer={r.timer} minutes={r.minutes} assigned={Boolean(r.assignedTo)} size="lg" />
 * Without a running clock it says what will happen: "45 min once assigned".
 */
export default function TaskTimer({ timer, minutes, assigned = true, size = 'md', style }) {
  const running = Boolean(timer && !timer.endedAt && timer.running !== false);
  const now = useNow(running);
  const big = size === 'lg';
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums', fontSize: big ? 15 : 12.5, whiteSpace: 'nowrap', ...style };

  if (!timer) {
    if (!minutes) return null;
    return (
      <span style={{ ...base, color: COLORS.idle }} title="The clock starts when the task is given to someone">
        ⏱ {minutesText(minutes)}{assigned ? '' : ' once assigned'}
      </span>
    );
  }
  const st = timerState(timer, now);
  if (st.done) {
    const lateMin = Math.max(0, timer.lateMinutes || 0);
    return (
      <span style={{ ...base, color: st.late ? COLORS.late : COLORS.ok }} title={`${minutesText(timer.minutes)} allowed`}>
        {st.late ? '⚠' : '✓'} Took {minutesText(timer.takenMinutes)} · {st.late ? `${minutesText(lateMin)} late` : 'on time'}
      </span>
    );
  }
  const color = st.late ? COLORS.late : st.warn ? COLORS.warn : COLORS.ok;
  return (
    <span
      role="timer"
      aria-live="off"
      style={{
        ...base,
        color,
        fontWeight: 500,
        padding: big ? '6px 12px' : '2px 8px',
        borderRadius: 99,
        border: `1px solid ${color}`,
        background: st.late ? 'rgba(255,107,107,.12)' : 'transparent',
      }}
      title={`${minutesText(timer.minutes)} allowed · due ${new Date(timer.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
    >
      ⏱ {st.late ? `Late +${clockText(-st.seconds)}` : `${clockText(st.seconds)} left`}
    </span>
  );
}
