/**
 * 匪寨层间连战：粮草快补兵力（结算「继续」可选）
 * 须与 banditBetweenLayerHeal.js 同步。
 */

'use strict';

const BANDIT_BETWEEN_LAYER_HEAL_LIGHT = 40;
const BANDIT_BETWEEN_LAYER_HEAL_HEAVY = 80;
const BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT = 6;
/** 重补：+80 → 8×2.0 = 16（相对慢恢复 2 倍权重；须与 .js 同步） */
const BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY = 16;

function normalizeBanditBetweenLayerHealTier(tier) {
  const t = String(tier || '').trim();
  if (t === 'light' || t === 'heavy') return t;
  return null;
}

function banditBetweenLayerHealTierSpec(tier) {
  if (tier === 'heavy') {
    return {
      healAmount: BANDIT_BETWEEN_LAYER_HEAL_HEAVY,
      foodPerBenefitingTroop: BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY,
    };
  }
  return {
    healAmount: BANDIT_BETWEEN_LAYER_HEAL_LIGHT,
    foodPerBenefitingTroop: BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT,
  };
}

function computeBanditBetweenLayerHeal({ troops, tier }) {
  const normalized = normalizeBanditBetweenLayerHealTier(tier);
  if (!normalized) {
    return {
      ok: false,
      error: '无效的补兵档位',
      foodCost: 0,
      healAmount: 0,
      foodPerBenefitingTroop: 0,
      updates: [],
    };
  }
  if (!Array.isArray(troops) || troops.length === 0) {
    return {
      ok: false,
      error: '缺少部队列表',
      foodCost: 0,
      healAmount: 0,
      foodPerBenefitingTroop: 0,
      updates: [],
    };
  }

  const { healAmount, foodPerBenefitingTroop } = banditBetweenLayerHealTierSpec(normalized);
  const updates = [];
  let foodCost = 0;
  const seen = new Set();

  for (const raw of troops) {
    const instanceId =
      raw?.instanceId != null && String(raw.instanceId).trim() !== ''
        ? String(raw.instanceId).trim()
        : '';
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);

    const maxTroops = Math.max(0, Math.round(Number(raw.maxTroops) || 0));
    const current = Math.max(0, Math.round(Number(raw.currentTroops) || 0));
    if (maxTroops <= 0) continue;

    const room = Math.max(0, maxTroops - current);
    const actualGain = Math.min(healAmount, room);
    const next = Math.min(maxTroops, current + actualGain);
    updates.push({
      instanceId,
      currentTroops: next,
      maxTroops,
      actualGain,
    });
    if (actualGain > 0) foodCost += foodPerBenefitingTroop;
  }

  if (updates.length === 0) {
    return {
      ok: false,
      error: '没有可补兵的部队',
      foodCost: 0,
      healAmount,
      foodPerBenefitingTroop,
      updates: [],
    };
  }

  return {
    ok: true,
    foodCost,
    healAmount,
    foodPerBenefitingTroop,
    updates,
  };
}

module.exports = {
  BANDIT_BETWEEN_LAYER_HEAL_LIGHT,
  BANDIT_BETWEEN_LAYER_HEAL_HEAVY,
  BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT,
  BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY,
  normalizeBanditBetweenLayerHealTier,
  banditBetweenLayerHealTierSpec,
  computeBanditBetweenLayerHeal,
};
