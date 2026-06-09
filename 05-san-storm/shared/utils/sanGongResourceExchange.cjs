/**
 * 三公府 · 封赏 · 银粮兑换（玩家 personal ↔ 势力 pool）
 *
 * - 名义比例 1 银 : 5 粮；松紧系数 k ∈ [0.5, 1.5] 由 pool 余量相对 1:5 失衡决定
 * - 基数 B_s = floor(档系数 × 官职 resourceBonus)，与俸禄日随机 roll 脱钩
 * - 包 A：池子发出侧 +20%；包 B：基础比例
 *
 * @see 12-1-POSITION_SYSTEM.md §4.4 · 26-1-RESOURCE_SYSTEM.md
 */

'use strict';

const FOOD_PER_SILVER = 5;
const K_MIN = 0.5;
const K_MAX = 1.5;
const PACK_A_POOL_BONUS = 0.2;

/** @type {readonly string[]} */
const PACK_IDS = Object.freeze([
  'silver_food_a',
  'silver_food_b',
  'food_silver_a',
  'food_silver_b',
]);

/** @type {Record<string, { direction: 'silver_food'|'food_silver', variant: 'a'|'b', label: string, shortLabel: string }>} */
const PACK_META = Object.freeze({
  silver_food_a: {
    direction: 'silver_food',
    variant: 'a',
    label: '银换粮 · 优享',
    shortLabel: '银→粮 A',
  },
  silver_food_b: {
    direction: 'silver_food',
    variant: 'b',
    label: '银换粮 · 标准',
    shortLabel: '银→粮 B',
  },
  food_silver_a: {
    direction: 'food_silver',
    variant: 'a',
    label: '粮换银 · 优享',
    shortLabel: '粮→银 A',
  },
  food_silver_b: {
    direction: 'food_silver',
    variant: 'b',
    label: '粮换银 · 标准',
    shortLabel: '粮→银 B',
  },
});

/**
 * @param {unknown} packId
 * @returns {string|null}
 */
function normalizePackId(packId) {
  const id = String(packId ?? '').trim();
  return PACK_IDS.includes(id) ? id : null;
}

function clampK(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(K_MIN, Math.min(K_MAX, n));
}

/**
 * 池粮折算银当量之比 R = (poolFood/5) / poolSilver；R>1 粮偏多。
 * @param {number} poolSilver
 * @param {number} poolFood
 * @returns {number}
 */
function poolImbalanceRatio(poolSilver, poolFood) {
  const ps = Math.max(0, Math.floor(Number(poolSilver) || 0));
  const pf = Math.max(0, Math.floor(Number(poolFood) || 0));
  if (ps <= 0) {
    return pf > 0 ? K_MAX : 1;
  }
  const fairFood = ps * FOOD_PER_SILVER;
  if (fairFood <= 0) return 1;
  return pf / fairFood;
}

/** @param {number} R */
function kSilverToFood(R) {
  return clampK(R);
}

/** @param {number} R */
function kFoodToSilver(R) {
  const r = Number(R);
  if (!Number.isFinite(r) || r <= 0) return K_MIN;
  return clampK(1 / r);
}

/**
 * @param {number} tierCoeff - SILVER_COEFFICIENT_BY_TIER 档系数（无 roll）
 * @param {number} resourceMultiplier - 官职 resourceBonus
 * @returns {{ baseSilver: number, baseFood: number }|null}
 */
function computeExchangeBase(tierCoeff, resourceMultiplier) {
  const coeff = Number(tierCoeff);
  if (!Number.isFinite(coeff) || coeff <= 0) return null;
  const m = Number(resourceMultiplier) || 1;
  const mult = m >= 1 ? m : 1;
  const baseSilver = Math.floor(coeff * mult);
  if (baseSilver < 1) return null;
  return { baseSilver, baseFood: baseSilver * FOOD_PER_SILVER };
}

/**
 * @param {string} packId
 * @param {{ baseSilver: number, baseFood: number, poolSilver: number, poolFood: number }} ctx
 * @returns {{ packId: string, paySilver: number, payFood: number, receiveSilver: number, receiveFood: number, k: number, imbalanceR: number, poolBonusPct: number }}
 */
