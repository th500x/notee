/**
 * 匪寨层间连战：粮草快补兵力（结算「继续」可选）
 * 前端 ESM 入口；算法须与 `banditBetweenLayerHeal.cjs` 一致，改逻辑时请同步两处。
 */

/** @typedef {'light'|'heavy'} BanditBetweenLayerHealTier */

export const BANDIT_BETWEEN_LAYER_HEAL_LIGHT = 40;
export const BANDIT_BETWEEN_LAYER_HEAL_HEAVY = 80;
/** 慢恢复口径约 10 兵 ≈ 1 粮；快补乘权重 */
/** 轻补：+40 → 4×1.5 = 每支实际受益 6 粮 */
export const BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT = 6;
/** 重补：+80 → 8×2.0 = 每支实际受益 16 粮（相对慢恢复的 2 倍权重，不是轻补单价×2） */
export const BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY = 16;

/**
 * @param {string|null|undefined} tier
 * @returns {BanditBetweenLayerHealTier|null}
 */
export function normalizeBanditBetweenLayerHealTier(tier) {
  const t = String(tier || '').trim();
  if (t === 'light' || t === 'heavy') return t;
  return null;
}

/**
 * @param {BanditBetweenLayerHealTier} tier
 * @returns {{ healAmount: number, foodPerBenefitingTroop: number }}
 */
export function banditBetweenLayerHealTierSpec(tier) {
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

/**
 * @param {{
 *   troops: Array<{ instanceId?: string|number, currentTroops?: number, maxTroops?: number }>,
 *   tier: BanditBetweenLayerHealTier,
 * }} args
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   foodCost: number,
 *   healAmount: number,
 *   foodPerBenefitingTroop: number,
 *   updates: Array<{ instanceId: string, currentTroops: number, maxTroops: number, actualGain: number }>,
 * }}
 */
export function computeBanditBetweenLayerHeal({ troops, tier }) {
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
