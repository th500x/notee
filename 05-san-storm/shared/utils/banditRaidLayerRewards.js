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

/** 通关第 8 / 14 / 18 / 20 层时，在当层基础奖励之外追加的银两（与 17-7 §7 一致） */
const LAYER_MILESTONE_SILVER = {
  8: 80,
  14: 120,
  18: 120,
  20: 80,
};

const TIER_LABEL_CN = {
  normal: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传奇',
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
/**
 * 当层「基础」奖励（不含通关档里程碑银两）。
 * @param {number} layer
 */
export function buildBanditLayerBaseLoot(layer) {
  const maxP = Math.max(1, Math.floor(Number(BANDIT_PERSONAL_TOTAL_LAYERS)) || 20);
  const L = Math.max(1, Math.min(maxP, Math.floor(Number(layer)) || 1));
  const tier = banditTierFromLayer(L);
  const base = TIER_IMMEDIATE[tier] || TIER_IMMEDIATE.normal;
  const slots = banditNpcSlotRaritiesFromLayer(L);
  const bestEnemyRarity = slots.length ? bestRarityOf(...slots) : 'common';
  return {
    layer: L,
    tier,
    tierLabel: TIER_LABEL_CN[tier] || tier,
    reputation: base.reputation,
    silver: base.silver,
    food: base.food,
    bestEnemyRarity,
    rollEquipment: true,
  };
}

/**
 * 通关档里程碑追加（仅 8 / 14 / 18 / 20 层有银两加成；无则 null）。
 * @param {number} layer
 * @returns {{ layer: number, tier: string, tierLabel: string, silver: number, food: number }|null}
 */
export function buildBanditLayerMilestoneLoot(layer) {
  const maxP = Math.max(1, Math.floor(Number(BANDIT_PERSONAL_TOTAL_LAYERS)) || 20);
  const L = Math.max(1, Math.min(maxP, Math.floor(Number(layer)) || 1));
  const extraSilver = LAYER_MILESTONE_SILVER[L];
  if (!extraSilver) return null;
  const tier = banditTierFromLayer(L);
  return {
    layer: L,
    tier,
    tierLabel: TIER_LABEL_CN[tier] || tier,
    silver: extraSilver,
    food: 0,
  };
}

/**
 * 匪寨单层胜利即时奖励（基础 + 里程碑合计，供发奖 API 使用）。
 * @param {number} layer
 */
export function buildBanditLayerSmallMapPveLoot(layer) {
  const base = buildBanditLayerBaseLoot(layer);
  const milestone = buildBanditLayerMilestoneLoot(layer);
  const silver = base.silver + (milestone?.silver || 0);
  return {
    ...base,
    silver,
    baseSilver: base.silver,
    baseFood: base.food,
    milestone,
  };
}
