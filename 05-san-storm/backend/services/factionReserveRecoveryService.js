/**
 * 势力储备 · 每日自动恢复（00:00 服务器自然日）
 *
 * - **基数**：与三公府俸禄同源 — `stipendTierCoefficients`（国力档系数 × 80%～120% 随机%）
 * - **城池倍率**：已占 `city_small`×1、`city_medium`×3、`city_major`×5；关隘/据点不计入
 * - **入账**：`faction_reserve`（`category=pool`）银粮余额（非玩家背包）
 *
 * @see 15-2-SERVER_REFRESH_AND_LIMITS.md · 势力储备日恢复
 * @see 13-1-CITY_SYSTEM.md §8.4.2.2（俸禄基数口径）
 */

const { pool } = require('../database/connection');
const factionReserveService = require('./factionReserveService');
const {
  rollStipendAmountsForTier,
  SILVER_COEFFICIENT_BY_TIER,
} = require('./stipendTierCoefficients');
const { computeSupplyTier } = require('./factionSupplyTierService');

/** 与 factionOverviewService 五维口径一致（关隘/据点不计） */
const CITY_TYPES_FOR_SUPPLY_AGG = ['city_major', 'city_medium', 'city_small'];

function computeFactionFiveScalarsFromSums(sums, n) {
  const count = Math.floor(Number(n)) || 0;
  if (count <= 0) {
    return { population: 0, trading: 0, farming: 0, military: 0, culture: 0 };
  }
  const coef = 1 + 0.05 * count;
  const dim = (sumRaw) => Math.round(((Number(sumRaw) || 0) / count) * coef);
  return {
    population: dim(sums.sum_population),
    trading: dim(sums.sum_trading),
    farming: dim(sums.sum_farming),
    military: dim(sums.sum_military),
    culture: dim(sums.sum_culture),
  };
}

/** 参与恢复的 `cities.city_type` → 倍率权重 */
const RECOVERY_WEIGHT_BY_CITY_TYPE = Object.freeze({
  city_small: 1,
  city_medium: 3,
  city_major: 5,
});

/**
 * @param {{ small?: number, medium?: number, major?: number }} counts
 * @returns {number}
 */
function sumRecoveryWeight(counts) {
  const s = Math.max(0, Math.floor(Number(counts?.small) || 0));
  const m = Math.max(0, Math.floor(Number(counts?.medium) || 0));
  const g = Math.max(0, Math.floor(Number(counts?.major) || 0));
  return s * RECOVERY_WEIGHT_BY_CITY_TYPE.city_small
    + m * RECOVERY_WEIGHT_BY_CITY_TYPE.city_medium
    + g * RECOVERY_WEIGHT_BY_CITY_TYPE.city_major;
}

/**
 * @param {number} baseSilver 当日随机基数银两 B
 * @param {{ small?: number, medium?: number, major?: number }} counts
 * @returns {{ silver: number, food: number, weight: number }}
 */
function computeRecoveryTotalsFromBase(baseSilver, counts) {
  const b = Math.max(0, Math.floor(Number(baseSilver) || 0));
  const weight = sumRecoveryWeight(counts);
  const silver = b * weight;
  const food = b * 5 * weight;
  return { silver, food, weight };
}

/**
 * UI 估计：按档系数 × **80%～120%** 随机区间，分别乘城权重后的入账范围（非当日已定随机值）。
 *
 * @param {string|null} supplyTier
 * @param {{ small?: number, medium?: number, major?: number }} counts
 */
function estimateDailyReserveRecovery(supplyTier, counts) {
  const tier = String(supplyTier || '').toUpperCase();
  const coeffMap = SILVER_COEFFICIENT_BY_TIER;
  if (!coeffMap) return null;
  const coeff = coeffMap[tier];
  if (coeff == null) return null;
  const minBaseSilver = Math.floor((coeff * 80) / 100);
  const maxBaseSilver = Math.floor((coeff * 120) / 100);
  const minTotals = computeRecoveryTotalsFromBase(minBaseSilver, counts);
  const maxTotals = computeRecoveryTotalsFromBase(maxBaseSilver, counts);
  return {
    supplyTier: tier,
    tierCoeff: coeff,
    rollPercentMin: 80,
    rollPercentMax: 120,
    baseSilverMin: minBaseSilver,
    baseSilverMax: maxBaseSilver,
    baseFoodMin: minBaseSilver * 5,
    baseFoodMax: maxBaseSilver * 5,
    estimatedSilverMin: minTotals.silver,
    estimatedSilverMax: maxTotals.silver,
    estimatedFoodMin: minTotals.food,
    estimatedFoodMax: maxTotals.food,
    weight: minTotals.weight,
    cityCounts: {
      small: Math.max(0, Math.floor(Number(counts?.small) || 0)),
      medium: Math.max(0, Math.floor(Number(counts?.medium) || 0)),
      major: Math.max(0, Math.floor(Number(counts?.major) || 0)),
    },
  };
}

/**
 * @param {string} factionId
 * @returns {Promise<{ small: number, medium: number, major: number }>}
 */
async function countOwnedCitiesForRecovery(factionId) {
  const [rows] = await pool.query(
    `SELECT city_type, COUNT(*) AS c
     FROM cities
     WHERE faction_id = ? AND status = 'owned'
       AND city_type IN ('city_small', 'city_medium', 'city_major')
     GROUP BY city_type`,
    [factionId],
  );
  const out = { small: 0, medium: 0, major: 0 };
  for (const r of rows) {
    if (r.city_type === 'city_small') out.small = Number(r.c) || 0;
    else if (r.city_type === 'city_medium') out.medium = Number(r.c) || 0;
    else if (r.city_type === 'city_major') out.major = Number(r.c) || 0;
  }
  return out;
}

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * 单势力：按当日随机基数恢复储备（须在事务内调用，行已 FOR UPDATE）。
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {object} factionRow - 含 id；recovery_applied_date 或 reserve_recovery_applied_date（兼容迁移前）
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Promise<null | { factionId: string, silver: number, food: number, rollPercent: number, baseSilver: number, weight: number }>}
 */
