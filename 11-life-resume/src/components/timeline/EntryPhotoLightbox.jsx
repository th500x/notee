import { useEffect } from 'react';

export default function EntryPhotoLightbox({ open, photo, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
      <div className="relative max-w-[min(100%,1200px)] max-h-[min(92vh,1200px)] flex flex-col items-end gap-3">
        <button
          type="button"
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          onClick={onClose}
        >
          关闭
        </button>
        <img
          src={photo.url}
          alt={alt}
          className="max-w-full max-h-[min(85vh,1100px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}
