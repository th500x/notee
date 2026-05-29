'use strict';

/**
 * 攻城奖赏 · 个人/势力池 拆分（11-3 §3.2 · 城战奖赏）
 *
 * **纯函数**：不读库、不读配置；只接受「净银两 / 净粮草」与 `personalSharePct`，返回拆分结果。
 * 适用面：PVE `cityService.recordSiegeResult`、PVP 攻方 `pvpWarService.recordAttackerCitySiegeResult`、
 * PVP 守方打大本营 `pvpWarService.recordBaseCampSiegeResult`。
 *
 * 公式（11-3 §3.2）：
 *   - `personalSilver = floor(netSilver × personalSharePct / 100)`
 *   - `factionSilver  = netSilver − personalSilver`     —— 余数归势力池，与 §3.2 R4 一致
 *   - 粮草 同 公式；当前结算路径 `netFood = 0`（攻城无击杀粮）—— 仍保留参数与字段，方便未来引入击杀粮时无需再改 split。
 *
 * **不参与拆分**：声望（reputation）、贡献（contribution）、装备掉落 —— 100% 个人，永远不进本函数。
 *
 * 边界：
 *   - `netSilver`/`netFood` 应为 **≥ 0** 的整数（事务上层用 `Math.max(0, ...)` 兜底）；负值直接全归个人，势力池不入账。
 *   - `personalSharePct` ∈ [0, 100]，整数；非整数将 `Math.round`。
 *   - `personalSharePct === 100` 时退化为「全个人」，与「政策实装前 / 无政策行」表现一致。
 *
 * @module shared/utils/siegeRewardSplitPolicy
 */

/**
 * @param {{
 *   netSilver?: number,
 *   netFood?: number,
 *   personalSharePct: number,
 * }} input
 * @returns {{
 *   personalSilver: number,
 *   factionSilver: number,
 *   personalFood: number,
 *   factionFood: number,
 *   personalSharePct: number,
 * }}
 */
function applyToSiegeReward(input) {
  const netSilver = Math.max(0, Math.floor(Number(input?.netSilver) || 0));
  const netFood = Math.max(0, Math.floor(Number(input?.netFood) || 0));
  const rawPct = Number(input?.personalSharePct);
  const personalSharePct = Math.max(
    0,
    Math.min(100, Number.isFinite(rawPct) ? Math.round(rawPct) : 100),
  );

  if (netSilver === 0 && netFood === 0) {
    return {
      personalSilver: 0,
      factionSilver: 0,
      personalFood: 0,
      factionFood: 0,
      personalSharePct,
    };
  }

  const personalSilver = Math.floor((netSilver * personalSharePct) / 100);
  const personalFood = Math.floor((netFood * personalSharePct) / 100);
  return {
    personalSilver,
    factionSilver: netSilver - personalSilver,
    personalFood,
    factionFood: netFood - personalFood,
    personalSharePct,
  };
}

module.exports = {
  applyToSiegeReward,
};
