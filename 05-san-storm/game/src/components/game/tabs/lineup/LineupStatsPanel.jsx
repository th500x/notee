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

import { useCharacterRank } from '@/hooks/useCharacterRank';
import { estimateLineupCombatPower } from '@shared/utils/lineupCombatPower.js';

export default function LineupStatsPanel({
  player,
  troops,
  compact = false,
  attrs = null,
  attributeBonus = null,
  characterRarity = null,
  playerId = null,
  rankBucket = null,
}) {
  const rankInfo = useCharacterRank(playerId, rankBucket);
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

  return (
    <div className={`${compact ? 'mx-0 mt-1 mb-1 p-2' : 'mx-3 mt-2 mb-2 p-3'} bg-stone-800/50 rounded-lg border border-stone-700/30`}>
      <h4 className="text-stone-400 text-xs font-medium mb-2">📊 编组数据</h4>

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
