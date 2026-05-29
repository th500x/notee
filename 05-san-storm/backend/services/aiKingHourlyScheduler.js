/**
 * AI 君主主动决策小时调度器（M2）
 *
 * 设计：
 *   - 「自然小时」`[H:00:00, H+1:00:00)` 内分 `N = hourlyDecisions` 段；每段 `60/N` 分钟，
 *     段内均匀随机一个触发时刻 trigger_k（与 41-1 §8.1 / hourlyDecisions 一致）。
 *   - **重启恢复 = 方案 B**：调度状态完全在内存；进程启动后，对当前小时按
 *     「剩余段」做就地重掷 —— 把「已经过去 / 已触发」的段跳过，对仍在或尚未开始
 *     的段，在 `[max(now, T_k_start), T_k_end)` 内重新均匀随机一次。
 *   - 不依赖外部 cron 库；调用方负责按「每分钟」节奏调用 `runMinuteTick(now)`，
 *     调度器内部保证「同一 slot 不会重复 fire」与「跨小时自动切换」。
 *
 * 与 `passiveApprovalService` 的关系：随机源完全独立；本调度器不会调用被动审批，
 * 也不会与之共享 `Math.random` 序列（每次重掷各自独立，多触发 / 漏触发的边界
 * 副作用接受，文档已说明）。
 *
 * @module backend/services/aiKingHourlyScheduler
 */

const aiKingConfigService = require('./aiKingConfigService');

const MINUTES_PER_HOUR = 60;
const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;

/**
 * 给定 `Date` 计算所在小时的整点 ms（向下取整到该小时 00 分 00 秒）。
 */
