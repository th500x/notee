/**
 * `routes/texts.js` · `routes/legacyPlayerApi.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/texts
 */

const { v } = require('../validation');
const { playerId, warId, queryLimit } = require('./common');

const inboxQuery = {
  limit: v.optional(queryLimit),
};

const textIdParam = {
  textId: v.required(v.idLike({ max: 128 })),
};

const legacyBattleIdParam = {
  battleId: v.required(warId),
};

const legacyNoteIdParam = {
  noteId: v.required(v.nonEmptyString({ max: 128 })),
};

module.exports = {
  inboxQuery,
  textIdParam,
  legacyBattleIdParam,
  legacyNoteIdParam,
};
