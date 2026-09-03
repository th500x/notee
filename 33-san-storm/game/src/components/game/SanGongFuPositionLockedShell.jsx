/**
 * 三公府 · 品阶未达门闸：深灰半透明遮罩 + 底层真实 UI 预览（朝政 / 军团共用）
 * 底层 `pointer-events-none` 仅展示；遮罩层拦截一切操作。
 */

/**
 * @param {{ label: string, children: import('react').ReactNode }} props
 */
export default function SanGongFuPositionLockedShell({ label, children }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-lg">
      <div className="h-full min-h-0 overflow-y-auto pointer-events-none select-none">
        {children}
      </div>
      <div
        className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-stone-950/45 backdrop-blur-[1px]"
        aria-label={label}
        role="presentation"
      >
        <p className="rounded-md border border-stone-500/55 bg-stone-900/70 px-3 py-1.5 text-sm font-semibold text-stone-300 shadow-md">
          {label}
        </p>
      </div>
    </div>
  );
}
