/**
 * 君主口谕式批复弹窗（只读 · 无 👍👎）。
 *
 * 视觉壳与 `KingEdictPanel` 展开态一致（32-5 · 口谕），供政策/战事谏言决裁等复用。
 */

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   courtesyName?: string,
 *   line: string,
 *   approved?: boolean,
 *   footnote?: string|null,
 *   title?: string,
 * }} props
 */
export default function KingEdictVerdictDialog({
  open,
  onClose,
  courtesyName = '君主',
  line,
  approved = true,
  footnote = null,
  title = '口谕',
}) {
  if (!open) return null;

  const nameClass = approved ? 'text-amber-200' : 'text-red-300';
  const bodyClass = approved ? 'text-amber-100/90' : 'text-red-400/95';

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-3 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="king-edict-verdict-title"
      onClick={onClose}
    >
      <div
        className="w-[min(100%,24rem)] sm:w-[400px] flex flex-col rounded-lg shadow-lg overflow-hidden border border-amber-700/40 bg-gray-900/95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-1 px-2 py-2 bg-amber-800/80 shrink-0 border-b border-amber-700/30">
          <span id="king-edict-verdict-title" className="text-sm font-bold text-amber-100 shrink-0">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-amber-200/70 hover:text-amber-100 text-sm shrink-0"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="px-3 py-3 text-sm leading-relaxed min-h-[4.5rem] flex flex-col gap-2">
          <div>
            <span className={`font-medium ${nameClass}`}>{courtesyName}</span>
            <span className={bodyClass}>：{line || '……'}</span>
          </div>
          {footnote ? (
            <p className="text-xs text-stone-400 leading-snug">{footnote}</p>
          ) : null}
        </div>
        <div className="px-3 pb-3 pt-0 flex items-center justify-center border-t border-amber-700/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/50"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
