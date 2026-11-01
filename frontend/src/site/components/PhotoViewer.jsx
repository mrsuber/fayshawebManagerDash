import { useCallback, useEffect, useRef } from 'react';

/** Full-screen photo viewer: arrows or swipe to move, Escape to close. `index` null = closed. */
export default function PhotoViewer({ photos, index, onIndex, onClose, title }) {
  const closeRef = useRef(null);
  const touchX = useRef(null);
  const open = index !== null && index !== undefined && photos.length > 0;
  const go = useCallback((step) => onIndex((i) => (i + step + photos.length) % photos.length), [onIndex, photos.length]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, go]);

  if (!open) return null;
  const photo = photos[index];
  return (
    <div className="fs-dialog fs-viewer" role="dialog" aria-modal="true" aria-label={`${title} — photos`} onClick={onClose}>
      <button ref={closeRef} type="button" className="fs-dialog__close" onClick={onClose} aria-label="Close photos">×</button>
      <figure
        className="fs-viewer__stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <img src={photo.url} alt={photo.title || title} />
        <figcaption>
          {photo.title && !/\.(jpe?g|png|webp|heic)$/i.test(photo.title) ? <span>{photo.title}</span> : <span />}
          <span className="fs-viewer__count">{index + 1} / {photos.length}</span>
        </figcaption>
      </figure>
      {photos.length > 1 && (
        <>
          <button type="button" className="fs-viewer__nav fs-viewer__nav--prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo">‹</button>
          <button type="button" className="fs-viewer__nav fs-viewer__nav--next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo">›</button>
        </>
      )}
    </div>
  );
}
