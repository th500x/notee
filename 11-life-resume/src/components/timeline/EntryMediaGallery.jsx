import { useMemo, useState } from 'react';
import EntryPhotoLightbox from '@/components/timeline/EntryPhotoLightbox';

export default function EntryMediaGallery({ media = [] }) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);

  const photos = useMemo(
    () =>
      media.filter((item) => item.mediaType === 'photo' && (item.thumbUrl || item.url)),
    [media]
  );

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {photos.map((item, index) => (
          <button
            key={item.id || item.ossKey || item.url}
            type="button"
            className="block aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            onClick={() => item.url && setActivePhotoIndex(index)}
            disabled={!item.url}
            aria-label={item.originalFilename ? `查看原图：${item.originalFilename}` : '查看原图'}
          >
            <img
              src={item.thumbUrl || item.url}
              alt={item.originalFilename || '照片'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      <EntryPhotoLightbox
        open={activePhotoIndex != null}
        photos={photos}
        activeIndex={activePhotoIndex ?? 0}
        onClose={() => setActivePhotoIndex(null)}
        onChangeIndex={setActivePhotoIndex}
      />
    </>
  );
}
