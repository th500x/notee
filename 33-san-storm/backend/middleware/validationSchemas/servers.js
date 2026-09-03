/**
 * `routes/servers.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/servers
 */

const { v } = require('../validation');
const { serverId } = require('./common');

const serverIdParam = {
  serverId: v.required(serverId),
};

module.exports = {
  serverIdParam,
};
