/**
 * 跨路由复用的 validation 字段模式（O3-D1）。
 *
 * @module middleware/validationSchemas/common
 */

const { v } = require('../validation');

/** `san_1` / `san_2` … */
const sanSeason = v.pattern(/^san_\d+$/, 'san_1 / san_2 …');

/** `san_1_jun_yingchuan` 等郡 ID */
const sanJunId = v.pattern(/^san_\d+_jun_[a-z0-9_]+$/, 'san_1_jun_yingchuan …');

/** 幂等键 / 客户端请求 ID */
const clientRequestId = v.nonEmptyString({ max: 128 });

/** 遭遇实例 ID（UUID 或短 id） */
const encounterId = v.idLike({ max: 128 });

/** POI / 城寨 / 城池 anchor id */
const poiId = v.idLike({ max: 128 });

module.exports = {
  sanSeason,
  sanJunId,
  clientRequestId,
  encounterId,
  poiId,
};
