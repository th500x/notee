/**
 * `routes/chats.js` schema（O3-D1 · T-09 第四批）。
 *
 * @module middleware/validationSchemas/chats
 */

const { v } = require('../validation');
const { playerId, chatChannelType, queryLimit } = require('./common');

const channelQueryBase = {
  playerId: v.required(playerId),
  channelType: v.required(chatChannelType),
  channelId: v.optional(v.nonEmptyString({ max: 128 })),
};

const listMessagesQuery = {
  ...channelQueryBase,
  limit: v.optional(queryLimit),
};

const legionInfoQuery = {
  playerId: v.required(playerId),
};

const sendMessageBody = {
  playerId: v.required(playerId),
  channelType: v.required(chatChannelType),
  channelId: v.optional(v.nonEmptyString({ max: 128 })),
  content: v.required(v.nonEmptyString({ max: 100 })),
};

module.exports = {
  channelQueryBase,
  listMessagesQuery,
  legionInfoQuery,
  sendMessageBody,
};
