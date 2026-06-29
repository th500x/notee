import { buildGoogleMapsUrl } from '@shared/utils/lifeResumeLocation.js';

const linkClassName =
  'inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline';

export default function EntryLocationLine({ entry, isOwner, ownerExactMapsUrl = null }) {
  const hasPublic = !!entry?.locationPublicLabel;
  const hasPlaceName = !!entry?.locationPlaceName;

  if (!hasPublic && !hasPlaceName) {
    return null;
  }

  const visitorMapsUrl = hasPublic
    ? buildGoogleMapsUrl({ label: entry.locationPublicLabel })
    : null;

  const exactMapsUrl =
    ownerExactMapsUrl ||
    (isOwner && hasPlaceName
      ? buildGoogleMapsUrl({
          latitude: entry.latitude,
          longitude: entry.longitude,
          placeName: entry.locationPlaceName,
          mapsUrl: entry.locationMapsUrl,
        })
      : null);

  return (
    <div className="mt-3 text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
      {hasPublic &&
        (visitorMapsUrl ? (
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
          <span>
            <span aria-hidden="true">📍 </span>
            {isOwner && hasPlaceName
              ? `访客看到：${entry.locationPublicLabel}`
              : entry.locationPublicLabel}
          </span>
        ))}

      {hasPlaceName && (
        <>
          {hasPublic && <span className="text-slate-400" aria-hidden="true">·</span>}
          {isOwner && exactMapsUrl ? (
            <a
              href={exactMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 hover:underline max-w-full truncate"
              title="在 Google 地图中打开具体地点"
            >
              {entry.locationPlaceName}
            </a>
          ) : (
            <span className="text-slate-600 max-w-full truncate" title={entry.locationPlaceName}>
              {entry.locationPlaceName}
            </span>
          )}
        </>
      )}
    </div>
  );
}
