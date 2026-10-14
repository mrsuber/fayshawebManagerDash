import config from '../config';

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Runs `live()` against the backend, or resolves `fallback` when mocks are enabled.
 * `fallback` may be a value or a function (called with no args) so mutations can be simulated.
 */
export function withMock(live, fallback) {
  if (config.useMocks) {
    const value = typeof fallback === 'function' ? fallback() : fallback;
    return new Promise((resolve) => setTimeout(() => resolve(clone(value)), 120));
  }
  return live().then((res) => res.data);
}
