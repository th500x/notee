/**
 * 按「活跃整点小时」恢复配额，并在连续休息时段内不恢复（纯函数，无 I/O）。
 *
 * 用于探索行动配额与攻城行动配额：同一套数字与休息窗口（见 docs/10-core-system/15-2）。
 * 时钟源：调用方传入的 `now`（默认 `new Date()`），即 **Node 进程本地时区** 下的墙钟；
 * 与 MySQL `CURDATE()` 日界无关。
 */

'use strict';

const MS_PER_HOUR = 3600000;
/** 防止异常时间戳导致死循环；48h 已覆盖跨休息区后的足额补点 */
const MAX_HOUR_BUCKETS_TO_WALK = 48;

/**
 * 探索与攻城当前产品口径下的默认配置（两处业务共用，避免双份常量漂移）。
 * @type {Readonly<HourlyQuotaWithRestConfig>}
 */
const EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS = Object.freeze({
  refillPerHour: 6,
  maxQuota: 18,
  /** 休息时段起点（含）：0 点所在小时 */
  restHourStart: 0,
  /** 休息时段终点（不含）：8 表示 0–7 点整小时为休息 */
  restHourEnd: 8,
});

/**
 * @typedef {Object} HourlyQuotaWithRestConfig
 * @property {number} refillPerHour 每个非休息整点增加的剩余次数
 * @property {number} maxQuota 剩余次数上限
 * @property {number} restHourStart 休息窗口起始小时 [0,23]
 * @property {number} restHourEnd 休息窗口结束小时（不含）；须 > restHourStart
 */

/**
 * @param {number} hour 0–23
 * @param {HourlyQuotaWithRestConfig} config
 */
function isRestHour(hour, config) {
  return hour >= config.restHourStart && hour < config.restHourEnd;
}

/**
 * 当前日历日下「本整点」的墙钟起点（毫秒时间戳），与旧 `getHourTs` 语义一致。
 * @param {Date} date
 */
function wallClockHourStartMs(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours()
  ).getTime();
}

/**
 * 从 `fromHourStartMs` 到 `toHourStartMs`（不含右端）之间，经过了多少个「非休息」整点小时。
 * 以整点边界推进，与原先 `countExploreActiveHours` / `countActiveHours` 一致。
 *
 * @param {number} fromHourStartMs
 * @param {number} toHourStartMs
 * @param {HourlyQuotaWithRestConfig} config
 */
function countNonRestHourBuckets(fromHourStartMs, toHourStartMs, config) {
  if (toHourStartMs <= fromHourStartMs) return 0;
  let count = 0;
  let ts = fromHourStartMs;
  let i = 0;
  while (ts < toHourStartMs && i < MAX_HOUR_BUCKETS_TO_WALK) {
    if (!isRestHour(new Date(ts).getHours(), config)) count += 1;
    ts += MS_PER_HOUR;
    i += 1;
  }
  return count;
}

/**
 * 计算当前应显示的剩余次数与应写库的「上次结算整点」时间戳（毫秒）。
 *
 * @param {number|null|undefined} remaining 当前剩余次数（库中可能为 null）
 * @param {number|null|undefined} lastRefillHourStartMs 上次写入的整点墙钟起点（ms）；无记录时为 null/undefined/0
 * @param {Date} [now]
 * @param {HourlyQuotaWithRestConfig} [config] 默认与 {@link EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS} 相同
 * @returns {{ remaining: number, lastRefillTs: number }} `lastRefillTs` 与库列 `*_quota_refill_ts` 及 API 字段名一致
 */
function calcHourlyQuotaWithRestWindow(remaining, lastRefillHourStartMs, now = new Date(), config = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS) {
  const currentHourStartMs = wallClockHourStartMs(now);
  const prev =
    lastRefillHourStartMs != null && Number.isFinite(Number(lastRefillHourStartMs)) && Number(lastRefillHourStartMs) > 0
      ? Number(lastRefillHourStartMs)
      : null;

  if (prev == null) {
    return {
      remaining: isRestHour(now.getHours(), config) ? 0 : config.refillPerHour,
      lastRefillTs: currentHourStartMs,
    };
  }

  const nonRestHours = countNonRestHourBuckets(prev, currentHourStartMs, config);
  if (nonRestHours > 0) {
    return {
      remaining: Math.min((remaining || 0) + nonRestHours * config.refillPerHour, config.maxQuota),
      lastRefillTs: currentHourStartMs,
    };
  }

  return { remaining: remaining || 0, lastRefillTs: prev };
}

module.exports = {
  calcHourlyQuotaWithRestWindow,
  EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
};
