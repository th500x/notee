/**
 * `routes/players/faction.js` schema（O3-D1 · T-09 第三批）。
 *
 * @module middleware/validationSchemas/playersFaction
 */

const { v } = require('../validation');

const bulletinQuery = {
  limit: v.optional(v.pattern(/^\d+$/, '1–100')),
  category: v.optional(v.nonEmptyString({ max: 32 })),
};

module.exports = {
  bulletinQuery,
};
