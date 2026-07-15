/**
 * `routes/players/road.js` 请求体 / query schema（O3-D1 · T-09 第一批）。
 *
 * 几何路径、占格、扣粮等业务约束仍在 service 层；此处只做 HTTP 形态校验。
 *
 * @see docs/00-base/02-architecture-split/12-road-encounter-api.md
 * @module middleware/validationSchemas/playersRoad
 */

const { v } = require('../validation');
const {
  sanSeason,
  sanJunId,
  clientRequestId,
  encounterId,
  poiId,
} = require('./common');

const roadPathStep = (val, name) => {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return `${name} 必须为对象`;
  const xErr = v.required(v.integer({ min: 0, max: 128 }))(val.x, `${name}.x`);
  if (xErr) return xErr;
  const yErr = v.required(v.integer({ min: 0, max: 128 }))(val.y, `${name}.y`);
  if (yErr) return yErr;
  return null;
};

const interceptBody = {
  enable: v.required(v.boolean()),
  clientRequestId: v.optional(clientRequestId),
};

const moveBody = {
  confirmFoodCost: v.required(v.literal(true)),
  season: v.required(sanSeason),
  junId: v.required(sanJunId),
  clientRequestId: v.required(clientRequestId),
  path: v.required(v.array({ maxLength: 512, itemValidator: roadPathStep })),
  targetPoiId: v.optional(poiId),
};

const resolveEncounterBody = {
  encounterId: v.required(encounterId),
  defenderWon: v.optional(v.boolean()),
  battleId: v.optional(v.nonEmptyString({ max: 80 })),
};

const encounterIdQuery = {
  encounterId: v.required(encounterId),
};

const encounterBattleQuery = {
  encounterId: v.required(encounterId),
  spectator: v.optional(v.enum(['', '0', '1'])),
};

const encounterAuthoritativeResolveBody = {
  encounterId: v.required(encounterId),
};

const encounterBattleResultBody = {
  encounterId: v.required(encounterId),
  factionId: v.required(v.nonEmptyString({ max: 64 })),
  result: v.optional(v.enum(['win', 'lose'])),
  killedIndices: v.optional(v.array({ maxLength: 64 })),
  silverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleReportSaved: v.optional(v.boolean()),
  battleId: v.optional(v.nonEmptyString({ max: 80 })),
};

module.exports = {
  interceptBody,
  moveBody,
  resolveEncounterBody,
  encounterIdQuery,
  encounterBattleQuery,
  encounterAuthoritativeResolveBody,
  encounterBattleResultBody,
};
