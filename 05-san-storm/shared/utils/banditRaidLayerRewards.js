/**
 * 匪寨爬塔单层奖励与层进度工具（17-7 §7；与 `smallMapEnemyRoster` 同链）。
 * @module @shared/utils/banditRaidLayerRewards
 */

import {
  BANDIT_PERSONAL_TOTAL_LAYERS,
  banditNpcSlotRaritiesFromLayer,
  banditTierFromLayer,
  bestRarityOf,
} from './smallMapEnemyRoster.js';

const TIER_IMMEDIATE = {
  normal: { reputation: 1, silver: 10, food: 50 },
  rare: { reputation: 2, silver: 20, food: 100 },
  epic: { reputation: 3, silver: 30, food: 150 },
  legendary: { reputation: 4, silver: 40, food: 200 },
};

/**
 * `player_progress.bandit_progress` 中 per-匪寨 **`nextLayer`**：1…N 为待挑战层，**N+1** 表示已通 N 层（如 21=20 层全通）。
 * @param {number|string|null|undefined} storedNext
 * @param {number} [maxLayers]
 * @returns {number|null} 当前应打的层 1…maxLayers；已全通返回 **null**
 */
export function banditCombatLayerFromStoredNext(storedNext, maxLayers = BANDIT_PERSONAL_TOTAL_LAYERS) {
  const maxP = Math.max(1, Math.floor(Number(maxLayers)) || BANDIT_PERSONAL_TOTAL_LAYERS);
  const s = Math.floor(Number(storedNext));
  if (!Number.isFinite(s) || s < 1) return 1;
  if (s > maxP) return null;
  return s;
}

/**
 * 单层胜利后写入 JSON 的 **`nextLayer`**。
 * @param {number} attackedLayer 本场胜利的层（1…maxLayers）
 * @param {number} [maxLayers]
 * @returns {number}
 */
export function banditStoredNextLayerAfterVictory(attackedLayer, maxLayers = BANDIT_PERSONAL_TOTAL_LAYERS) {
  const maxP = Math.max(1, Math.floor(Number(maxLayers)) || BANDIT_PERSONAL_TOTAL_LAYERS);
  const L = Math.floor(Number(attackedLayer));
  if (!Number.isFinite(L) || L < 1 || L > maxP) return 1;
  return L >= maxP ? maxP + 1 : L + 1;
}

/**
 * 供 `POST /api/battles` **`rewards.smallMapPveLoot`** 与 `applyDeclaredSmallMapPveLoot` 使用（仅数值 + 装备池稀有度）。
 * @param {number} layer 当前挑战层 1…20
 * @returns {{ reputation: number, silver: number, food: number, bestEnemyRarity: string, rollEquipment: boolean }}
 */
export function buildBanditLayerSmallMapPveLoot(layer) {
  const maxP = Math.max(1, Math.floor(Number(BANDIT_PERSONAL_TOTAL_LAYERS)) || 20);
  const L = Math.max(1, Math.min(maxP, Math.floor(Number(layer)) || 1));
  const tier = banditTierFromLayer(L);
  const base = TIER_IMMEDIATE[tier] || TIER_IMMEDIATE.normal;
  let silver = base.silver;
  if (L === 8) silver += 80;
  if (L === 14) silver += 120;
  if (L === 18) silver += 120;
  if (L === 20) silver += 80;
  const slots = banditNpcSlotRaritiesFromLayer(L);
  const bestEnemyRarity = slots.length ? bestRarityOf(...slots) : 'common';
  return {
    reputation: base.reputation,
    silver,
    food: base.food,
    bestEnemyRarity,
    rollEquipment: true,
  };
}
