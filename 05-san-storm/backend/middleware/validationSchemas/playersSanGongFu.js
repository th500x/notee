/**
 * `routes/players/sanGongFu.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/playersSanGongFu
 */

const { v } = require('../validation');
const { cardInstanceId, warId } = require('./common');

const promoteBody = {
  positionId: v.required(v.idLike({ max: 128 })),
};

const kingEdictBody = {
  reaction: v.required(v.enum(['up', 'down'])),
  scope: v.optional(v.enum(['active_war', 'casual'])),
};

const tributeBody = {
  cardType: v.optional(v.enum(['troop', 'character'])),
  instanceIds: v.required(v.array({
    minLength: 1,
    maxLength: 64,
    itemValidator: cardInstanceId,
  })),
};

const documentBody = {
  body: v.required(v.nonEmptyString({ max: 60 })),
};

const bulletinQuery = {
  limitPerCategory: v.optional(v.pattern(/^\d+$/, '1–50')),
};

const pvpWarIdParam = {
  pvpWarId: v.required(warId),
};

const pveWarIdParam = {
  warId: v.required(warId),
};

const cancelWarBody = {
  reason: v.optional(v.string({ max: 256 })),
};

const switchPeerBody = {
  positionId: v.required(v.idLike({ max: 128 })),
};

const resourceExchangeBody = {
  packId: v.required(
    v.enum(['silver_food_a', 'silver_food_b', 'food_silver_a', 'food_silver_b']),
  ),
};

module.exports = {
  promoteBody,
  switchPeerBody,
  kingEdictBody,
  tributeBody,
  documentBody,
  bulletinQuery,
  pvpWarIdParam,
  pveWarIdParam,
  cancelWarBody,
  resourceExchangeBody,
};
