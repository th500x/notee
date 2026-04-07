/**
 * 驻地编组数据面板 — 显示单将领的战力/暴击/闪避/粮草消耗与排名
 * 复用 LineupTab 的 LineupStatsPanel 计算公式
 */

import { useCharacterRank } from '@/hooks/useCharacterRank';

export default function GarrisonStatsPanel({
  garrison,
  charKey,
  cards,
  getCardFromGarrison,
  compact = false,
  attributeBonus = {},
  playerId = null,
}) {
  const rankBucket = garrison?.garrison_slot != null && charKey
    ? `garrison:${garrison.garrison_slot}:${charKey}`
    : null;
  const rankInfo = useCharacterRank(playerId, rankBucket);

  if (!garrison) return null;

  const charCard = getCardFromGarrison(`${charKey}_card`);
  if (!charCard) return null;

  const cfg = charCard.config || {};

  const combat  = (cfg.combat  ?? 0) + ((attributeBonus.combat  || 0) / 10);
  const command = (cfg.command ?? 0) + ((attributeBonus.command  || 0) / 10);
  const courage = (cfg.courage ?? 0) + ((attributeBonus.courage  || 0) / 10);
  const luck    = (cfg.luck    ?? 0) + ((attributeBonus.luck     || 0) / 10);

  const troop1 = getCardFromGarrison(`${charKey}_troop1`);
  const troop2 = getCardFromGarrison(`${charKey}_troop2`);
  const troops = [troop1, troop2].filter(Boolean);

  if (troops.length === 0) return null;

  let totalPower = 0;
  let totalDeployCost = 0;

  troops.forEach(card => {
    const tc           = card.config || {};
    const atk          = tc.attack || 0;
    const def          = tc.defense || 0;
    const maxTroops    = (tc.maxTroops || 0) + (card.bonus_max_troops || 0);
    const currentTroops = card.current_troops ?? maxTroops;

    const unitAtk   = (atk + combat * 6) * (1 + courage / 40);
    const unitDef   = def + command * 5 + combat * 3;
    totalPower      += Math.round((unitAtk + unitDef) * currentTroops / 1000);
    totalDeployCost += Math.ceil(currentTroops / 20);
  });

  const critRate  = ((courage + luck) / 80 * 100).toFixed(1);
  const dodgeRate = luck.toFixed(1);

  return (
    <div className={`${compact ? 'mx-0 mt-1 mb-1 p-2' : 'mx-3 mt-2 mb-2 p-3'} bg-stone-800/50 rounded-lg border border-stone-700/30`}>
      <h4 className="text-stone-400 text-xs font-medium mb-2">📊 编组数据</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-stone-500">⚔️ 组合战力</span>
          <span className="text-amber-400 font-bold">{totalPower || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">💥 暴击率</span>
          <span className="text-orange-400">{critRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🌾 防守消耗</span>
          <span className="text-green-400">{totalDeployCost || '—'} 粮</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🎲 闪避率</span>
          <span className="text-cyan-400">{dodgeRate}%</span>
        </div>
        <div className="col-span-2 flex items-center justify-between border-t border-stone-700/30 pt-1.5 mt-0.5">
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
