/**
 * 战略道路行军配置常量
 *
 * @description
 *   定位：**运营 / 数值调整入口**——这些数字代表玩法规则（每日免费格、每步粮草、势力池上限），
 *   要改时改这一处即可，业务代码与文档锚点引用 `roadConfig.X` 不变。
 *
 *   `services/road/roadShared.js` 从本文件 `require` 并以**完全相同**的具名 re-export。
 *
 *   道路同格遭遇战（含来战/守门）已于 2026-07 归档移除：见 `_archive/dao-lu-yu-di/`。
 *
 * @see docs/01-jun-exploration/30-frontend/31-6-STRATEGIC_ROAD_MARCH.md
 */

/** 每日免费"自由步"上限（每位玩家） */
const FREE_MOVES_PER_DAY = 300; // 31-6 §6；31-2（2026-05-19：50→300）

/** 单步付费粮草（个人粮 → 势力池兜底） */
const FOOD_PER_STEP = 2; // 31-6 §6

/** 单日势力池"垫粮"上限（同一势力下属玩家共享） */
const RESERVE_FOOD_DAILY_LIMIT = 500; // 31-6 §6

module.exports = {
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
};
