import { parseGoogleDriveShareUrl } from '@shared/utils/parseGoogleDriveShareUrl.js';

export default function EntryDriveFields({
  shareUrl,
  displayLabel,
  onShareUrlChange,
  onDisplayLabelChange,
  disabled = false,
}) {
  const trimmed = String(shareUrl || '').trim();
  const validation = trimmed ? parseGoogleDriveShareUrl(trimmed) : { ok: true, empty: true };

  return (
    <section className="space-y-3">
      <p className="text-sm font-medium text-slate-800">媒体 · Google 云盘（可选）</p>
      <p className="text-xs text-slate-500">
        每条片段最多 1 条 https 分享链接，可与本地照片/视频同时使用。公开条目请自行在 Google
        侧设为「知道链接的任何人可查看」。
      </p>
      <div>
        <label className="block text-sm text-slate-700 mb-1" htmlFor="entry-drive-url">
          分享链接
        </label>
        <input
          id="entry-drive-url"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="https://drive.google.com/..."
          value={shareUrl}
          disabled={disabled}
          onChange={(e) => onShareUrlChange(e.target.value)}
        />
        {trimmed && !validation.ok && (
          <p className="text-sm text-red-600 mt-1">{validation.error}</p>
        )}
      </div>
      <div>
        <label className="block text-sm text-slate-700 mb-1" htmlFor="entry-drive-label">
          展示名（可选）
        </label>
        <input
          id="entry-drive-label"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="例如：毕业相册"
          maxLength={64}
          value={displayLabel}
          disabled={disabled}
          onChange={(e) => onDisplayLabelChange(e.target.value)}
        />
      </div>
    </section>
  );
}
