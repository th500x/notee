/**
 * `routes/players/explore.js` 请求体 / query schema（O3-D1 · T-09 第二批）。
 *
 * @module middleware/validationSchemas/playersExplore
 */

const { v } = require('../validation');
const { banditPoiId, itemId } = require('./common');

const EVENT_TYPES = [1, 2, 3, 4, 5, 6, 7];

const exploreSessionLockBody = {
  sessionLock: v.required(v.nullableObject()),
};

const recordEventBody = {
  eventId: v.required(v.nonEmptyString({ max: 128 })),
  eventType: v.required(v.enum(EVENT_TYPES)),
  status: v.optional(v.nonEmptyString({ max: 32 })),
};

const itemMutationBody = {
  itemId: v.required(itemId),
  quantity: v.optional(v.integer({ min: 1, max: 1_000_000 })),
};

const banditRaidQuotaQuery = {
  banditPoiId: v.required(banditPoiId),
};

const banditRaidQuotaBody = {
  banditPoiId: v.required(banditPoiId),
  action: v.required(v.enum(['consume', 'reset_tower'])),
};

const exploreQuotaBody = {
  action: v.required(v.enum(['consume', 'refund', 'fillMax'])),
};

const rerollConfirmBody = {
  batch: v.required(v.integer({ min: 0, max: 9999 })),
  index: v.required(v.integer({ min: 0, max: 99 })),
};

const eventRewardsBody = {
  eventId: v.required(v.nonEmptyString({ max: 128 })),
  optionKey: v.required(v.enum(['A', 'B'])),
  playerAttrs: v.optional(v.plainObject()),
  general1Attrs: v.optional(v.plainObject()),
  general2Attrs: v.optional(v.plainObject()),
  minigameResult: v.optional(v.plainObject()),
  minigameSilverDelta: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleResult: v.optional(v.plainObject()),
  battleSilverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
};

module.exports = {
  exploreSessionLockBody,
  recordEventBody,
  itemMutationBody,
  banditRaidQuotaQuery,
  banditRaidQuotaBody,
  exploreQuotaBody,
  rerollConfirmBody,
  eventRewardsBody,
};
