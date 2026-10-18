import { useEffect, useRef } from 'react';
import { Pannellum } from 'pannellum-react';

/** Full-screen 360° tour of a residence (panoramas are uploaded per category in the admin). */
export default function PanoramaDialog({ open, image, title, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !image) return null;
  return (
    <div className="fs-dialog" role="dialog" aria-modal="true" aria-label={`${title} — 360° tour`} onClick={onClose}>
      <div className="fs-dialog__panel fs-card" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="fs-dialog__close" onClick={onClose} aria-label="Close tour">
          ×
        </button>
        <div style={{ borderRadius: 10, overflow: 'hidden' }}>
          <Pannellum width="100%" height="70vh" image={image} pitch={0} yaw={0} hfov={110} autoLoad autoRotate={-2} showZoomCtrl={false} />
        </div>
      </div>
    </div>
  );
}
