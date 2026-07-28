/**
 * routes/adventure.js 校验
 * @module middleware/validationSchemas/adventure
 */

const { v } = require('../validation');
const { playerId } = require('./common');
const { lineupExtraSlotParam } = require('./lineupExtra');

const playerParams = {
  playerId: v.required(playerId),
};

const dispatchBody = {
  extraSlot: v.required(lineupExtraSlotParam),
  themeId: v.required(v.string({ min: 1, max: 64 })),
};

const claimBody = {
  adventureId: v.required(v.integer({ min: 1 })),
};

module.exports = {
  playerParams,
  dispatchBody,
  claimBody,
};
