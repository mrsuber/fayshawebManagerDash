import { useEffect, useState } from 'react';
import { endViewAs, viewAsSession } from '../viewAs';

/** Shown on every page during a view-as session (it is rendered by src/App.js, outside any dashboard). */
export default function ViewAsBanner() {
  const [session, setSession] = useState(viewAsSession);

  useEffect(() => {
    if (!session) return undefined;
    // Leave automatically when the 30-minute read-only session runs out.
    const left = new Date(session.expiresAt).getTime() - Date.now();
    const t = setTimeout(endViewAs, Math.max(0, left));
    const onStorage = () => setSession(viewAsSession());
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(t);
      window.removeEventListener('storage', onStorage);
    };
  }, [session]);

  if (!session) return null;
  const until = new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', alignItems: 'center',
        gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '10px 12px 10px 18px', borderRadius: 999, background: '#14110a',
        border: '1px solid #e8b84a', boxShadow: '0 12px 40px rgba(0,0,0,.55)', color: '#ece6da', font: '400 14px Jost, sans-serif',
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <span>
        Viewing as <strong style={{ color: '#e8b84a', fontWeight: 600 }}>{session.as?.name || 'staff member'}</strong>
        <span style={{ color: '#a9a294' }}> · {session.as?.roleDisplayName || session.as?.role} · read-only until {until}</span>
      </span>
      <button
        type="button"
        onClick={endViewAs}
        style={{ border: 0, borderRadius: 999, padding: '8px 16px', background: '#e8b84a', color: '#1a1408', font: '600 13px Jost, sans-serif', cursor: 'pointer', minHeight: 36 }}
      >
        Return to HQ
      </button>
    </div>
  );
}
