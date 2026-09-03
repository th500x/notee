/**
 * `routes/players/lineup.js` 请求体 / params schema（O3-D1 · T-09 第二批）。
 *
 * @module middleware/validationSchemas/playersLineup
 */

const { v } = require('../validation');
const {
  cardInstanceId,
  setInstanceId,
  optionalNullableInstanceId,
} = require('./common');

const EQUIPMENT_SLOTS = ['weapon', 'armor', 'aux_left', 'aux_right'];

const equipCardBody = {
  instanceId: v.required(cardInstanceId),
  equippedBy: v.required(v.nonEmptyString({ max: 32 })),
  equippedSlot: v.required(v.nonEmptyString({ max: 32 })),
};

const unequipCardBody = {
  instanceId: v.required(cardInstanceId),
};

const setInstanceIdParam = {
  setInstanceId: v.required(setInstanceId),
};

const renameSetBody = {
  setInstanceId: v.required(setInstanceId),
  displayName: v.optional(v.string({ max: 64 })),
};

const assignSlotBody = {
  setInstanceId: v.required(setInstanceId),
  slot: v.required(v.enum(EQUIPMENT_SLOTS)),
  equipmentInstanceId: optionalNullableInstanceId,
};

const finalizeSetBody = {
  setInstanceId: v.required(setInstanceId),
  displayName: v.optional(v.string({ max: 64 })),
};

module.exports = {
  equipCardBody,
  unequipCardBody,
  setInstanceIdParam,
  renameSetBody,
  assignSlotBody,
  finalizeSetBody,
};
