/**
 * How a new alert gets attention when FAY OS is open: a soft chime (twice for urgent), a desktop notification
 * while the tab is in the background (browser permission), and the open-alert count in the tab title.
 */
let ctx = null;

export function chime(level = 'info') {
  if (level === 'info') return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const play = (at) => {
      [880, 1318.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.12, at + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.14 + 0.5);
        o.connect(g).connect(ctx.destination);
        o.start(at + i * 0.14);
        o.stop(at + i * 0.14 + 0.55);
      });
    };
    play(ctx.currentTime);
    if (level === 'urgent') play(ctx.currentTime + 0.9);
  } catch {
    /* audio unavailable */
  }
}

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const desktopPermission = () => (desktopSupported() ? window.Notification.permission : 'denied');
export const askDesktop = () => (desktopSupported() ? window.Notification.requestPermission() : Promise.resolve('denied'));

/** Shows a desktop notification when the tab is not visible; clicking it focuses FAY OS and runs onClick. */
export function desktop(alert, onClick) {
  if (!desktopSupported() || window.Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const n = new window.Notification(alert.title, { body: alert.body, tag: `fayos-${alert.id}`, renotify: alert.level === 'urgent', requireInteraction: alert.level === 'urgent' });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

const BASE_TITLE = typeof document !== 'undefined' ? document.title.replace(/^\(\d+\)\s*/, '') : '';
export function titleCount(n) {
  if (typeof document === 'undefined') return;
  document.title = n > 0 ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
}
