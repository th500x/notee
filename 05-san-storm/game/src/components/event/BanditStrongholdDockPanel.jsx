/**
 * 战略大地图：点击匪寨锚点后的信息区（与 `ExploreLocationDockPanel` 同构的 Tailwind 分段）。
 * 次数规则：每 8 小时整点档 +6、上限 18、初始 6；与探索配额 API 分立。
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
 *   max: number,
 *   minutesUntilRefill: number,
 *   refillPerWindow: number,
 *   canAttack: boolean,
 *   onAttack: () => void | Promise<void>,
 *   interactionsLocked?: boolean,
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
  max,
  minutesUntilRefill,
  refillPerWindow,
  interactionsLocked = false,
  canAttack,
  onAttack,
}) {
  const [busy, setBusy] = useState(false);

  const handleAttack = async () => {
    if (!canAttack || busy) return;
    setBusy(true);
    try {
      await onAttack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-h-[42vh] overflow-y-auto px-3 py-2 border-b border-stone-700 text-sm text-stone-200">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium min-w-0 text-amber-200/95 leading-tight">{title}</div>
        {difficultyHint ? (
          <div className="shrink-0 text-[10px] text-stone-400 text-right leading-tight max-w-[11rem]">
            {difficultyHint}
          </div>
        ) : null}
      </div>

      <div className="text-stone-500 text-[10px] mt-1.5 leading-snug space-y-0.5">
        <div>
          当前层数{' '}
          <span className="text-stone-300 tabular-nums">{loading ? '…' : nextLayer}</span>
          <span className="text-stone-600"> / </span>
          个人共{' '}
          <span className="text-stone-300 tabular-nums">{loading ? '…' : personalTotalLayers}</span> 层
        </div>
        <div>
          匪寨生命值（层数累计）
          {worldDurability ? (
            <>
              ：
              <span className="text-stone-300 tabular-nums">{worldDurability.layersRemaining}</span>
              <span className="text-stone-600"> / </span>
              <span className="text-stone-300 tabular-nums">{worldDurability.maxLayers}</span>
              <span className="text-stone-600">（已耗 {worldDurability.clearedLayers}）</span>
            </>
          ) : (
            <span className="text-stone-600">：—</span>
          )}
        </div>
      </div>

      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        ⚔️ 战斗：
        {loading ? (
          <span className="text-stone-400">加载中…</span>
        ) : (
          <span className={remaining > 0 ? 'text-green-400' : 'text-red-400'}>
            {remaining}/{max}
          </span>
        )}
        {!loading && remaining < max ? (
          <span className="text-stone-500 ml-1">（{minutesUntilRefill} 分后下一档整点）</span>
        ) : null}
      </div>

      <div className="text-stone-500 text-[10px] mt-1 leading-snug space-y-0.5">
        <div>
          每8小时+{refillPerWindow}次 · 上限{max}次
        </div>
        <div>0:00~8:00</div>
        <div>8:00~16:00</div>
        <div>16:00~24:00</div>
      </div>

      {!interactionsLocked ? (
        <button
          type="button"
          disabled={!canAttack || busy || loading}
          onClick={() => void handleAttack()}
          className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-700 to-red-700 text-amber-50 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500"
        >
          {busy ? '…' : '⚔️ 攻打匪寨'}
        </button>
      ) : null}
    </div>
  );
}
