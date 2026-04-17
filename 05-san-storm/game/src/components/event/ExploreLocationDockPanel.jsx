/**
 * 探索底栏：地点标题 + 可探索事件数 + 次数 + 适用道具 +「开始探索」
 * 大地图底栏荒郊条与战略城 tooltip 荒郊/集市分段共用（探索点为主城 `city_id` + `wildernessEnabled`）。
 */

import { useMemo } from 'react';
import {
  summarizeExplorePoolEnemyTroopRarityRange,
  wildernessEnemyTroopRarityDocRangeFromMainCityType,
  resolveCityTypeForWildernessTroopHint,
  collectExplorePoolDistinctItemIds,
} from '@/components/event/eventUtils';
import { getRarityLabelCn } from '@/constants';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';

/** @typedef {{ remaining: number, max: number, canExplore: boolean, refillPerHour: number, minutesUntilRefill: number, inRestPeriod: boolean }} ExploreQuotaLike */

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
}) {
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
        .map((e) => e?.event_id)
        .filter(Boolean)
        .sort()
        .join('\0');

  const cityTypeForWildernessHint =
    wildernessCityType != null && String(wildernessCityType).trim() !== ''
      ? String(wildernessCityType).trim()
      : resolveCityTypeForWildernessTroopHint(citiesList, exploreLocationId);

  const docWildernessTroopRange = useMemo(
    () => wildernessEnemyTroopRarityDocRangeFromMainCityType(cityTypeForWildernessHint),
    [cityTypeForWildernessHint],
  );

  const poolItemIds = useMemo(
    () => collectExplorePoolDistinctItemIds(poolEvents),
    [poolIdKey],
  );

  const enemyTroopRarityHint = useMemo(() => {
    if (!showEnemyTroopRarityHint || !exploreLocationId || eventsLoading) return null;
    if (isBanditMapObjectId(exploreLocationId)) {
      return '难度：传奇（惩罚战·四槽固定）';
    }
    if (docWildernessTroopRange) {
      const a = getRarityLabelCn(docWildernessTroopRange.min);
      const b = getRarityLabelCn(docWildernessTroopRange.max);
      if (a && b) return `难度：${a}-${b}`;
      return null;
    }
    const sum = summarizeExplorePoolEnemyTroopRarityRange(poolEvents, exploreLocationId);
    if (!sum.hasPunitiveBattle) return '惩罚战敌军：本池无';
    const a = getRarityLabelCn(sum.min);
    const b = getRarityLabelCn(sum.max);
    if (a && b) return `难度：${a}-${b}`;
    return null;
  }, [
    showEnemyTroopRarityHint,
    exploreLocationId,
    eventsLoading,
    docWildernessTroopRange,
    poolIdKey,
  ]);

  return (
    <div
      className={`max-h-[42vh] overflow-y-auto px-3 py-2 border-b border-stone-700 text-sm text-stone-200${rootClassName ? ` ${rootClassName}` : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className={`font-medium min-w-0 ${titleCls}`}>{title}</div>
        {enemyTroopRarityHint ? (
          <div className="shrink-0 text-[10px] text-stone-400 text-right leading-tight max-w-[10rem]">
            {enemyTroopRarityHint}
          </div>
        ) : null}
      </div>
      <div className="text-stone-400 text-xs mt-0.5">
        {eventsLoading
          ? '加载中...'
          : !quota.canExplore
            ? '探索次数不足'
            : poolEmpty
              ? '本地点暂无可探索事件'
              : `可探索（${poolLen}种事件）`}
      </div>
      {poolEmpty && quota.canExplore && (
        <div className="text-stone-500 text-[10px] mt-0.5">
          次日 0 点（服务器日期）后事件链等进度将重置
        </div>
      )}
      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        🔍 探索：
        <span className={quota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
          {quota.remaining}/{quota.max}
        </span>
        {quota.remaining < quota.max && !quota.inRestPeriod && (
          <span className="text-stone-500 ml-1">（{quota.minutesUntilRefill}分后补充）</span>
        )}
        {quota.inRestPeriod && (
          <span className="text-stone-500 ml-1">（💤{quota.minutesUntilRefill}分后恢复）</span>
        )}
      </div>
      <div className="text-stone-500 text-[10px] mt-1">
        每小时+{quota.refillPerHour}次 · 上限{quota.max}次 · 0:00~8:00💤
      </div>
      {exploreItems.length > 0 && (
        <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
          🎒 道具：
          {exploreItems.map((item, i) => (
            <span key={item.itemId} className="text-amber-300">
              {i > 0 && '、'}
              {item.name}×{item.quantity}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => canStart && onStartExplore()}
        className={`mt-3 w-full py-2 rounded-lg text-xs font-bold ${btnCls} disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500`}
      >
        {canStart ? `${startEmoji} 开始探索` : '不可探索'}
      </button>
      {!eventsLoading && poolLen > 0 && (
        <div className="mt-3 border-t border-stone-600 pt-2">
          <div className="text-stone-500 text-[10px] font-medium mb-1">📦 事件池道具</div>
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
            <div className="text-stone-500 text-[10px]">本池当前无配置类事件道具（仅有资源/随机卡等）</div>
          )}
        </div>
      )}
    </div>
  );
}
