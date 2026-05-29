/**
 * `routes/players/profile.js` schema（O3-D1 · T-09 第三批）。
 *
 * @module middleware/validationSchemas/playersProfile
 */

const { v } = require('../validation');
const { cardInstanceId, poiId } = require('./common');

const characterRankQuery = {
  bucket: v.required(v.nonEmptyString({ max: 64 })),
};

const mainCityBody = {
  cityId: v.required(poiId),
};

const barracksTransferBody = {
  instanceIds: v.required(v.array({
    minLength: 1,
    maxLength: 64,
    itemValidator: cardInstanceId,
  })),
};

module.exports = {
  characterRankQuery,
  mainCityBody,
  barracksTransferBody,
};
