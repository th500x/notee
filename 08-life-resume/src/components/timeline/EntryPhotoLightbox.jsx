import { useCallback, useEffect } from 'react';

export default function EntryPhotoLightbox({
  open,
  photos = [],
  activeIndex = 0,
  onClose,
  onChangeIndex,
}) {
  const photoCount = photos.length;
  const photo = photos[activeIndex] || null;
  const canNavigate = photoCount > 1;

  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    onChangeIndex?.((activeIndex - 1 + photoCount) % photoCount);
  }, [activeIndex, canNavigate, onChangeIndex, photoCount]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    onChangeIndex?.((activeIndex + 1) % photoCount);
  }, [activeIndex, canNavigate, onChangeIndex, photoCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (!canNavigate) return;
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, canNavigate, goPrev, goNext]);

  if (!open || !photo?.url) return null;

  const alt = photo.originalFilename || '照片';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="查看原图"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/85"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[min(100%,1200px)] max-h-[min(92vh,1200px)] flex flex-col items-center gap-3 pointer-events-none">
        <div className="self-end flex items-center gap-3 pointer-events-auto">
          {canNavigate && (
            <span className="text-sm text-white/80 tabular-nums">
              {activeIndex + 1} / {photoCount}
            </span>
          )}
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="relative w-full flex items-center justify-center pointer-events-auto">
          {canNavigate && (
            <button
              type="button"
              className="absolute left-0 sm:left-2 z-10 rounded-full bg-black/45 text-white w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="上一张"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ‹
              </span>
            </button>
          )}

          <img
            key={photo.url}
            src={photo.url}
            alt={alt}
            className="max-w-full max-h-[min(85vh,1100px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />

          {canNavigate && (
            <button
              type="button"
              className="absolute right-0 sm:right-2 z-10 rounded-full bg-black/45 text-white w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="下一张"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ›
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
