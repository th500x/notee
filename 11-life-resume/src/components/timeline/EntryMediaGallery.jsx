export default function EntryMediaGallery({ media = [] }) {
  const photos = media.filter((item) => item.mediaType === 'photo' && item.thumbUrl);
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {photos.map((item) => (
        <a
          key={item.id || item.ossKey || item.url}
          href={item.url || item.thumbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200"
        >
          <img
            src={item.thumbUrl || item.url}
            alt={item.originalFilename || '照片'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
