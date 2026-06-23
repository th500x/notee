import { buildGoogleMapsUrl } from '@shared/utils/lifeResumeLocation.js';

const linkClassName =
  'inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline';

export default function EntryLocationLine({ entry, isOwner }) {
  const hasPublic = !!entry?.locationPublicLabel;
  const hasPlaceName = !!entry?.locationPlaceName;

  if (!hasPublic) {
    return null;
  }

  const visitorMapsUrl = buildGoogleMapsUrl({ label: entry.locationPublicLabel });

  return (
    <div className="mt-3 text-sm text-slate-600">
      {visitorMapsUrl ? (
        <a
          href={visitorMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          title="在 Google 地图中打开"
        >
          <span aria-hidden="true">📍</span>
          <span>
            {isOwner && hasPlaceName
              ? `访客看到：${entry.locationPublicLabel}`
              : entry.locationPublicLabel}
          </span>
        </a>
      ) : (
        <p>
          <span aria-hidden="true">📍 </span>
          {isOwner && hasPlaceName
            ? `访客看到：${entry.locationPublicLabel}`
            : entry.locationPublicLabel}
        </p>
      )}
    </div>
  );
}
