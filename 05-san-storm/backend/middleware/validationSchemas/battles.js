/**
 * `routes/battles.js` 请求体 / query / params schema（O3-D1 · T-09 第二批）。
 *
 * @module middleware/validationSchemas/battles
 */

const { v } = require('../validation');
const { playerId } = require('./common');

const BATTLE_TYPES = [
  'pvp_field',
  'pvp_siege',
  'pvp_defense',
  'pvp_tactical_duel',
  'pve_campaign',
  'pve_event',
  'pve_siege',
  'pve_bandit',
  'pve_chapter',
];

const OPPONENT_TYPES = ['player', 'campaign_enemy', 'event_enemy'];
const BATTLE_RESULTS = ['win', 'lose', 'draw'];
const LIST_FILTERS = ['all', 'pvp', 'campaign', 'event', 'favorited'];

const listQuery = {
  playerId: v.required(playerId),
  filter: v.optional(v.enum(LIST_FILTERS)),
};

const battleIdParam = {
  id: v.required(v.nonEmptyString({ max: 128 })),
};

const saveBattleBody = {
  battleId: v.required(v.idLike({ max: 128 })),
  playerId: v.required(playerId),
  battleType: v.required(v.enum(BATTLE_TYPES)),
  opponentType: v.required(v.enum(OPPONENT_TYPES)),
  result: v.required(v.enum(BATTLE_RESULTS)),
  recordOnly: v.optional(v.boolean()),
  warId: v.optional(v.idLike({ max: 128 })),
  pvpWarId: v.optional(v.idLike({ max: 128 })),
  opponentId: v.optional(v.nonEmptyString({ max: 128 })),
  opponentName: v.optional(v.string({ max: 128 })),
  campaignId: v.optional(v.idLike({ max: 128 })),
  chapterId: v.optional(v.nonEmptyString({ max: 64 })),
  nodeId: v.optional(v.nonEmptyString({ max: 32 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleSilverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  deploymentFoodSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  duration: v.optional(v.integer({ min: 0, max: 86_400_000 })),
};

const favoriteBody = {
  playerId: v.required(playerId),
  battleId: v.required(v.idLike({ max: 128 })),
};

const treasureAlliesQuery = {
  playerId: v.required(playerId),
  equippedBy: v.required(v.nonEmptyString({ max: 128 })),
  garrisonCityId: v.optional(v.idLike({ max: 128 })),
  garrisonSlot: v.optional(v.integer({ min: 1, max: 99 })),
};

module.exports = {
  listQuery,
  battleIdParam,
  saveBattleBody,
  favoriteBody,
  treasureAlliesQuery,
};
