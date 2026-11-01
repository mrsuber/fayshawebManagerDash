import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getVisitorPass, visitorQrUrl } from '../api';
import { Loading } from '../components/ui';

const longDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const NOTE = {
  pending: 'Your host’s invitation is being confirmed by the residence team. Open this page again shortly — your QR code appears here once it is approved.',
  declined: 'This pass was not approved. Please contact your host.',
  cancelled: 'Your host cancelled this pass.',
  expired: 'This pass has expired. Please ask your host for a new one.',
  left: 'Thank you for visiting Faysha.',
};

/** /visit/:token — the pass a resident sends to their visitor: QR code and code for the gate, day and directions. */
export default function Visit() {
  const { token } = useParams();
  const [p, setP] = useState(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    getVisitorPass(token).then(setP).catch((e) => { setError(e.message); setP(null); });
  }, [token]);
  if (p === undefined) return <Loading label="Loading" />;
  if (p === null) return <div className="fs-container fs-section fs-empty"><p>{error}</p></div>;
  const active = ['approved', 'arrived'].includes(p.status);
  return (
    <section className="fs-container fs-container--narrow fs-page-head" style={{ paddingBottom: 100, textAlign: 'center' }}>
      <p className="fs-kicker">Visitor pass</p>
      <h1 className="fs-h1" style={{ fontSize: 'clamp(34px, 6vw, 56px)' }}>Welcome, {p.visitorName.split(' ')[0]}</h1>
      <p className="fs-lead" style={{ margin: '0 auto' }}>
        {p.host} is expecting you{p.people > 1 ? ` (${p.people} people)` : ''} on {longDay(p.date)}
        {p.from ? `, from ${p.from}${p.until ? ` to ${p.until}` : ''}` : ''}, at Residence {p.residence}.
      </p>
      <div className="fs-card" style={{ padding: 'clamp(24px, 5vw, 44px)', marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {active ? (
          <>
            <img src={visitorQrUrl(token)} alt="QR code to show at the gate" width="240" height="240" style={{ background: '#fff', padding: 12, borderRadius: 14 }} />
            <p className="fs-muted" style={{ margin: 0 }}>Show this code at the gate, or give the guard your code</p>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 42, letterSpacing: 10, color: 'var(--gold)' }}>{p.code}</div>
          </>
        ) : (
          <p className="fs-lead" style={{ margin: 0 }}>{NOTE[p.status]}</p>
        )}
      </div>
      <div className="fs-card" style={{ padding: 'clamp(22px, 4vw, 36px)', marginTop: 16, textAlign: 'left' }}>
        <p className="fs-kicker">Getting here</p>
        <p style={{ lineHeight: 1.8, margin: 0 }}>{p.directions}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          {p.mapsUrl ? <a className="fs-btn fs-btn--gold" href={p.mapsUrl} target="_blank" rel="noopener noreferrer">Open in maps</a> : null}
          {p.gatePhone ? <a className="fs-btn fs-btn--ghost" href={`tel:${p.gatePhone.replace(/\s/g, '')}`}>Call the gate</a> : null}
        </div>
      </div>
    </section>
  );
}
