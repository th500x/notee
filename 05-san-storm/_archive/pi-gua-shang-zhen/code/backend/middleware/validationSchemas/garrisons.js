/**
 * `routes/garrisons.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/garrisons
 */

const { v } = require('../validation');
const { poiId, playerId, garrisonSlotParam } = require('./common');

const cityIdParam = {
  cityId: v.required(poiId),
};

const playerCityParams = {
  playerId: v.required(playerId),
  cityId: v.required(poiId),
};

const garrisonSlotParams = {
  slot: v.required(garrisonSlotParam),
};

const cityIdQuery = {
  cityId: v.required(poiId),
};

const onDutyBody = {
  onDuty: v.required(v.boolean()),
  cityId: v.optional(poiId),
};

const saveGarrisonBody = {
  cityId: v.required(poiId),
  cityName: v.optional(v.string({ max: 128 })),
};

module.exports = {
  cityIdParam,
  playerCityParams,
  garrisonSlotParams,
  cityIdQuery,
  onDutyBody,
  saveGarrisonBody,
};
