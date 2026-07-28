/**
 * 匪寨「攻打」次数：按 **日历日 × 三个 8 小时整点档**（0–8 / 8–16 / 16–24）推进序列号，每跨越一档 **+perWindow**，上限 **max**。
 * 与探索 / 攻城「每小时 +6、0–8 点休息」**不同网格**，故 **独立** 于 `hourlyQuotaWithRestWindow.js`。
 *
 * @see docs/00/10-core-system/15-2-SERVER_REFRESH_AND_LIMITS.md
 * @see docs/04-challenge-mode/17-7-BANDIT_SYSTEM.md（本文件次数档已废止参与门闸；个人塔循环见 settlement / raidQuota）
 */

'use strict';

/** 与 `playerBanditRaidQuotaService` 历史常量一致；单源避免与 17-7 文案漂移 */
const BANDIT_RAID_QUOTA_DEFAULTS = Object.freeze({
  initial: 6,
  max: 18,
  perWindow: 6,
  /** 每个自然日内的档位数：0–8、8–16、16–24 */
  windowsPerDay: 3,
});

/**
 * 当前时刻所在「全局档」单调序号：自然日序 × 3 + 档内下标（0=0–8，1=8–16，2=16–24）。
 * 使用与原先 `playerBanditRaidQuotaService` 相同的 **Node 本地墙钟**（`Date`）。
 *
 * @param {Date} [date]
 * @returns {number}
 */
function banditWindowSerialAt(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();
  const midnight = new Date(y, mo, day, 0, 0, 0, 0).getTime();
  const daySerial = Math.floor(midnight / 86400000);
  const widx = h < 8 ? 0 : h < 16 ? 1 : 2;
  return daySerial * BANDIT_RAID_QUOTA_DEFAULTS.windowsPerDay + widx;
}

/**
 * 下一档边界（毫秒时间戳）：08:00、16:00、次日 00:00。
 *
 * @param {Date} [date]
 * @returns {number}
 */
function nextBanditQuotaBoundaryMs(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();
  if (h < 8) return new Date(y, mo, day, 8, 0, 0, 0).getTime();
  if (h < 16) return new Date(y, mo, day, 16, 0, 0, 0).getTime();
  return new Date(y, mo, day + 1, 0, 0, 0, 0).getTime();
}

/**
 * @param {number} [nowMs] 默认 `Date.now()`
 * @returns {number} 距下一档边界的毫秒数（≥0）
 */
function msUntilNextBanditQuotaBoundary(nowMs = Date.now()) {
  return Math.max(0, nextBanditQuotaBoundaryMs(new Date(nowMs)) - nowMs);
}

/**
 * @param {{ remaining?: unknown, lastAccruedSerial?: unknown }|null|undefined} raid
 * @param {number} currentSerial `banditWindowSerialAt(now)` 的当前值
 * @param {typeof BANDIT_RAID_QUOTA_DEFAULTS} [config]
 * @returns {{ remaining: number, lastAccruedSerial: number, changed: boolean }}
 */
function accrueBanditRaidQuota(raid, currentSerial, config = BANDIT_RAID_QUOTA_DEFAULTS) {
  let remaining = Number.isFinite(Number(raid?.remaining)) ? Number(raid.remaining) : config.initial;
  let lastSerial =
    raid?.lastAccruedSerial != null && Number.isFinite(Number(raid.lastAccruedSerial))
      ? Number(raid.lastAccruedSerial)
      : null;

  if (lastSerial == null) {
    const r0 = Math.min(config.max, Math.max(0, config.initial));
    return { remaining: r0, lastAccruedSerial: currentSerial, changed: true };
  }

  let changed = false;
  while (lastSerial < currentSerial) {
    lastSerial += 1;
    remaining = Math.min(config.max, remaining + config.perWindow);
    changed = true;
  }

  const clamped = Math.min(config.max, Math.max(0, remaining));
  if (clamped !== remaining) {
    remaining = clamped;
    changed = true;
  }

  return { remaining, lastAccruedSerial: lastSerial, changed };
}

module.exports = {
  BANDIT_RAID_QUOTA_DEFAULTS,
  banditWindowSerialAt,
  nextBanditQuotaBoundaryMs,
  msUntilNextBanditQuotaBoundary,
  accrueBanditRaidQuota,
};
