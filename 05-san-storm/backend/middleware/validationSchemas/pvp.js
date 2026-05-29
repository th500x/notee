/**
 * `routes/pvp.js` schema（O3-D1 · T-09 第三批）。
 *
 * @module middleware/validationSchemas/pvp
 */

const { httpError } = require('../../utils/httpError');
const { validateBody, v } = require('../validation');
const { playerId, factionId, poiId, warId } = require('./common');

const cityIdParam = {
  cityId: v.required(poiId),
};

const challengeIdParam = {
  challengeId: v.required(v.idLike({ max: 128 })),
};

const onlineDefendersQuery = {
  attackerId: v.required(playerId),
  attackerFaction: v.required(factionId),
};

const challengeBodyFields = {
  cityId: v.required(poiId),
  attackerId: v.required(playerId),
  defenderId: v.required(playerId),
  attackerFaction: v.optional(factionId),
  warId: v.optional(warId),
  pvpWarId: v.optional(warId),
  defenderGarrisonSlot: v.optional(v.integer({ min: 0, max: 20 })),
};

const validateChallengeBody = [
  validateBody(challengeBodyFields),
  (req, res, next) => {
    if (!req.body.warId && !req.body.pvpWarId) {
      return next(httpError(400, '缺少 warId 或 pvpWarId', 'VALIDATION_FAILED'));
    }
    next();
  },
];

const defenderIdQuery = {
  defenderId: v.required(playerId),
};

const defenderIdBody = {
  defenderId: v.required(playerId),
};

const siegeResolveBody = {
  challengeId: v.required(v.idLike({ max: 128 })),
  attackerId: v.required(playerId),
};

const siegeOutcomeQuery = {
  playerId: v.required(playerId),
};

const completeChallengeBody = {
  result: v.required(v.enum(['attacker_win', 'defender_win'])),
};

module.exports = {
  cityIdParam,
  challengeIdParam,
  onlineDefendersQuery,
  validateChallengeBody,
  defenderIdQuery,
  defenderIdBody,
  siegeResolveBody,
  siegeOutcomeQuery,
  completeChallengeBody,
};
