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

/** 编组-道具使用（部队徽章等） */
const itemUseBody = {
  itemId: v.required(itemId),
  instanceId: v.required(v.nonEmptyString({ max: 128 })),
};

const banditRaidQuotaQuery = {
  banditPoiId: v.required(banditPoiId),
};

const banditRaidQuotaBody = {
  banditPoiId: v.required(banditPoiId),
  action: v.required(v.enum(['consume', 'reset_tower'])),
};

const banditBetweenLayerHealTroop = (val, name) => {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return `${name} 必须为对象`;
  const idErr = v.required(v.nonEmptyString({ max: 128 }))(val.instanceId, `${name}.instanceId`);
  if (idErr) return idErr;
  const curErr = v.required(v.integer({ min: 0, max: 1_000_000 }))(val.currentTroops, `${name}.currentTroops`);
  if (curErr) return curErr;
  const maxErr = v.required(v.integer({ min: 1, max: 1_000_000 }))(val.maxTroops, `${name}.maxTroops`);
  if (maxErr) return maxErr;
  return null;
};

const banditBetweenLayerHealBody = {
  tier: v.required(v.enum(['light', 'heavy'])),
  troops: v.required(v.array({ minLength: 1, maxLength: 16, itemValidator: banditBetweenLayerHealTroop })),
};

const exploreQuotaBody = {
  action: v.required(v.enum(['consume', 'refund', 'fillMax'])),
};

/** 探索开链兵符：continueChain / tutorial 跳过扣费 */
const exploreChainTokenBody = {
  action: v.required(v.enum(['consume', 'refund'])),
  continueChain: v.optional(v.boolean()),
  triggerContext: v.optional(v.nonEmptyString({ max: 32 })),
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
  minigameResult: v.optional(v.enum(['victory', 'defeat'])),
  minigameSilverDelta: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  /** 与 `playerEventRewardsService` / `useEventSystem.endBattle` 一致：字符串，非对象 */
  battleResult: v.optional(v.enum(['victory', 'defeat'])),
  battleSilverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
};

module.exports = {
  exploreSessionLockBody,
  recordEventBody,
  itemMutationBody,
  itemUseBody,
  banditRaidQuotaQuery,
  banditRaidQuotaBody,
  banditBetweenLayerHealBody,
  exploreQuotaBody,
  exploreChainTokenBody,
  rerollConfirmBody,
  eventRewardsBody,
};
