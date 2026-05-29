/**
 * `routes/campaignMaps.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/campaignMaps
 */

const { v } = require('../validation');
const { sanSeason, playerId } = require('./common');

const PRESET_IDS = ['san_1_camp_1001_v1', 'san_1_camp_1001_v2'];

const presetIdParam = {
  id: v.required(v.enum(PRESET_IDS)),
};

const definitionsQuery = {
  season: v.optional(sanSeason),
};

const centerQuery = {
  playerId: v.required(playerId),
  season: v.optional(sanSeason),
};

const progressPatchBody = {
  playerId: v.required(playerId),
  patch: v.required(v.plainObject()),
};

const claimRewardBody = {
  playerId: v.required(playerId),
  campaignId: v.required(v.idLike({ max: 128 })),
};

module.exports = {
  presetIdParam,
  definitionsQuery,
  centerQuery,
  progressPatchBody,
  claimRewardBody,
};
