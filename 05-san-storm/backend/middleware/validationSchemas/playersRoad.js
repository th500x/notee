/**
 * `routes/players/road.js` 请求体 / query schema（O3-D1 · T-09 第一批）。
 *
 * 几何路径、占格、扣粮等业务约束仍在 service 层；此处只做 HTTP 形态校验。
 * 遇敌 / 来战相关 schema 随道路遭遇战归档一并移除（`_archive/dao-lu-yu-di/`）。
 *
 * @module middleware/validationSchemas/playersRoad
 */

const { v } = require('../validation');
const { sanSeason, sanJunId, clientRequestId, poiId } = require('./common');

const roadPathStep = (val, name) => {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return `${name} 必须为对象`;
  const xErr = v.required(v.integer({ min: 0, max: 128 }))(val.x, `${name}.x`);
  if (xErr) return xErr;
  const yErr = v.required(v.integer({ min: 0, max: 128 }))(val.y, `${name}.y`);
  if (yErr) return yErr;
  return null;
};

const moveBody = {
  confirmFoodCost: v.required(v.literal(true)),
  season: v.required(sanSeason),
  junId: v.required(sanJunId),
  clientRequestId: v.required(clientRequestId),
  path: v.required(v.array({ maxLength: 512, itemValidator: roadPathStep })),
  targetPoiId: v.optional(poiId),
  /** 郡战场等多入口 POI：点选入口世界格（与 path 同 x/y 口径） */
  targetPoiStand: v.optional(roadPathStep),
};

module.exports = {
  moveBody,
};
