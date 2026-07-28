/**
 * @module middleware/validationSchemas/chapter
 */

const { v } = require('../validation');
const { playerId } = require('./common');

const centerQuery = {
  playerId: v.required(playerId),
  season: v.optional(v.nonEmptyString({ max: 16 })),
};

const startNodeBody = {
  playerId: v.required(playerId),
  chapterId: v.required(v.nonEmptyString({ max: 64 })),
  nodeId: v.required(v.nonEmptyString({ max: 32 })),
};

const completeNodeBody = {
  playerId: v.required(playerId),
  chapterId: v.required(v.nonEmptyString({ max: 64 })),
  nodeId: v.required(v.nonEmptyString({ max: 32 })),
};

const claimRewardBody = {
  playerId: v.required(playerId),
  chapterId: v.required(v.nonEmptyString({ max: 64 })),
};

module.exports = {
  centerQuery,
  startNodeBody,
  completeNodeBody,
  claimRewardBody,
};
