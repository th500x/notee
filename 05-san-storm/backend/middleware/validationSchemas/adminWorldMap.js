/**
 * `routes/adminWorldMap.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/adminWorldMap
 */

const { v } = require('../validation');
const { sanSeason, sanJunId, mapQuad } = require('./common');

const junIdParam = {
  junId: v.required(sanJunId),
};

const junQuadParams = {
  junId: v.required(sanJunId),
  quad: v.required(mapQuad),
};

const junIdBody = {
  junId: v.required(sanJunId),
};

const boundariesBody = {
  season: v.required(sanSeason),
  edges: v.required(v.array({ minLength: 1, maxLength: 500 })),
};

const generateMergedMapBody = {
  junId: v.required(sanJunId),
  seed: v.optional(v.integer({ min: 0, max: 2_147_483_647 })),
};

const saveRoadCellsBody = {
  junId: v.required(sanJunId),
  roadCells: v.optional(v.array({ maxLength: 100_000 })),
  roadConnectivity: v.optional(v.plainObject()),
};

const batchNpcGarrisonBody = {
  junId: v.required(sanJunId),
  ownershipMode: v.required(v.enum(['player_owned', 'npc_side'])),
  counts: v.optional(v.plainObject()),
  season: v.optional(sanSeason),
};

module.exports = {
  junIdParam,
  junQuadParams,
  junIdBody,
  boundariesBody,
  generateMergedMapBody,
  saveRoadCellsBody,
  batchNpcGarrisonBody,
};
