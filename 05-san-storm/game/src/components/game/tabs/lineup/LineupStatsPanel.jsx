/**
 * 编组数据面板 — 玩家 / 将领 1 / 将领 2 各自的组合战力 / 暴击率 / 闪避率 /
 * 出征粮草消耗 / 恢复时间 / 将领排名概览。
 *
 * 战力 / 粮草公式见：
 *   - `shared/utils/lineupCombatPower.js`：组合战力（UI 估算 · 100–999）
 *   - `17-1-COMBAT_SYSTEM.md`：单兵攻击力 / 防御力（战斗流水线；与组合战力独立）
 *   - `22-1-TROOP_SYSTEM.md` + `27-1-RESOURCE_SYSTEM.md`：出征 / 恢复消耗
 *
 * 与驻地编组的 `GarrisonStatsPanel` **不复用组件** —— 那一份按驻地槽位字段拼装，
 * 但组合战力公式共用 `estimateLineupCombatPower`。
 */

import { useMemo, useRef, useState } from 'react';
import { useCharacterRank } from '@/hooks/useCharacterRank';
import { estimateLineupCombatPower } from '@shared/utils/lineupCombatPower.js';
import { buildLineupCombatBonusOverview } from '@/utils/lineupCombatBonusOverview';
import LineupBonusOverviewPopover from './LineupBonusOverviewPopover';

/** 与势力 Tab「日活跃榜」按钮同款 */
const ledgerDetailBtnClass =
  'shrink-0 rounded border border-amber-800/60 bg-amber-950/40 px-1.5 py-0 text-[10px] text-amber-300/95 underline-offset-2 hover:bg-amber-900/30 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60';

export default function LineupStatsPanel({
  player,
  troops,
  compact = false,
  attrs = null,
  attributeBonus = null,
  characterRarity = null,
  playerId = null,
  rankBucket = null,
  effectCards = null,
  includePositionBonuses = false,
  troopAffinity = null,
}) {
  const rankInfo = useCharacterRank(playerId, rankBucket);
  const bonusBtnRef = useRef(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusAnchor, setBonusAnchor] = useState(null);

  const overview = useMemo(
    () =>
      buildLineupCombatBonusOverview({
        troops: troops || [],
        effectCards: effectCards || {},
        positionConfig: player?.positionConfig || null,
        includePositionBonuses,
        troopAffinity,
        attributeBonus,
      }),
    [troops, effectCards, player?.positionConfig, includePositionBonuses, troopAffinity, attributeBonus],
  );

  if (!player && !attrs) return null;

  const combat = attrs?.combat ?? (player ? player.combat / 10 : 0);
  const command = attrs?.command ?? (player ? player.command / 10 : 0);
  const courage = attrs?.courage ?? (player ? player.courage / 10 : 0);
  const luckBase = attrs?.luck ?? (player ? player.luck / 10 : 0);
  const luck = luckBase + Number(attributeBonus?.luck || 0) / 10;
  const food = player?.food ?? 0;

  const { power: totalPower } = estimateLineupCombatPower({
    combat,
    command,
    courage,
    attributeBonus,
    characterRarity,
    troops,
  });

  let totalDeployCost = 0;
  let totalRecoverCost = 0;

  const troopStats = troops.map((card) => {
    const cfg = card.config || {};
    const maxTroops = (cfg.maxTroops || 0) + (card.bonusMaxTroops || 0);
    const currentTroops = card.currentTroops ?? maxTroops;
    const lostTroops = Math.max(0, maxTroops - currentTroops);

    const deployCost = Math.ceil(currentTroops / 20);
    const recoverCost = lostTroops > 0 ? Math.ceil(lostTroops / 10) : 0;
    const remainingMin = lostTroops > 0 ? Math.ceil(lostTroops / 10) : 0;

    totalDeployCost += deployCost;
    totalRecoverCost += recoverCost;

    return { equippedBy: card.equippedBy, deployCost, recoverCost, remainingMin, currentTroops, maxTroops };
  });

  const groupedRemaining = {};
  troopStats.forEach((t) => {
    const key = t.equippedBy || 'player';
    groupedRemaining[key] = Math.max(groupedRemaining[key] || 0, t.remainingMin);
  });
  const maxRemainingMin = Math.max(0, ...Object.values(groupedRemaining));

  const critCourage = courage + Number(attributeBonus?.courage || 0) / 10;
  const critRate = ((critCourage + luck) / 80 * 100).toFixed(1);
  const dodgeRate = luck.toFixed(1);

  const openBonusOverview = () => {
    const el = bonusBtnRef.current;
    if (!el) return;
    setBonusAnchor(el.getBoundingClientRect());
    setBonusOpen((v) => !v);
  };

  return (
    <div className={`${compact ? 'mx-0 mt-1 mb-1 p-2' : 'mx-3 mt-2 mb-2 p-3'} bg-stone-800/50 rounded-lg border border-stone-700/30`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-stone-400 text-xs font-medium">📊 编组数据</h4>
        <button
          ref={bonusBtnRef}
          type="button"
          className={ledgerDetailBtnClass}
          onClick={openBonusOverview}
        >
          加成一览
        </button>
      </div>

      <LineupBonusOverviewPopover
        open={bonusOpen}
        anchorRect={bonusAnchor}
        overview={overview}
        onClose={() => setBonusOpen(false)}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-stone-500">⚔️ 组合战力</span>
          <span className="text-amber-400 font-bold">{totalPower ?? '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">💥 暴击率</span>
          <span className="text-orange-400">{critRate}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">🌾 出征消耗</span>
          <span className="text-green-400">{totalDeployCost || '—'} 粮</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">🎲 闪避率</span>
          <span className="text-cyan-400">{dodgeRate}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">⏱️ 恢复时间</span>
          {maxRemainingMin > 0 ? (
            food >= totalRecoverCost ? (
              <span className="text-yellow-400 text-right leading-tight">
                余{maxRemainingMin}分钟<br/>（{totalRecoverCost}粮）
              </span>
            ) : (
              <span className="text-red-400">⚠️粮草不足</span>
            )
          ) : (
            <span className="text-stone-600">满编</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">🏅 将领排名</span>
          {rankInfo ? (
            <span className="text-amber-400 font-medium text-[10px]">
              第 {rankInfo.rank} / {rankInfo.total} 名
            </span>
          ) : (
            <span className="text-stone-600 text-[10px]">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
