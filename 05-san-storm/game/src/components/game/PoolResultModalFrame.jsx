/**
 * 卡池抽取结果 / 俸禄领取结果等共用：半透明幕 + 居中琥珀边框卡片 + 标题 + 底部「确认」。
 * z-index 与 CardPoolDrawer 内原抽取结果层一致（210/211）。
 */

export default function PoolResultModalFrame({ title, onClose, children, footerExtra = null }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[210]" onClick={onClose} />
      <div className="fixed inset-0 z-[211] flex items-center justify-center px-4" onClick={onClose}>
        <div
          className="bg-stone-900 border-2 border-amber-600/50 rounded-2xl p-4 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-amber-400 text-center font-bold mb-4">{title}</h3>
          {children}
          {footerExtra}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-lg text-sm transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </>
  );
}