function hourStartMs(now) {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

/**
 * 给定 ms 时间戳生成 `YYYY-MM-DDTHH` 字符串作为「小时 key」（本地时区，
 * 与 `server.js` cron 默认时区一致；生产可设 CRON_TZ，但本调度器不直接关心 tz，
 * 因为同一进程内使用相同 `Date` 解释，跨重启的 reroll 逻辑只需要数值比较）。
 */
function hourKeyOfMs(ms) {
  const d = new Date(ms);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const H = String(d.getHours()).padStart(2, '0');
  return `${Y}-${M}-${D}T${H}`;
}

/**
 * 根据 `hourlyDecisions = N` 与当前 `nowMs` 生成本小时 N 段的 `[start, end)` 区间数组（ms）。
 */
function buildHourSlotIntervals(N, hourStart) {
  if (!Number.isInteger(N) || N <= 0) return [];
  const segLen = MS_PER_HOUR / N;
  const out = [];
  for (let k = 0; k < N; k++) {
    const start = hourStart + Math.round(segLen * k);
    const end = hourStart + Math.round(segLen * (k + 1));
    out.push({ slotIndex: k, start, end });
  }
  return out;
}

/**
 * 在 `[startMs, endMs)` 内均匀随机一个触发时刻；rng 注入便于测试可重复。
 */
function pickTriggerInInterval(startMs, endMs, rng = Math.random) {
  if (endMs <= startMs) return startMs;
  const span = endMs - startMs;
  const r = Math.max(0, Math.min(1 - Number.EPSILON, Number(rng())));
  return Math.floor(startMs + r * span);
}

/**
 * 给定 hourlyDecisions、当前 ms 与 hourStart，按「剩余段重掷」语义生成本小时
 * 各 slot 的触发计划。已经过去（end ≤ now）的段直接跳过，正在该段（start ≤ now < end）
 * 或尚未开始（now < start）的段在 `[max(now, start), end)` 内随机一次。
 *
 * @returns {Array<{slotIndex:number, triggerAtMs:number, fired:boolean}>}
 */
function planSlotsForHour(N, hourStart, nowMs, rng = Math.random) {
  const intervals = buildHourSlotIntervals(N, hourStart);
  const slots = [];
  for (const { slotIndex, start, end } of intervals) {
    if (end <= nowMs) continue; // 整段已过 → 跳过
    const effectiveStart = Math.max(nowMs, start);
    if (effectiveStart >= end) continue; // 边界保险
    const triggerAtMs = pickTriggerInInterval(effectiveStart, end, rng);
    slots.push({ slotIndex, triggerAtMs, fired: false });
  }
  return slots;
}

class AiKingHourlyScheduler {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.now] - 注入「当前 ms」获取（默认 Date.now）
   * @param {() => number} [opts.rng] - 注入随机源（默认 Math.random）
   * @param {(payload:{factionId:string,king:object,slotIndex:number,hourKey:string,triggerAtMs:number,nowMs:number}) => Promise<any>|any} [opts.onFire]
   *        - 单次 slot 触发回调；与 `aiKingActiveDecisionService.decide` 对接。
   */
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.rng = opts.rng || Math.random;
    this.onFire = opts.onFire || (() => {});
    /** factionId → { hourKey, slots: Array<{slotIndex,triggerAtMs,fired}> } */
    this.stateByFaction = new Map();
    this.runningTick = false;
  }

  /**
   * 确保某势力本小时的 slot 计划已生成（首次进入此小时则现算）。
   * 重启恢复方案 B：进程内首次见到该 hourKey 即按当前墙钟做剩余段重掷。
   */
  ensureHourPlan(factionId, king, nowMs) {
    const hkNow = hourKeyOfMs(nowMs);
    const cur = this.stateByFaction.get(factionId);
    if (cur && cur.hourKey === hkNow) return cur;
    const N = Math.max(0, Number.isInteger(king.hourlyDecisions) ? king.hourlyDecisions : 0);
    const hStart = hourStartMs(nowMs);
    const slots = planSlotsForHour(N, hStart, nowMs, this.rng);
    const next = { hourKey: hkNow, slots };
    this.stateByFaction.set(factionId, next);
    if (slots.length) {
      console.log(
        `[aiKing][hourly] plan factionId=${factionId} hour=${hkNow} N=${N} slots=` +
          slots.map((s) => `${s.slotIndex}@${new Date(s.triggerAtMs).toISOString()}`).join(','),
      );
    } else {
      console.log(
        `[aiKing][hourly] plan factionId=${factionId} hour=${hkNow} N=${N} (no remaining slots)`,
      );
    }
    return next;
  }

  /**
   * 单次「分钟 tick」：扫描所有配置君主，触发到点未触发的 slot。
   * @param {number} [nowMs]
   */
  async runMinuteTick(nowMs = this.now()) {
    if (this.runningTick) return { skipped: true, reason: 'reentrant' };
    this.runningTick = true;
    try {
      const kings = aiKingConfigService.listAllKings();
      let firedCount = 0;
      for (const king of kings) {
        const fid = king.factionId;
        const plan = this.ensureHourPlan(fid, king, nowMs);
        for (const slot of plan.slots) {
          if (slot.fired) continue;
          if (slot.triggerAtMs > nowMs) continue;
          slot.fired = true;
          firedCount += 1;
          try {
            await this.onFire({
              factionId: fid,
              king,
              slotIndex: slot.slotIndex,
              hourKey: plan.hourKey,
              triggerAtMs: slot.triggerAtMs,
              nowMs,
            });
          } catch (err) {
            console.error(
              `[aiKing][hourly] onFire error factionId=${fid} slot=${slot.slotIndex}: ${err.message}`,
            );
          }
        }
      }
      return { firedCount };
    } finally {
      this.runningTick = false;
    }
  }

  /** 测试 / 管理用：清空内存计划（下一次 tick 重新生成）。 */
  resetForTests() {
    this.stateByFaction.clear();
  }
}

module.exports = {
  AiKingHourlyScheduler,
  buildHourSlotIntervals,
  planSlotsForHour,
  pickTriggerInInterval,
  hourStartMs,
  hourKeyOfMs,
  MINUTES_PER_HOUR,
  MS_PER_MIN,
  MS_PER_HOUR,
};
