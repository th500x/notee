/**
 * 城池属性初值与日成长（13-1 §5.4 / §5.5）
 * 后端 CJS 入口；算法须与 `cityInitialAttributes.js` 同步。
 */

/** 各类型 [下限, 上限]；关隘商农军文钉死 0 */
const CITY_ATTR_BOUNDS = Object.freeze({
  city_small: Object.freeze({
    population: Object.freeze([5000, 20000]),
    trading: Object.freeze([50, 200]),
    farming: Object.freeze([50, 200]),
    military: Object.freeze([50, 200]),
    culture: Object.freeze([50, 200]),
    defense: Object.freeze([100, 110]),
  }),
  city_medium: Object.freeze({
    population: Object.freeze([10000, 100000]),
    trading: Object.freeze([100, 1000]),
    farming: Object.freeze([100, 1000]),
    military: Object.freeze([100, 1000]),
    culture: Object.freeze([100, 1000]),
    defense: Object.freeze([100, 120]),
  }),
  city_major: Object.freeze({
    population: Object.freeze([20000, 200000]),
    trading: Object.freeze([200, 2000]),
    farming: Object.freeze([200, 2000]),
    military: Object.freeze([200, 2000]),
    culture: Object.freeze([200, 2000]),
    defense: Object.freeze([100, 140]),
  }),
  city_gate: Object.freeze({
    population: Object.freeze([5000, 20000]),
    trading: Object.freeze([0, 0]),
    farming: Object.freeze([0, 0]),
    military: Object.freeze([0, 0]),
    culture: Object.freeze([0, 0]),
    defense: Object.freeze([120, 140]),
  }),
});

const GATE_FIXED_ZERO_DIMS = Object.freeze(['trading', 'farming', 'military', 'culture']);

const INIT_FLOOR_RATIO_MIN = 1;
const INIT_FLOOR_RATIO_MAX = 1.05;

const DAILY_GROWTH_ROLLS = Object.freeze([
  Object.freeze({ percent: 1, weight: 35 }),
  Object.freeze({ percent: 2, weight: 35 }),
  Object.freeze({ percent: 3, weight: 30 }),
]);

/** NPC 守军编制上限 = 人口 × 本比例（四舍五入，至少 1） */
const NPC_GARRISON_POPULATION_RATIO = 0.01;

/** 编制硬顶（与 `buildNpcUnitsForCityRow` override 一致） */
const NPC_GARRISON_CAP_HARD_MAX = 2000;

/** 每日 0:00：损兵城按编制上限恢复本比例（四舍五入；PVE/PVP 统一） */
const NPC_DAILY_RECOVERY_RATIO = 0.1;

/**
 * 由人口推导 NPC 守军编制上限（支数）。
 * @param {unknown} population
 * @returns {number}
 */
function resolveNpcGarrisonCapFromPopulation(population) {
  const pop = Math.max(0, Math.floor(Number(population) || 0));
  const raw = Math.max(1, Math.round(pop * NPC_GARRISON_POPULATION_RATIO));
  return Math.min(NPC_GARRISON_CAP_HARD_MAX, raw);
}

/**
 * 每日恢复支数 = round(编制上限 × 10%)。
 * @param {unknown} cap 编制槽位数
 * @returns {number}
 */
function resolveNpcDailyRecoveryAdd(cap) {
  const c = Math.max(0, Math.floor(Number(cap) || 0));
  return Math.round(c * NPC_DAILY_RECOVERY_RATIO);
}

const GROWTH_KEYS_SETTLEMENT = Object.freeze([
  'population',
  'trading',
  'farming',
  'military',
  'culture',
  'defense',
]);
const GROWTH_KEYS_GATE = Object.freeze(['population', 'defense']);

function normalizeCityType(cityType) {
  const t = cityType != null ? String(cityType).trim() : '';
  if (t === 'city_small' || t === 'city_medium' || t === 'city_major' || t === 'city_gate') return t;
  return null;
}

function getCityAttrBounds(cityType) {
  const t = normalizeCityType(cityType);
  return t ? CITY_ATTR_BOUNDS[t] : null;
}

function unit01(rng = Math.random) {
  const u = Number(rng());
  if (!Number.isFinite(u)) return 0;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u;
}

function rollInitialFromFloor(floorLo, rng = Math.random) {
  const floor = Math.max(0, Math.floor(Number(floorLo) || 0));
  if (floor <= 0) return 0;
  const ratio = INIT_FLOOR_RATIO_MIN + unit01(rng) * (INIT_FLOOR_RATIO_MAX - INIT_FLOOR_RATIO_MIN);
  return Math.round(floor * ratio);
}

function rollDailyGrowthPercent(rng = Math.random) {
  const u = unit01(rng) * 100;
  if (u < 35) return 1;
  if (u < 70) return 2;
  return 3;
}