async function applyDailyRecoveryForFactionOnConnection(conn, factionRow, todayStr) {
  const factionId = String(factionRow.id || '').trim();
  if (!factionId) return null;
  const applied = mysqlDateToYmd(
    factionRow.recovery_applied_date ?? factionRow.reserve_recovery_applied_date,
  );
  if (applied && applied === todayStr) return null;

  const cityCounts = await countOwnedCitiesForRecovery(factionId);
  const weight = sumRecoveryWeight(cityCounts);
  if (weight <= 0) {
    await factionReserveService.setRecoveryAppliedDateOnConnection(conn, factionId, todayStr);
    return { factionId, silver: 0, food: 0, rollPercent: 0, baseSilver: 0, weight: 0, skippedNoCities: true };
  }

  const typePh = CITY_TYPES_FOR_SUPPLY_AGG.map(() => '?').join(',');
  const [aggRows] = await conn.query(
    `SELECT COUNT(*) AS n_supply_cities,
            COALESCE(SUM(c.population), 0) AS sum_population,
            COALESCE(SUM(c.final_trading), 0) AS sum_trading,
            COALESCE(SUM(c.final_farming), 0) AS sum_farming,
            COALESCE(SUM(c.military), 0) AS sum_military,
            COALESCE(SUM(c.culture), 0) AS sum_culture
     FROM cities c
     WHERE c.faction_id = ? AND c.status = 'owned' AND c.city_type IN (${typePh})`,
    [factionId, ...CITY_TYPES_FOR_SUPPLY_AGG],
  );
  const agg = aggRows[0] || {};
  const nSupply = Number(agg.n_supply_cities) || 0;
  const totals = computeFactionFiveScalarsFromSums(
    {
      sum_population: agg.sum_population,
      sum_trading: agg.sum_trading,
      sum_farming: agg.sum_farming,
      sum_military: agg.sum_military,
      sum_culture: agg.sum_culture,
    },
    nSupply,
  );
  const { tier: supplyTier } = computeSupplyTier(totals);
  if (supplyTier == null) {
    await factionReserveService.setRecoveryAppliedDateOnConnection(conn, factionId, todayStr);
    return { factionId, silver: 0, food: 0, rollPercent: 0, baseSilver: 0, weight, skippedNoTier: true };
  }

  const rolled = rollStipendAmountsForTier(supplyTier);
  if (!rolled || rolled.silver < 1) {
    await factionReserveService.setRecoveryAppliedDateOnConnection(conn, factionId, todayStr);
    return { factionId, silver: 0, food: 0, rollPercent: 0, baseSilver: 0, weight, skippedRollFailed: true };
  }

  const { silver, food } = computeRecoveryTotalsFromBase(rolled.silver, cityCounts);
  await factionReserveService.creditRecoveryOnConnection(conn, factionId, {
    silver,
    food,
    recoveryAppliedDate: todayStr,
  });

  return {
    factionId,
    supplyTier,
    silver,
    food,
    rollPercent: rolled.rollPercent,
    baseSilver: rolled.silver,
    baseFood: rolled.food,
    weight,
    cityCounts,
  };
}

/**
 * 每日 00:00：为全部势力执行储备恢复（幂等按 `faction_reserve.recovery_applied_date`）。
 */
async function runDailyReserveRecoveryTick() {
  const conn = await pool.getConnection();
  const results = [];
  try {
    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    let factionRows;
    try {
      const [rows] = await conn.query('SELECT id FROM factions');
      factionRows = rows;
    } catch (e) {
      throw e;
    }

    for (const f of factionRows) {
      try {
        await conn.beginTransaction();
        try {
          await factionReserveService.ensurePoolRow(conn, f.id);
        } catch (e) {
          if (/Unknown table ['`]faction_reserve/i.test(e?.message || '')) {
            await conn.rollback();
            return {
              ok: false,
              error: '缺少 faction_reserve 表，请执行迁移 create-faction-reserve-unified.sql',
              results: [],
            };
          }
          throw e;
        }
        const [locked] = await conn.query(
          `SELECT faction_id AS id, recovery_applied_date
           FROM faction_reserve
           WHERE faction_id = ? AND category = ? FOR UPDATE`,
          [f.id, factionReserveService.CATEGORY.POOL],
        );
        if (!locked.length) {
          await conn.rollback();
          continue;
        }
        const applied = await applyDailyRecoveryForFactionOnConnection(conn, locked[0], todayStr);
        await conn.commit();
        if (applied && (applied.silver > 0 || applied.food > 0)) {
          results.push(applied);
          console.log(
            `[factionReserve] ${applied.factionId} +${applied.silver}银 +${applied.food}粮 ` +
              `(随机${applied.rollPercent}% 基数银${applied.baseSilver} 权重${applied.weight})`,
          );
        }
      } catch (err) {
        await conn.rollback();
        console.error(`[factionReserve] ${f.id} 恢复失败:`, err.message);
      }
    }

    return { ok: true, date: todayStr, results };
  } finally {
    conn.release();
  }
}

module.exports = {
  RECOVERY_WEIGHT_BY_CITY_TYPE,
  sumRecoveryWeight,
  computeRecoveryTotalsFromBase,
  estimateDailyReserveRecovery,
  countOwnedCitiesForRecovery,
  applyDailyRecoveryForFactionOnConnection,
  runDailyReserveRecoveryTick,
};
