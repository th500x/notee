/**
 * 卡池抽取结果 / 俸禄领取结果等共用：半透明幕 + 居中琥珀边框卡片 + 标题 + 底部「确认」。
 * z-index 与 CardPoolDrawer 内原抽取结果层一致（210/211）。
 *
 * 默认仅「确认」可关闭（closeOnBackdropClick=false），避免误触幕布丢失三选一等关键步骤。
 */

export default function PoolResultModalFrame({
  title,
  onClose,
  children,
  footerExtra = null,
  closeOnBackdropClick = false,
  confirmDisabled = false,
  confirmLabel = '确认',
  /** 提交中：禁用按钮但不改文案，避免弹窗高度/宽度抖动 */
  confirmBusy = false,
  panelClassName = 'max-w-md',
}) {
  const handleBackdropClick = closeOnBackdropClick ? onClose : undefined;
  const btnDisabled = confirmDisabled || confirmBusy;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[210]"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[211] flex items-center justify-center px-4 pointer-events-none overflow-y-auto py-8">
        <div
          className={`bg-stone-900 border-2 border-amber-600/50 rounded-2xl p-4 ${panelClassName} w-full shadow-2xl pointer-events-auto my-auto`}
          role="dialog"
          aria-modal="true"
          aria-busy={confirmBusy || undefined}
        >
          <h3 className="text-amber-400 text-center font-bold mb-4">{title}</h3>
          {children}
          {footerExtra}
          <button
            type="button"
            onClick={onClose}
            disabled={btnDisabled}
            className={`w-full mt-4 py-2 rounded-lg text-sm transition-colors
              ${btnDisabled
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-stone-700 hover:bg-stone-600 text-stone-300'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
