/**
 * `routes/lineupExtra.js` 校验
 * @module middleware/validationSchemas/lineupExtra
 */

const { v } = require('../validation');
const { playerId } = require('./common');

const lineupExtraSlotParam = (val, name) => {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 1 || n > 4) {
    return `${name || 'slot'} 须为 1–4`;
  }
  return null;
};

const playerSlotParams = {
  playerId: v.required(playerId),
  slot: v.required(lineupExtraSlotParam),
};

const optionalInstance = v.optional(v.string({ max: 64 }));

const saveBody = {
  char1_card: optionalInstance,
  char1_equipment_card: optionalInstance,
  char1_title: optionalInstance,
  char1_achievement: optionalInstance,
  char1_treasure: optionalInstance,
  char1_troop1: optionalInstance,
  char1_troop2: optionalInstance,
  char2_card: optionalInstance,
  char2_equipment_card: optionalInstance,
  char2_title: optionalInstance,
  char2_achievement: optionalInstance,
  char2_treasure: optionalInstance,
  char2_troop1: optionalInstance,
  char2_troop2: optionalInstance,
};

module.exports = {
  playerSlotParams,
  saveBody,
  lineupExtraSlotParam,
};
