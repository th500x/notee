import { useState } from 'react';
import { formatEntryTimeLabel } from '@shared/utils/lifeResumeEntryTime.js';
import { buildGoogleMapsUrl } from '@shared/utils/lifeResumeLocation.js';
import EntryMediaGallery from '@/components/timeline/EntryMediaGallery';
import EntryVideoPlayer from '@/components/timeline/EntryVideoPlayer';
import EntryDriveBlock from '@/components/timeline/EntryDriveBlock';
import EntryLocationLine from '@/components/timeline/EntryLocationLine';

const VISIBILITY_LABELS = {
  public: '公开',
  private: '隐私',
  specific: '特定',
};

const VISIBILITY_STYLES = {
  public: 'bg-emerald-50 text-emerald-700',
  private: 'bg-amber-50 text-amber-700',
  specific: 'bg-blue-50 text-blue-700',
};

const BODY_PREVIEW_LIMIT = 200;

export default function TimelineEntryCard({ entry, isOwner, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timeLabel = formatEntryTimeLabel(entry);
  const body = entry.body || '';
  const needsFold = body.length > BODY_PREVIEW_LIMIT;
  const displayBody = expanded || !needsFold ? body : `${body.slice(0, BODY_PREVIEW_LIMIT)}…`;

  const handleDelete = async () => {
    if (!window.confirm('确定删除这条片段？此操作不可恢复。')) return;
    setDeleting(true);
    try {
      await onDelete?.(entry);
    } finally {
      setDeleting(false);
    }
  };

  const ownerExactMapsUrl =
    isOwner && entry.locationPlaceName
      ? buildGoogleMapsUrl({
          latitude: entry.latitude,
          longitude: entry.longitude,
          placeName: entry.locationPlaceName,
          mapsUrl: entry.locationMapsUrl,
        })
      : null;

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {(entry.title || entry.locationPlaceName) && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
              {entry.title ? (
                <h3 className="font-semibold text-slate-900">{entry.title}</h3>
              ) : (
                <span />
              )}
              {entry.locationPlaceName &&
                (ownerExactMapsUrl ? (
                  <a
                    href={ownerExactMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 max-w-[55%] truncate"
                    title="在 Google 地图中打开"
                  >
                    📍 {entry.locationPlaceName}
                  </a>
                ) : (
                  <span
                    className="text-sm text-slate-600 shrink-0 max-w-[55%] truncate"
                    title={entry.locationPlaceName}
                  >
                    📍 {entry.locationPlaceName}
                  </span>
                ))}
            </div>
          )}
          <p className="text-sm text-slate-500">{timeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          {entry.isPinned && (
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">置顶</span>
          )}
          {isOwner && entry.status === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">草稿</span>
          )}
          {isOwner && (
            <span
              className={[
                'text-xs px-2 py-0.5 rounded',
                VISIBILITY_STYLES[entry.visibility] || 'bg-slate-100 text-slate-600',
              ].join(' ')}
            >
              {VISIBILITY_LABELS[entry.visibility]}
              {entry.visibility === 'specific' && entry.granteeAccountId
                ? ` @${entry.granteeAccountId}`
                : ''}
            </span>
          )}
        </div>
      </div>

      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {entry.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-slate-700 whitespace-pre-wrap">{displayBody}</p>
      {needsFold && (
        <button
          type="button"
          className="text-sm text-indigo-600 hover:underline mt-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '收起' : '展开全文'}
        </button>
      )}

      <EntryMediaGallery media={entry.media} />
      <EntryVideoPlayer media={entry.media} />
      <EntryDriveBlock entry={entry} />
      <EntryLocationLine entry={entry} isOwner={isOwner} />

      {isOwner && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
            onClick={() => onEdit?.(entry)}
          >
            编辑
          </button>
          <button
            type="button"
            disabled={deleting}
            className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
            onClick={handleDelete}
          >
            {deleting ? '删除中…' : '删除'}
          </button>
        </div>
      )}
    </article>
  );
}