function computePackAmounts(packId, ctx) {
  const id = normalizePackId(packId);
  if (!id) {
    throw new Error('INVALID_PACK_ID');
  }
  const meta = PACK_META[id];
  const baseSilver = Math.max(0, Math.floor(Number(ctx.baseSilver) || 0));
  const baseFood = Math.max(0, Math.floor(Number(ctx.baseFood) || 0));
  const R = poolImbalanceRatio(ctx.poolSilver, ctx.poolFood);
  const poolBonusPct = meta.variant === 'a' ? Math.round(PACK_A_POOL_BONUS * 100) : 0;
  const bonusMul = meta.variant === 'a' ? 1 + PACK_A_POOL_BONUS : 1;

  if (meta.direction === 'silver_food') {
    const k = kSilverToFood(R);
    const paySilver = baseSilver;
    const receiveFood = Math.floor(baseSilver * FOOD_PER_SILVER * k * bonusMul);
    return {
      packId: id,
      paySilver,
      payFood: 0,
      receiveSilver: 0,
      receiveFood,
      k,
      imbalanceR: R,
      poolBonusPct,
    };
  }

  const k = kFoodToSilver(R);
  const payFood = baseFood;
  const receiveSilver = Math.floor((baseFood / FOOD_PER_SILVER) * k * bonusMul);
  return {
    packId: id,
    paySilver: 0,
    payFood,
    receiveSilver,
    receiveFood: 0,
    k,
    imbalanceR: R,
    poolBonusPct,
  };
}

/**
 * @param {string} packId
 * @param {object} ctx
 * @param {{ playerSilver?: number, playerFood?: number, claimedToday?: boolean, poolSilver?: number, poolFood?: number }} gates
 * @returns {{ canExchange: boolean, blockReason: string|null, amounts: ReturnType<typeof computePackAmounts> }}
 */
function evaluatePackExchange(packId, ctx, gates = {}) {
  const amounts = computePackAmounts(packId, ctx);
  const playerSilver = Math.max(0, Math.floor(Number(gates.playerSilver) || 0));
  const playerFood = Math.max(0, Math.floor(Number(gates.playerFood) || 0));
  const poolSilver = Math.max(0, Math.floor(Number(gates.poolSilver) || 0));
  const poolFood = Math.max(0, Math.floor(Number(gates.poolFood) || 0));

  if (gates.claimedToday) {
    return { canExchange: false, blockReason: '今日该兑换包已使用', amounts };
  }
  if (amounts.paySilver > 0 && playerSilver < amounts.paySilver) {
    return {
      canExchange: false,
      blockReason: `个人银两不足（需 ${amounts.paySilver}，当前 ${playerSilver}）`,
      amounts,
    };
  }
  if (amounts.payFood > 0 && playerFood < amounts.payFood) {
    return {
      canExchange: false,
      blockReason: `个人粮草不足（需 ${amounts.payFood}，当前 ${playerFood}）`,
      amounts,
    };
  }
  if (amounts.receiveFood > 0 && poolFood < amounts.receiveFood) {
    return {
      canExchange: false,
      blockReason: `势力粮草储备不足（需 ${amounts.receiveFood}，当前 ${poolFood}）`,
      amounts,
    };
  }
  if (amounts.receiveSilver > 0 && poolSilver < amounts.receiveSilver) {
    return {
      canExchange: false,
      blockReason: `势力银两储备不足（需 ${amounts.receiveSilver}，当前 ${poolSilver}）`,
      amounts,
    };
  }
  if (amounts.receiveSilver < 1 && amounts.receiveFood < 1) {
    return { canExchange: false, blockReason: '兑换结算量为 0，请稍后再试', amounts };
  }
  return { canExchange: true, blockReason: null, amounts };
}

module.exports = {
  FOOD_PER_SILVER,
  K_MIN,
  K_MAX,
  PACK_A_POOL_BONUS,
  PACK_IDS,
  PACK_META,
  normalizePackId,
  poolImbalanceRatio,
  kSilverToFood,
  kFoodToSilver,
  computeExchangeBase,
  computePackAmounts,
  evaluatePackExchange,
};
