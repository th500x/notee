/**
 * 战略大地图：点击匪寨锚点后的信息区（与 `ExploreLocationDockPanel` 同构的 Tailwind 分段）。
 * 攻打消耗：每次 `item_tactic_token`（兵符）×1；无兵符不可攻打。
 */

import { useState } from 'react';

/**
 * @param {{
 *   title: string,
 *   difficultyHint: string|null,
 *   nextLayer: number,
 *   personalTotalLayers: number,
 *   worldDurability: { maxLayers: number, clearedLayers: number, layersRemaining: number } | null,
 *   loading: boolean,
 *   remaining: number,
 *   costPerBattle?: number,
 *   canAttack: boolean,
 *   onAttack: () => void | Promise<void>,
 *   interactionsLocked?: boolean,
 *   rootClassName?: string,
 * }} props
 */
export default function BanditStrongholdDockPanel({
  title,
  difficultyHint,
  nextLayer,
  personalTotalLayers,
  worldDurability,
  loading,
  remaining,
  costPerBattle = 1,
  interactionsLocked = false,
  canAttack,
  onAttack,
  rootClassName = '',
}) {
  const [busy, setBusy] = useState(false);
  const tokens = Math.max(0, Math.floor(Number(remaining) || 0));
  const cost = Math.max(1, Math.floor(Number(costPerBattle) || 1));

  const handleAttack = async () => {
    if (!canAttack || busy) return;
    setBusy(true);
    try {
      await onAttack();
    } finally {
      setBusy(false);
    }
  };

  const rootCls =
    (rootClassName && String(rootClassName).trim()) ||
    'max-h-[42vh] overflow-y-auto px-3 py-2 border-b border-stone-700 text-sm text-stone-200';

  return (
    <div className={rootCls}>
      <div className="flex items-baseline justify-between gap-2 min-h-[1.25rem]">
        <div className="font-medium min-w-0 text-amber-200/95 leading-tight">{title}</div>
        <div className="shrink-0 text-[10px] text-stone-400 text-right leading-tight max-w-[11rem]">
          {difficultyHint || (loading ? '难度：…' : '难度：—')}
        </div>
      </div>

      <div className="text-stone-500 text-[10px] mt-1.5 leading-snug space-y-0.5 min-h-[3.25rem]">
        <div>
          当前层数{' '}
          <span className="text-stone-300 tabular-nums">{loading ? '…' : nextLayer}</span>
          <span className="text-stone-600"> / </span>
          个人共{' '}
          <span className="text-stone-300 tabular-nums">{loading ? '…' : personalTotalLayers}</span> 层
        </div>
        <div>
          匪寨生命值(层数累计):
          {worldDurability ? (
            <>
              <span className="text-stone-300 tabular-nums">{worldDurability.layersRemaining}</span>
              <span className="text-stone-600">/</span>
              <span className="text-stone-300 tabular-nums">{worldDurability.maxLayers}</span>
            </>
          ) : (
            <span className="text-stone-600">—</span>
          )}
        </div>
        <div className="text-stone-600">
          尾刀额外获得黄巾徽章
        </div>
      </div>

      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        ⚔️ 兵符：
        {loading ? (
          <span className="text-stone-400">加载中…</span>
        ) : (
          <span className={tokens >= cost ? 'text-green-400' : 'text-red-400'}>{tokens}</span>
        )}
      </div>

      <div className="text-stone-500 text-[10px] mt-1 leading-snug min-h-[2.5em]">
        每次从大地图攻打消耗兵符 ×{cost}；胜利后「继续」不消耗
      </div>

      {!interactionsLocked ? (
        <button
          type="button"
          disabled={!canAttack || busy || loading}
          onClick={() => void handleAttack()}
          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-orange-700 to-red-700 text-amber-50 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500"
        >
          {busy ? '…' : '⚔️ 攻打匪寨'}
        </button>
      ) : (
        <div
          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold text-center text-stone-500 bg-stone-800/50 border border-stone-700/60"
          aria-hidden
        >
          —
        </div>
      )}
    </div>
  );
}
