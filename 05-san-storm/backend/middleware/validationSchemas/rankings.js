/**
 * `routes/rankings.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/rankings
 */

const { v } = require('../validation');
const { playerId, queryLimit } = require('./common');

const OVERALL_SORTS = ['avg', 'wins', 'reputation', 'events', 'badges', 'win', 'rep', 'badge', 'event', 'average'];

const overallQuery = {
  limit: v.optional(queryLimit),
  playerId: v.optional(playerId),
  serverId: v.optional(v.nonEmptyString({ max: 32 })),
  sort: v.optional(v.enum(OVERALL_SORTS)),
};

const campaignQuery = {
  campaignId: v.required(v.nonEmptyString({ max: 128 })),
  limit: v.optional(queryLimit),
  playerId: v.optional(playerId),
  serverId: v.optional(v.nonEmptyString({ max: 32 })),
};

const eventRankingsQuery = {
  limit: v.optional(queryLimit),
  playerId: v.optional(playerId),
};

const eventIdParam = {
  eventId: v.required(v.nonEmptyString({ max: 128 })),
};

module.exports = {
  overallQuery,
  campaignQuery,
  eventRankingsQuery,
  eventIdParam,
};
