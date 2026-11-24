import { useCallback, useEffect, useState } from 'react';

/**
 * The guest's digital key and the stay pass, for the team: the gate QR code, door PIN and deposit box as the guest
 * has them, and three ways to get them to the guest — resend the confirmation email, download the PDF, or send it on
 * WhatsApp (on a phone the PDF itself is shared; on a computer WhatsApp opens with a private link to it).
 *
 * Used by FAY OS → Reservations (managers) and HQ → Bookings (super administrators); each passes its own API calls:
 *   load() → pass JSON, pdf() → Blob, resend() → { to }
 */
const S = {
  box: { border: '1px solid rgba(232,184,74,.35)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(232,184,74,.05)', color: '#ece6da' },
  k: { fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8f897d' },
  pin: { fontFamily: '"Courier New", monospace', fontSize: 30, letterSpacing: 6, color: '#e8b84a', fontWeight: 700 },
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.18)', background: 'transparent', color: '#ece6da', cursor: 'pointer', font: 'inherit', fontSize: 13.5, flex: '1 1 140px' },
  gold: { background: '#e8b84a', color: '#16130c', border: '1px solid #e8b84a', fontWeight: 600 },
  wa: { background: '#25d366', color: '#06230f', border: '1px solid #25d366', fontWeight: 600 },
  sub: { fontSize: 12.5, color: '#8f897d', lineHeight: 1.5 },
};

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export default function StayPassPanel({ bookingId, load, pdf, resend, notify = () => {} }) {
  const [pass, setPass] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const refresh = useCallback(() => {
    setError('');
    load(bookingId).then(setPass).catch((e) => setError(e.message || 'Could not load the stay pass'));
  }, [bookingId, load]);
  useEffect(refresh, [refresh]);

  const run = async (what, fn) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      if (e?.name !== 'AbortError') notify(e.message || 'Something went wrong', 'error');
    } finally {
      setBusy('');
    }
  };
  const fileName = pass ? `Faysha-${pass.number}.pdf` : 'Faysha-stay.pdf';

  const onDownload = () => run('pdf', async () => download(await pdf(bookingId), fileName));
  const onResend = () =>
    run('email', async () => {
      const r = await resend(bookingId);
      notify(`Confirmation sent to ${r?.to || pass.guest.email}`);
      refresh();
    });
  const onWhatsApp = () =>
    run('wa', async () => {
      const text = pass.whatsappText;
      // On a phone: share the PDF itself (the guest gets the file in WhatsApp).
      try {
        const file = new File([await pdf(bookingId)], fileName, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text, title: `Stay pass ${pass.number}` });
          return;
        }
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
      }
      // On a computer: WhatsApp opens on the guest's number with a private link to the PDF.
      const phone = String(pass.guest.phone || '').replace(/\D/g, '');
      const msg = `${text}${pass.pdfLink ? `\n\nYour stay pass (PDF): ${pass.pdfLink}` : ''}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    });

  if (error) return <div style={{ ...S.box, borderColor: 'rgba(255,107,107,.5)' }}><span style={S.sub}>{error}</span></div>;
  if (!pass) return <div style={S.box}><span style={S.sub}>Loading the digital key…</span></div>;

  const live = ['confirmed', 'checked_in'].includes(pass.status);
  return (
    <div style={S.box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 16 }}>Digital key &amp; stay pass</strong>
        <span style={S.sub}>
          {pass.email.error ? <span style={{ color: '#ff6b6b' }}>Email failed: {pass.email.error}</span> : pass.email.sent ? `Emailed ${pass.email.sentAt ? new Date(pass.email.sentAt).toLocaleDateString() : ''}` : 'Not emailed yet'}
        </span>
      </div>
      {pass.key ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <img src={pass.key.qr} alt="Gate QR code" width={150} height={150} style={{ background: '#fff', padding: 6, borderRadius: 8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
            <div>
              <div style={S.k}>Door PIN</div>
              <div style={S.pin}>{pass.key.doorPin || '—'}</div>
            </div>
            <div>
              <div style={S.k}>Deposit box</div>
              <div style={{ fontSize: 15 }}>
                {pass.depositBox ? <>Box <strong>{pass.depositBox.number}</strong>{pass.depositBox.pin ? <> · PIN <strong style={{ fontFamily: '"Courier New", monospace', color: '#e8b84a' }}>{pass.depositBox.pin}</strong></> : <span style={S.sub}> · PIN when the stay begins</span>}</> : <span style={S.sub}>No deposit box</span>}
              </div>
            </div>
            {pass.account ? (
              <div>
                <div style={S.k}>App sign-in</div>
                <div style={{ fontSize: 13.5 }}>{pass.account.email}{pass.account.signedIn ? '' : <span style={S.sub}> · not signed in yet (temporary password is in the email)</span>}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <span style={S.sub}>The digital key (gate QR code and door PIN) is issued when the stay is confirmed.</span>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...S.btn, ...S.gold }} onClick={onResend} disabled={!live || !!busy} title={live ? 'Booking details, door PIN, gate QR code and deposit box' : 'Sent once the stay is confirmed'}>
          {busy === 'email' ? 'Sending…' : 'Resend confirmation email'}
        </button>
        <button type="button" style={S.btn} onClick={onDownload} disabled={!!busy}>{busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
        <button type="button" style={{ ...S.btn, ...S.wa }} onClick={onWhatsApp} disabled={!pass.key || !live || !!busy} title={pass.guest.phone ? `To ${pass.guest.phone}` : 'No phone number on the booking'}>
          {busy === 'wa' ? 'Opening…' : 'Send on WhatsApp'}
        </button>
      </div>
      <span style={S.sub}>The PDF has everything in the email: stay, gate QR code, door PIN, deposit box and app sign-in (never the password). Keep it between you and the guest.</span>
    </div>
  );
}