function applyPercentGrowth(current, percent, hi) {
  const cur = Math.max(0, Math.floor(Number(current) || 0));
  const cap = Math.floor(Number(hi));
  if (!Number.isFinite(cap)) return { value: cur, grew: false };
  if (cur >= cap) return { value: cap, grew: false };
  const pct = Math.max(0, Number(percent) || 0);
  if (pct <= 0) return { value: cur, grew: false };
  let next = Math.round(cur * (1 + pct / 100));
  if (next <= cur) next = cur + 1;
  if (next > cap) next = cap;
  return { value: next, grew: next > cur };
}

function buildInitialCityAttributes(cityType, opts = {}) {
  const bounds = getCityAttrBounds(cityType);
  if (!bounds) {
    throw new Error(`[cityInitialAttributes] unknown city_type: ${cityType}`);
  }
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const isGate = normalizeCityType(cityType) === 'city_gate';
  const population = rollInitialFromFloor(bounds.population[0], rng);
  const trading = isGate ? 0 : rollInitialFromFloor(bounds.trading[0], rng);
  const farming = isGate ? 0 : rollInitialFromFloor(bounds.farming[0], rng);
  const military = isGate ? 0 : rollInitialFromFloor(bounds.military[0], rng);
  const culture = isGate ? 0 : rollInitialFromFloor(bounds.culture[0], rng);
  const defense = rollInitialFromFloor(bounds.defense[0], rng);
  const srt = Math.max(0, Math.floor(Number(opts.specialResourceTrading) || 0));
  const srf = Math.max(0, Math.floor(Number(opts.specialResourceFarming) || 0));
  return {
    population,
    trading,
    farming,
    military,
    culture,
    defense,
    finalTrading: trading + srt,
    finalFarming: farming + srf,
  };
}

function growOwnedCityAttributes(row, opts = {}) {
  const cityType = normalizeCityType(row?.city_type ?? row?.cityType);
  const bounds = cityType ? CITY_ATTR_BOUNDS[cityType] : null;
  if (!bounds || !cityType) {
    return { ok: false, error: `unknown city_type: ${row?.city_type ?? row?.cityType}` };
  }
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const isGate = cityType === 'city_gate';
  const next = {
    population: Math.max(0, Math.floor(Number(row.population) || 0)),
    trading: isGate ? 0 : Math.max(0, Math.floor(Number(row.trading) || 0)),
    farming: isGate ? 0 : Math.max(0, Math.floor(Number(row.farming) || 0)),
    military: isGate ? 0 : Math.max(0, Math.floor(Number(row.military) || 0)),
    culture: isGate ? 0 : Math.max(0, Math.floor(Number(row.culture) || 0)),
    defense: Math.max(0, Math.floor(Number(row.defense) || 0)),
  };
  const grew = {};
  const keys = isGate ? GROWTH_KEYS_GATE : GROWTH_KEYS_SETTLEMENT;
  for (const key of keys) {
    const hi = bounds[key][1];
    if (next[key] >= hi) {
      grew[key] = 0;
      continue;
    }
    const percent = rollDailyGrowthPercent(rng);
    const result = applyPercentGrowth(next[key], percent, hi);
    next[key] = result.value;
    grew[key] = result.grew ? percent : 0;
  }
  if (isGate) {
    next.trading = 0;
    next.farming = 0;
    next.military = 0;
    next.culture = 0;
  }
  const srt = Math.max(
    0,
    Math.floor(Number(row.special_resource_trading ?? row.specialResourceTrading) || 0),
  );
  const srf = Math.max(
    0,
    Math.floor(Number(row.special_resource_farming ?? row.specialResourceFarming) || 0),
  );
  return {
    ok: true,
    attrs: {
      ...next,
      finalTrading: next.trading + srt,
      finalFarming: next.farming + srf,
    },
    grew,
    anyGrew: Object.values(grew).some((p) => p > 0),
  };
}

module.exports = {
  CITY_ATTR_BOUNDS,
  GATE_FIXED_ZERO_DIMS,
  INIT_FLOOR_RATIO_MIN,
  INIT_FLOOR_RATIO_MAX,
  DAILY_GROWTH_ROLLS,
  NPC_GARRISON_POPULATION_RATIO,
  NPC_GARRISON_CAP_HARD_MAX,
  NPC_DAILY_RECOVERY_RATIO,
  normalizeCityType,
  getCityAttrBounds,
  rollInitialFromFloor,
  rollDailyGrowthPercent,
  applyPercentGrowth,
  buildInitialCityAttributes,
  growOwnedCityAttributes,
  resolveNpcGarrisonCapFromPopulation,
  resolveNpcDailyRecoveryAdd,
};
