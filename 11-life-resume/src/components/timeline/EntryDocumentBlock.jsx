export default function EntryDocumentBlock({ media }) {
  const doc = media?.find((item) => item.mediaType === 'document' && item.url);
  if (!doc) return null;

  const name = doc.originalFilename || '文档';
  const sizeKb = doc.sizeBytes ? (doc.sizeBytes / 1024).toFixed(0) : null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 min-w-0 text-sm text-indigo-700 hover:text-indigo-900 hover:underline"
        title="在新标签页打开或下载"
      >
        <span
          className="w-10 h-10 shrink-0 rounded bg-white border border-slate-200 flex items-center justify-center text-lg"
          aria-hidden
        >
          📄
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          {sizeKb != null && <span className="block text-xs text-slate-500 mt-0.5">{sizeKb} KB</span>}
        </span>
        <span className="shrink-0 text-xs text-slate-500">打开</span>
      </a>
    </div>
  );
}
