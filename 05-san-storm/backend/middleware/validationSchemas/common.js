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

/** 玩家 ID（query/body 通用） */
const playerId = v.nonEmptyString({ max: 64 });

/** 卡牌 / 装备实例 ID */
const cardInstanceId = v.idLike({ max: 128 });

/** 装备套装实例 ID */
const setInstanceId = v.idLike({ max: 128 });

/** 道具 ID */
const itemId = v.idLike({ max: 128 });

/** 匪寨地图对象 ID（04-1 §15） */
const banditPoiId = v.pattern(/^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i, 'san_1_bandit_1_…');

/** 可选 null 或实例 ID（卸下套装槽） */
const optionalNullableInstanceId = v.optional((val, name) => {
  if (val === undefined || val === null) return null;
  return cardInstanceId(val, name);
});

module.exports = {
  sanSeason,
  sanJunId,
  clientRequestId,
  encounterId,
  poiId,
  playerId,
  cardInstanceId,
  setInstanceId,
  itemId,
  banditPoiId,
  optionalNullableInstanceId,
};
