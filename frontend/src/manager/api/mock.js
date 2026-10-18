import config from '../config';

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Runs `live()` against the backend, or resolves `fallback` when mocks are enabled.
 * `fallback` may be a value or a function (run against the mock db in src/mocks/db.js); if it throws,
 * the promise rejects like a failed API call would.
 */
export function withMock(live, fallback) {
  if (config.useMocks) {
    return new Promise((resolve, reject) => {
      let value;
      try {
        value = clone(typeof fallback === 'function' ? fallback() : fallback);
      } catch (e) {
        setTimeout(() => reject(e), 120);
        return;
      }
      setTimeout(() => resolve(value), 120);
    });
  }
  return live().then((res) => res.data);
}
