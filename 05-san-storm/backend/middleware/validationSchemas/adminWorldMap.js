/**
 * `routes/adminWorldMap.js` schema（工坊路径；旧四象限 schema 见 `_archive/san-guo-di-tu`）。
 *
 * @module middleware/validationSchemas/adminWorldMap
 */

const { v } = require('../validation');
const { sanJunId } = require('./common');

const junIdParam = {
  junId: v.required(sanJunId),
};

/** 郡战略图工坊整体保存（31-1） */
const saveJunWorkshopBody = {
  junId: v.required(sanJunId),
  cities: v.required(v.array({ minLength: 0, maxLength: 64 })),
  battlefield: v.optional(v.plainObject()),
  entryCells: v.optional(v.array({ maxLength: 10_000 })),
  roadCells: v.optional(v.array({ maxLength: 100_000 })),
  roadConnectivity: v.optional(v.enum(['4', '8'])),
};

module.exports = {
  junIdParam,
  saveJunWorkshopBody,
};
