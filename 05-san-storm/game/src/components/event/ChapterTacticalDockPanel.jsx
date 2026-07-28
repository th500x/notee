/**
 * 战场入口四宫格 · 右下「章节战棋」紧凑格
 */
const COMPACT_DOCK_CLASS = 'max-h-none overflow-y-auto px-2 py-1.5 border-0 text-xs text-stone-200';

/**
 * @param {{
 *   interactionsLocked?: boolean,
 *   onOpen?: (() => void)|null,
 *   rootClassName?: string,
 * }} props
 */
export default function ChapterTacticalDockPanel({
  interactionsLocked = false,
  onOpen = null,
  rootClassName = COMPACT_DOCK_CLASS,
}) {
  const locked = !!interactionsLocked || typeof onOpen !== 'function';
  return (
    <div className={`${rootClassName} flex h-full min-h-[7rem] flex-col items-center justify-center gap-1.5 text-center`}>
      <div className="text-[11px] font-medium text-amber-100/95 tracking-wide">章节战棋</div>
      <p className="text-[10px] text-stone-400 leading-snug px-1">
        {locked ? '抵达战场入口后方可进入' : '颍川关卡 · 剧情与战棋'}
      </p>
      <button
        type="button"
        disabled={locked}
        className="rounded bg-amber-800/90 border border-amber-600/60 px-2.5 py-1 text-[10px] text-amber-50 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-700/90"
        onClick={() => {
          if (!locked) onOpen?.();
        }}
      >
        进入
      </button>
    </div>
  );
}
