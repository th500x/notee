/**
 * `routes/pvpWars.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/pvpWars
 */

const { v } = require('../validation');
const {
  sanSeason,
  factionId,
  playerId,
  poiId,
  warId,
  queryLimit,
  queryNonNegativeInteger,
} = require('./common');

const tributeSilverField = v.optional(v.integer({ min: 0, max: 100000 }));
const tributeSilverQuery = v.optional(queryNonNegativeInteger({ min: 0, max: 100000 }));

const previewApprovalQuery = {
  factionId: v.required(factionId),
  proposalType: v.required(v.enum(['war', 'policy'])),
  tributeSilver: tributeSilverQuery,
};

const proposalsBody = {
  season: v.optional(sanSeason),
  attackerFactionId: v.required(factionId),
  targetCityId: v.required(poiId),
  proposerPlayerId: v.required(playerId),
  proposalId: v.optional(v.idLike({ max: 128 })),
  serverId: v.optional(v.idLike({ max: 64 })),
  transientPolicies: v.optional(v.plainObject()),
  tributeSilver: tributeSilverField,
};

const listWarsQuery = {
  status: v.optional(v.nonEmptyString({ max: 64 })),
  factionId: v.optional(factionId),
  season: v.optional(sanSeason),
  limit: v.optional(queryLimit),
};

const factionIdQuery = {
  factionId: v.required(factionId),
};

const remonstrancePanelQuery = {
  factionId: v.required(factionId),
  season: v.optional(sanSeason),
};

const warIdParam = {
  id: v.required(warId),
};

const cityIdParam = {
  cityId: v.required(poiId),
};

const cancelWarBody = {
  reason: v.optional(v.string({ max: 256 })),
  byAdmin: v.optional(v.boolean()),
  endedByOfficial: v.optional(v.boolean()),
};

const playerIdBody = {
  playerId: v.required(playerId),
  /** 结算「继续」连打：不扣兵符（与匪寨同口径） */
  continueChain: v.optional(v.boolean()),
};

const baseCampSiegeResultBody = {
  playerId: v.required(playerId),
  killedIndices: v.optional(v.array({ maxLength: 64 })),
  result: v.optional(v.enum(['win', 'lose'])),
  silverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleReportSaved: v.optional(v.boolean()),
};

const citySiegeResultBody = {
  playerId: v.required(playerId),
  defenderType: v.optional(v.enum(['pvp_online', 'player_garrison', 'npc'])),
  defenderPlayerId: v.optional(playerId),
  defenderGarrisonSlot: v.optional(v.integer({ min: 0, max: 20 })),
  garrisonUnits: v.optional(v.array({ maxLength: 32 })),
  defenderLineupTroopUpdates: v.optional(v.array({ maxLength: 32 })),
  killedIndices: v.optional(v.array({ maxLength: 64 })),
  result: v.optional(v.enum(['win', 'lose'])),
  silverSpent: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  battleScore: v.optional(v.integer({ min: -1_000_000_000, max: 1_000_000_000 })),
  battleReportSaved: v.optional(v.boolean()),
  npcBatchIndex: v.optional(v.integer({ min: 0, max: 99 })),
};

const factionIdBody = {
  factionId: v.required(factionId),
};

module.exports = {
  previewApprovalQuery,
  proposalsBody,
  listWarsQuery,
  factionIdQuery,
  remonstrancePanelQuery,
  warIdParam,
  cityIdParam,
  cancelWarBody,
  playerIdBody,
  baseCampSiegeResultBody,
  citySiegeResultBody,
  factionIdBody,
};
