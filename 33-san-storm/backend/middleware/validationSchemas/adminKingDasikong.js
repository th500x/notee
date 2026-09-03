/**
 * `routes/adminKingDasikong.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/adminKingDasikong
 */

const { v } = require('../validation');
const { factionId } = require('./common');

const dailyTickBody = {
  factionId: v.optional(factionId),
};

const diagnosticQuery = {
  factionId,
};

module.exports = {
  dailyTickBody,
  diagnosticQuery,
};
