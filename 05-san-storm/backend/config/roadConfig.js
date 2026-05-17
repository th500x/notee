/**
 * 道路系统配置常量
 *
 * @description
 *   原本散落在 `services/road/roadShared.js` 顶部 + `roadEncounterService.js` 顶部的"业务可调参数"，
 *   按 `backend/config/campaignConfig.js` 同模式提到本文件，集中维护。
 *
 *   定位：**运营 / 数值调整入口**——这些数字代表玩法规则（每日免费格、每步粮草、势力池上限等），
 *   要改时改这一处即可，业务代码与文档锚点引用 `roadConfig.X` 不变。
 *
 *   `services/road/roadShared.js` 从本文件 `require` 并以**完全相同**的具名 re-export，**对外**
 *   `require('./services/road/roadShared')` 取常量的代码路径不变；这样既得到"集中调整入口"，
 *   又避免历史调用点（已在 `roadEncounterService.js` / `roadInterceptService.js` 等多处）的批量改动。
 *
 * @see docs/30-frontend/31-6-STRATEGIC_ROAD_PVP.md
 * @see docs/00-base/02-architecture-split/12-road-encounter-api.md
 */

/** 开启 / 关闭道路拦截（守门）单次费用，扣银两 */
const INTERCEPT_COST_SILVER = 40; // 31-6 §三

/** 每日免费"自由步"上限（每位玩家） */
const FREE_MOVES_PER_DAY = 50; // 31-6 §9.1

/** 单步付费粮草（个人粮 → 势力池兜底） */
const FOOD_PER_STEP = 2; // 31-6 §9.1

/** 单日势力池"垫粮"上限（同一势力下属玩家共享） */
const RESERVE_FOOD_DAILY_LIMIT = 500; // 31-6 §十

/** 守方遇袭弹窗倒计时长（秒），与攻城披挂 `WAIT_IN_GAME` 产品口径对齐 */
const ROAD_DEFENDER_ALERT_SEC = 10;

/**
 * `fighting` 且从未写入 `battle_id`、超过此分钟数仍无结算提交：
 * 视为客户端未进战 / 未打完等卡死，自动 `cancelled` 释放格锁。
 *
 * 须明显长于单场本地战可能时长；短于"玩家长期挂机不关页"误伤窗口。
 */
const STALE_FIGHTING_NO_SETTLEMENT_MINUTES = 5;

module.exports = {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHTING_NO_SETTLEMENT_MINUTES,
};
