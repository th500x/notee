import { useEffect, useMemo } from 'react';

const SHARE_DOWNLOAD_SEQ_KEY = 'life-resume-share-download-seq';

function nextShareDownloadFilename() {
  let n = 0;
  try {
    n = parseInt(window.localStorage.getItem(SHARE_DOWNLOAD_SEQ_KEY), 10) || 0;
  } catch {
    n = 0;
  }
  n += 1;
  try {
    window.localStorage.setItem(SHARE_DOWNLOAD_SEQ_KEY, String(n));
  } catch {
    /* 配额满时仍用本次序号，避免永远同名 */
  }
  return `life-entry-share-${n}.png`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EntrySharePosterModal({ open, blob, onClose, generating = false, error = '' }) {
  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !generating) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, generating, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!blob) return;
    triggerDownload(blob, nextShareDownloadFilename());
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="关闭"
        onClick={generating ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">分享图预览</h2>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
            onClick={onClose}
            disabled={generating}
          >
            关闭
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {generating && (
            <p className="text-sm text-slate-500 text-center py-8">正在生成分享图…</p>
          )}
          {error && !generating && (
            <p className="text-sm text-red-600 text-center py-4">{error}</p>
          )}
          {previewUrl && !generating && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <img
                  src={previewUrl}
                  alt="片段分享图预览"
                  className="w-full h-auto block"
                />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                保存图片后，打开微信 → 朋友圈 → 从相册选择刚保存的图发布。
                在微信内可<strong className="font-medium text-slate-800">长按图片</strong>
                保存到相册。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={handleSave}
                >
                  保存图片
                </button>
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={onClose}
                >
                  完成
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
