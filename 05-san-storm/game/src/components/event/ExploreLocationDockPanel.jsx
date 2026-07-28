/**
 * 探索底栏：地点标题 + 可探索事件数 + 兵符 +「开始探索」
 * 战场入口与战略城内嵌条共用（14-1：开链扣 `item_tactic_token`×1）。
 * 与 `BanditStrongholdDockPanel` 同构：标题行 / 两行信息区 / 兵符 / 说明 / 按钮；
 * 池空时仍占位难度与第二行，避免双面板错位。
 */

import { useMemo } from 'react';
import { collectExplorePoolDistinctItemIds } from '@/components/event/eventUtils';
import { explorePoolChainLevelDifficultyHint } from '@shared/utils/smallMapEnemyRoster';

/** @typedef {{ remaining: number, max?: number, canExplore: boolean, refillPerHour?: number, minutesUntilRefill?: number, inRestPeriod?: boolean, costKind?: string, costPerChain?: number }} ExploreQuotaLike */

/**
 * @param {{
 *   title: string,
 *   eventsLoading: boolean,
 *   quota: ExploreQuotaLike,
 *   poolLen: number,
 *   poolEmpty: boolean,
 *   exploreItems: Array<{ itemId: string, name?: string, quantity?: number }>,
 *   canStart: boolean,
 *   onStartExplore: () => void,
 *   colorTheme?: 'amber' | 'sky' | 'emerald',
 *   startEmoji?: string,
 *   rootClassName?: string,
 *   showEnemyTroopRarityHint?: boolean,
 *   exploreLocationId?: string|null,
 *   poolEvents?: Array<Record<string, unknown>>|null,
 *   wildernessCityType?: string|null,
 *   citiesList?: Array<Record<string, unknown>>|null,
 *   itemNameMap?: Record<string, string>|null,
 *   statusOverride?: string|null,
 * }} props
 */
export default function ExploreLocationDockPanel({
  title,
  eventsLoading,
  quota,
  poolLen,
  poolEmpty,
  exploreItems,
  canStart,
  onStartExplore,
  colorTheme = 'amber',
  startEmoji = '📜',
  rootClassName = '',
  showEnemyTroopRarityHint = false,
  exploreLocationId = null,
  poolEvents = null,
  wildernessCityType = null,
  citiesList = null,
  itemNameMap = null,
  statusOverride = null,
}) {
  void wildernessCityType;
  void citiesList;
  void exploreLocationId;

  const titleCls =
    colorTheme === 'sky'
      ? 'text-sky-200/95'
      : colorTheme === 'emerald'
        ? 'text-emerald-200/95'
        : 'text-amber-200/95';
  const btnCls =
    colorTheme === 'sky'
      ? 'bg-gradient-to-r from-sky-800 to-cyan-800 text-sky-100'
      : colorTheme === 'emerald'
        ? 'bg-gradient-to-r from-emerald-700 to-teal-800 text-emerald-50'
        : 'bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100';

  const poolIdKey = !Array.isArray(poolEvents)
    ? ''
    : poolEvents
        .map((e) => `${e?.event_id ?? ''}:${e?.chain_level ?? e?.chainLevel ?? ''}`)
        .filter(Boolean)
        .sort()
        .join('\0');

  const poolItemIds = useMemo(
    () => collectExplorePoolDistinctItemIds(poolEvents),
    [poolIdKey],
  );

  /** 与左侧匪寨难度行同槽：加载中 / 池空也占位，避免标题行高度塌缩 */
  const enemyTroopRarityHint = useMemo(() => {
    if (!showEnemyTroopRarityHint) return null;
    if (eventsLoading) return '难度：…';
    return explorePoolChainLevelDifficultyHint(poolEvents) || '难度：—';
  }, [showEnemyTroopRarityHint, eventsLoading, poolIdKey]);

  const tokens = Math.max(0, Math.floor(Number(quota?.remaining) || 0));
  const cost = Math.max(1, Math.floor(Number(quota?.costPerChain) || 1));
  const isTokenCost = quota?.costKind === 'tactic_token' || quota?.refillPerHour === 0;

  const rootCls =
    (rootClassName && String(rootClassName).trim()) ||
    'max-h-[42vh] overflow-y-auto px-3 py-2 border-b border-stone-700 text-sm text-stone-200';

  const statusLine =
    statusOverride != null && String(statusOverride).trim() !== ''
      ? String(statusOverride).trim()
      : eventsLoading
        ? '加载中...'
        : !canStart && tokens < cost && poolLen > 0
          ? '兵符不足'
          : poolEmpty
            ? '本地点暂无可探索事件'
            : `可探索（${poolLen}种事件）`;

  /** 第二行与左侧「匪寨生命值」对齐：有背包道具则展示，否则占位 */
  const secondInfoLine =
    exploreItems.length > 0 ? (
      <>
        背包道具：
        {exploreItems.map((item, i) => (
          <span key={item.itemId} className="text-amber-300/90">
            {i > 0 && '、'}
            {item.name}×{item.quantity}
          </span>
        ))}
      </>
    ) : (
      <span className="text-stone-600">背包道具：—</span>
    );

  return (
    <div className={rootCls}>
      <div className="flex items-baseline justify-between gap-2 min-h-[1.25rem]">
        <div className={`font-medium min-w-0 leading-tight ${titleCls}`}>{title}</div>
        {enemyTroopRarityHint ? (
          <div className="shrink-0 text-[10px] text-stone-400 text-right leading-tight max-w-[11rem]">
            {enemyTroopRarityHint}
          </div>
        ) : (
          <div className="shrink-0 text-[10px] leading-tight max-w-[11rem] invisible" aria-hidden>
            难度：—
          </div>
        )}
      </div>

      <div className="text-stone-500 text-[10px] mt-1.5 leading-snug space-y-0.5 min-h-[2.5rem]">
        <div>{statusLine}</div>
        <div>{secondInfoLine}</div>
        {/* 与左侧匪寨「尾刀/重生」说明行对齐占位 */}
        <div className="invisible" aria-hidden>
          —
        </div>
      </div>

      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        🎖️ 兵符：
        {eventsLoading ? (
          <span className="text-stone-400">加载中…</span>
        ) : (
          <span className={tokens >= cost ? 'text-green-400' : 'text-red-400'}>{tokens}</span>
        )}
      </div>

      <div className="text-stone-500 text-[10px] mt-1 leading-snug min-h-[2.5em]">
        {isTokenCost
          ? `开一条事件链消耗兵符 ×${cost}；同链连打/续作不再扣`
          : `每小时+${quota?.refillPerHour ?? 0}次 · 上限${quota?.max ?? 0}次`}
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={() => canStart && onStartExplore()}
        className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold ${btnCls} disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500`}
      >
        {canStart ? `${startEmoji} 开始探索` : '不可探索'}
      </button>

      {!eventsLoading && poolLen > 0 ? (
        <div className="mt-2 border-t border-stone-600 pt-2">
          <div className="text-stone-500 text-[10px] font-medium mb-1 leading-snug">📦 事件池道具</div>
          {poolItemIds.length > 0 ? (
            <ul className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-stone-300 leading-snug list-none m-0 p-0">
              {poolItemIds.map((id) => (
                <li
                  key={id}
                  className="rounded border border-stone-600/80 bg-stone-900/60 px-1.5 py-0.5 text-amber-200/90"
                  title={id}
                >
                  {(itemNameMap && itemNameMap[id]) || id}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-stone-500 text-[10px] leading-snug">
              本池当前无配置类事件道具（仅有资源/随机卡等）
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
