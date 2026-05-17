/**
 * 发动战事（PVP / PVE）自势力池扣费：档位基准 × 游戏历自然月倍率（见 17-2、15-1、41-1）。
 * @module services/warInitiationCostService
 */

/**
 * 基准消耗（银两 / 粮草，整数）；与 `cities.city_type` 对齐。
 * 小城 | 中城+据点 | 大城+关隘
 */
const BASELINE_BY_CITY_TYPE = Object.freeze({
  city_small: { silver: 600, food: 3000 },
  city_medium: { silver: 1800, food: 9000 },
  fort: { silver: 1800, food: 9000 },
  city_major: { silver: 3000, food: 15000 },
  gate: { silver: 3000, food: 15000 },
});

/**
 * 自赛季起点游戏历 (startYear,startMonth) 起算，**当前 (year,month) 为第几个自然月**（1 起算）。
 * 与 [15-1-GAME_TIME_SYSTEM.md] 每月 30 日进位后的 (year,month) 一致；**不按 elapsedGameDays/30 取整**。
 *
 * @param {object|null|undefined} gameTime - `computeGameTimeFromServerRow` / profile `gameTime` 形状
 * @returns {number}
 */
function gameCalendarMonthOrdinal(gameTime) {
  if (!gameTime) return 1;
  const y = Number(gameTime.year);
  const m = Number(gameTime.month);
  const sy = Number(gameTime.startYear ?? 184);
  const sm = Number(gameTime.startMonth ?? 1);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(sy) || !Number.isFinite(sm)) {
    return 1;
  }
  const abs = (yy, mm) => yy * 12 + (mm - 1);
  const delta = abs(y, m) - abs(sy, sm);
  return Math.max(1, delta + 1);
}

/**
 * 第 N 个自然月倍率 = (100 + N)%（第 1 月 101%，第 2 月 102%…）。
 * @param {number} monthOrdinal
 * @returns {number}
 */
function multiplierPercentFromMonthOrdinal(monthOrdinal) {
  const n = Math.max(1, Math.floor(Number(monthOrdinal) || 1));
  return 100 + n;
}

/**
 * @param {string} cityType
 * @param {object|null|undefined} gameTime
 * @returns {{
 *   silver: number,
 *   food: number,
 *   baselineSilver: number,
 *   baselineFood: number,
 *   monthOrdinal: number,
 *   multiplierPercent: number,
 *   cityType: string,
 * }}
 */
function computeScaledCostForCityType(cityType, gameTime) {
  const ct = String(cityType || '').trim();
  const base = BASELINE_BY_CITY_TYPE[ct];
  if (!base) {
    const err = new Error(`[warInitCost] 不支持的城池类型（无发动战事基准档）：${ct || '(空)'}`);
    err.code = 'UNSUPPORTED_CITY_TYPE_FOR_WAR_INIT';
    throw err;
  }
  const monthOrdinal = gameCalendarMonthOrdinal(gameTime);
  const pct = multiplierPercentFromMonthOrdinal(monthOrdinal);
  return {
    silver: Math.round((base.silver * pct) / 100),
    food: Math.round((base.food * pct) / 100),
    baselineSilver: base.silver,
    baselineFood: base.food,
    monthOrdinal,
    multiplierPercent: pct,
    cityType: ct,
  };
}

/**
 * 同事务内锁定攻方势力并扣减 `reserve_silver` / `reserve_food`。
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {string} cityType
 * @param {object|null|undefined} gameTime
 * @returns {Promise<object>} computeScaledCostForCityType 返回值
 */
async function assertAndDeductInTransaction(conn, factionId, cityType, gameTime) {
  const fid = String(factionId || '').trim();
  if (!fid) throw new Error('[warInitCost] 缺少 factionId');
  const cost = computeScaledCostForCityType(cityType, gameTime);
  const [rows] = await conn.query(
    'SELECT id, reserve_silver, reserve_food FROM factions WHERE id = ? FOR UPDATE',
    [fid],
  );
  if (!rows.length) {
    const err = new Error('[warInitCost] 攻方势力不存在');
    err.code = 'FACTION_NOT_FOUND';
    throw err;
  }
  const rs = Number(rows[0].reserve_silver) || 0;
  const rf = Number(rows[0].reserve_food) || 0;
  if (rs < cost.silver || rf < cost.food) {
    const err = new Error(
      `势力银粮储备不足以发动本场战事（需 ${cost.silver} 银、${cost.food} 粮；当前储备 ${rs} 银、${rf} 粮）`,
    );
    err.code = 'INSUFFICIENT_FACTION_RESERVES';
    err.details = { ...cost, reserveSilver: rs, reserveFood: rf };
    throw err;
  }
  await conn.query(
    'UPDATE factions SET reserve_silver = reserve_silver - ?, reserve_food = reserve_food - ? WHERE id = ?',
    [cost.silver, cost.food, fid],
  );
  return cost;
}

/**
 * 供 `GET /remonstrance-panel` 等组 JSON（camelCase）。
 *
 * @param {object|null|undefined} gameTime
 * @param {{ silver: number, food: number }} reserves
 */
function buildProposalCostPanelPayload(gameTime, reserves) {
  const ord = gameCalendarMonthOrdinal(gameTime);
  const pct = multiplierPercentFromMonthOrdinal(ord);
  const tierKeys = Object.keys(BASELINE_BY_CITY_TYPE);
  const tiers = {};
  for (const ct of tierKeys) {
    tiers[ct] = computeScaledCostForCityType(ct, gameTime);
  }
  return {
    monthOrdinal: ord,
    multiplierPercent: pct,
    reserves: {
      silver: Number(reserves?.silver) || 0,
      food: Number(reserves?.food) || 0,
    },
    tiers,
  };
}

module.exports = {
  BASELINE_BY_CITY_TYPE,
  gameCalendarMonthOrdinal,
  multiplierPercentFromMonthOrdinal,
  computeScaledCostForCityType,
  assertAndDeductInTransaction,
  buildProposalCostPanelPayload,
};
