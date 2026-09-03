/**
 * `routes/players/creation.js` schema（O3-D1 · T-09 第三批）。
 *
 * @module middleware/validationSchemas/playersCreation
 */

const { v } = require('../validation');
const { playerId, factionId, cardRarity } = require('./common');

const generateAttributesBody = {
  rarity: v.optional(cardRarity),
};

const validateNameBody = {
  characterName: v.required(v.nonEmptyString({ max: 16 })),
  serverId: v.optional(v.nonEmptyString({ max: 32 })),
};

const createCharacterBody = {
  playerId: v.required(playerId),
  characterName: v.required(v.nonEmptyString({ max: 16 })),
  factionId: v.required(factionId),
  factionName: v.required(v.nonEmptyString({ max: 64 })),
  attributes: v.required(v.plainObject()),
  serverId: v.required(v.nonEmptyString({ max: 32 })),
  skills: v.optional(v.plainObject()),
  initialSilver: v.optional(v.integer({ min: 0, max: 1_000_000_000 })),
  avatar: v.optional(v.nonEmptyString({ max: 256 })),
  initialTroops: v.optional(v.array({ maxLength: 32 })),
};

const initialTroopsQuery = {
  factionId: v.required(factionId),
};

const selectOptionBody = {
  batch: v.required(v.integer({ min: 0, max: 9999 })),
  index: v.required(v.integer({ min: 0, max: 99 })),
};

module.exports = {
  generateAttributesBody,
  validateNameBody,
  createCharacterBody,
  initialTroopsQuery,
  selectOptionBody,
};
