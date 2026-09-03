/**
 * `routes/memorial.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/memorial
 */

const { v } = require('../validation');
const { playerId, warId } = require('./common');

const playerIdQuery = {
  playerId: v.required(playerId),
};

const battleDownloadQuery = {
  playerId: v.required(playerId),
  id: v.required(v.pattern(/^\d+$/, 'memorial_images.id')),
};

const battleMemorialBody = {
  playerId: v.required(playerId),
  battleId: v.required(warId),
  imageBase64: v.required(v.nonEmptyString({ max: 15_000_000 })),
};

const memorialFilenameParam = {
  filename: v.required(v.pattern(/^[a-zA-Z0-9._-]+\.png$/, 'xxx.png')),
};

module.exports = {
  playerIdQuery,
  battleDownloadQuery,
  battleMemorialBody,
  memorialFilenameParam,
};
