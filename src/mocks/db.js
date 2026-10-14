import { buildSeed } from './data';

/**
 * Working copy of the mock data. Mock service calls read and write it, so what you create in one screen
 * (a request, a message, a booking) shows up everywhere, and it survives a page reload via localStorage.
 * resetDb() restores the seed (user menu → "Reset demo data").
 */
const KEY = 'fayos.mockdb.v2';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.guests) return saved;
  } catch {
    /* storage unavailable or corrupt */
  }
  return buildSeed();
}

let db = load();

export const getDb = () => db;

export function saveDb() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable */
  }
}

export function resetDb() {
  db = buildSeed();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export const nextId = (list) => list.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;

/** Applies a change, persists, and returns the change's result (mutations in one place). */
export function mutate(fn) {
  const result = fn(db);
  saveDb();
  return result;
}

/** Records a guest timeline event (what the backend would do as a side effect). */
export function addTimeline(d, guestId, title, category) {
  if (!guestId) return;
  d.timeline.push({ id: nextId(d.timeline), guestId, at: new Date().toISOString(), title, category });
}

/** Adds a header notification. */
export function notify(d, title, body) {
  d.notifications.unshift({ id: nextId(d.notifications), title, body, createdAt: new Date().toISOString(), read: false });
}
