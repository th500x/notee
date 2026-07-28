/**
 * `routes/cities.js` schema（O3-D1 · T-09 第三批）。
 *
 * @module middleware/validationSchemas/cities
 */

const { httpError } = require('../../utils/httpError');
const { validateQuery, v } = require('../validation');
const {
  sanSeason,
  sanJunId,
  playerId,
  factionId,
  poiId,
  warId,
  quotaAction,
} = require('./common');

const listCitiesQuery = {
  season: v.optional(sanSeason),
  junId: v.optional(sanJunId),
  jun_id: v.optional(sanJunId),
};

const roadPresenceQuery = {
  season: v.required(sanSeason),
  junId: v.optional(sanJunId),
  jun_id: v.optional(sanJunId),
  playerId: v.optional(playerId),
  player_id: v.optional(playerId),
};

const activePveSiegeWarsQuery = {
  season: v.required(sanSeason),
  playerId: v.required(playerId),
  factionId: v.required(factionId),
  player_id: v.optional(playerId),
  faction_id: v.optional(factionId),
};

const activePveBaseCampsQuery = {
  season: v.optional(sanSeason),
};

const cityIdParam = {
  cityId: v.required(poiId),
};

const warIdParam = {
  warId: v.required(warId),
};

const siegeBody = {
  playerId: v.required(playerId),
  /** 结算「继续」连打：不扣兵符（与匪寨同口径） */
  continueChain: v.optional(v.boolean()),
};

const siegeResultBody = {
  warId: v.required(warId),
  playerId: v.required(playerId),
  factionId: v.required(factionId),
  result: v.optional(v.enum(['win', 'lose'])),
  killedIndices: v.optional(v.array({ maxLength: 64 })),
  silverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleReportSaved: v.optional(v.boolean()),
  defenderType: v.optional(v.enum(['npc', 'player', 'lineup'])),
  defenderPlayerId: v.optional(playerId),
  defenderGarrisonSlot: v.optional(v.integer({ min: 0, max: 20 })),
  npcBatchIndex: v.optional(v.integer({ min: 0, max: 99 })),
};

const siegeQuotaQuery = {
  playerId: v.required(playerId),
};

const siegeQuotaBody = {
  playerId: v.required(playerId),
  action: v.required(quotaAction),
};

const generateNpcBody = {
  troopCountOverride: v.optional(v.integer({ min: 1, max: 9999 })),
  troopCount: v.optional(v.integer({ min: 1, max: 9999 })),
};

const validateRoadPresenceQuery = [
  validateQuery(roadPresenceQuery),
  (req, res, next) => {
    if (!req.query.junId && !req.query.jun_id) {
      return next(httpError(400, '缺少 junId', 'VALIDATION_FAILED'));
    }
    next();
  },
];

module.exports = {
  listCitiesQuery,
  roadPresenceQuery,
  validateRoadPresenceQuery,
  activePveSiegeWarsQuery,
  activePveBaseCampsQuery,
  cityIdParam,
  warIdParam,
  siegeBody,
  siegeResultBody,
  siegeQuotaQuery,
  siegeQuotaBody,
  generateNpcBody,
};
