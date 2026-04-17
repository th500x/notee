/**
 * 更新公告浮窗（右上角关闭，琥珀风格与顶栏公告一致）
 * @see docs/30-frontend/32-3-GAME_ANNOUNCEMENTS_DESIGN.md（路径相对 `05-san-storm/`）
 */

export default function UpdateNoticePanel({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className="pointer-events-none w-full max-w-sm">
      <div
        className="relative pointer-events-auto rounded-xl border border-amber-600/50 bg-black/70 backdrop-blur-sm shadow-lg shadow-amber-900/20 overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md
                     text-amber-200/90 hover:bg-amber-900/50 hover:text-amber-50 text-lg leading-none"
          aria-label="关闭更新公告"
        >
          ×
        </button>
        <div className="px-3 pt-9 pb-3 pr-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📋</span>
            <span className="text-sm font-bold text-amber-300">{notice.title}</span>
          </div>
          <p className="text-xs text-amber-100/85 leading-relaxed whitespace-pre-line">
            {notice.content}
          </p>
        </div>
      </div>
    </div>
  );
}
