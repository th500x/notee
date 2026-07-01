/**
 * AI 玩家行为调度器（42-1 §8 · 42-2 Step 6）
 *
 * 设计（对齐 `aiKingHourlyScheduler` 的「窗口内分槽 + 内存计划 + 重启重掷」范式）：
 *   - **20 分钟窗口**：把全部 AI 玩家随机铺到窗口内的某一分钟槽；每分钟 tick 取「本分钟槽」的 AI 启动其
 *     `runAiPlayerRoutine`，使 90 人在 20 分钟内各被唤起约一次（与 41-1 §3.3「独立随机源」一致）。
 *   - **并发上限 maxConcurrent（默认 5）**：同时执行的 routine 不超过上限，超出 **FIFO 排队**，
 *     有空位即出队启动。
 *   - **防重**：进程内 `runningIds`（叠加 orchestrator 自身的 `runningPlayers` 双保险）；
 *     同一 AI 仍在跑 / 已在本窗口触发过 → 不重复入队。
 *   - **重启恢复（方案 B，内存态）**：进程启动或跨窗口后重新规划；对「剩余分钟」重掷，
 *     已过去的分钟槽本窗口跳过（下一窗口再轮到），不持久化调度状态。
 *
 * 不依赖 cron 库的内部时序：调用方（server.js）按「每分钟」节奏调用 `runMinuteTick()`。
 * 失败不吞：单个 AI routine 异常 `console.error`，不影响其余 AI 与后续窗口。
 *
 * @module backend/services/aiPlayerBehaviorScheduler
 */

const { pool } = require('../database/connection');
const { AI_PLAYER_BEHAVIOR } = require('../config/aiPlayerBehavior');
const aiPlayerDailyOrchestrator = require('./aiPlayerDailyOrchestrator');

const LOG = '[aiPlayer][scheduler]';
const MS_PER_MINUTE = 60000;

/** 窗口起点 ms（按墙钟对齐到 windowMs 整数倍）。 */
function windowStartMs(nowMs, windowMinutes) {
  const windowMs = windowMinutes * MS_PER_MINUTE;
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** 窗口内当前分钟下标（0 … windowMinutes-1）。 */
function minuteIndexInWindow(nowMs, windowMinutes) {
  const wStart = windowStartMs(nowMs, windowMinutes);
  const idx = Math.floor((nowMs - wStart) / MS_PER_MINUTE);
  return Math.max(0, Math.min(windowMinutes - 1, idx));
}

/**
 * 在 `[minuteFrom, windowMinutes)` 内随机一个分钟槽（重启重掷只铺剩余分钟）。
 * @returns {number}
 */
function pickSlotMinute(minuteFrom, windowMinutes, rng = Math.random) {
  const lo = Math.max(0, Math.min(windowMinutes - 1, minuteFrom));
  const span = windowMinutes - lo;
  if (span <= 0) return windowMinutes - 1;
  const r = Math.max(0, Math.min(1 - Number.EPSILON, Number(rng())));
  return lo + Math.floor(r * span);
}

class AiPlayerBehaviorScheduler {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.now] 注入当前 ms（默认 Date.now）
   * @param {() => number} [opts.rng] 注入随机源（默认 Math.random）
   * @param {number} [opts.windowMinutes] 默认取配置 20
   * @param {number} [opts.maxConcurrent] 默认取配置 5
   * @param {() => Promise<string[]>} [opts.loadAiPlayerIds] 注入 AI id 列表加载（默认查库）
   * @param {(playerId:string) => Promise<any>} [opts.runRoutine] 注入单 AI 执行（默认 orchestrator）
   */
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.rng = opts.rng || Math.random;
    this.windowMinutes = Math.max(1, Number(opts.windowMinutes) || AI_PLAYER_BEHAVIOR.windowMinutes || 20);
    this.maxConcurrent = Math.max(1, Number(opts.maxConcurrent) || AI_PLAYER_BEHAVIOR.maxConcurrent || 5);
    this.loadAiPlayerIds = opts.loadAiPlayerIds || defaultLoadAiPlayerIds;
    this.runRoutine = opts.runRoutine || ((pid) => aiPlayerDailyOrchestrator.runAiPlayerRoutine(pid));

    /** 本窗口起点（windowKey） */
    this.windowKey = null;
    /** playerId → 分钟槽 */
    this.plan = new Map();
    /** 本窗口已入队/触发过的 playerId */
    this.fired = new Set();
    /** 等待空位的 playerId（FIFO） */
    this.queue = [];
    /** 正在执行 routine 的 playerId */
    this.runningIds = new Set();
    this.planningWindow = false;
  }

  /** 跨窗口（或首次）时重新规划：拉 AI 列表，给每人在剩余分钟内随机一个分钟槽。 */
  async ensureWindowPlan(nowMs) {
    const wKey = windowStartMs(nowMs, this.windowMinutes);
    if (this.windowKey === wKey) return;
    if (this.planningWindow) return;
    this.planningWindow = true;
    try {
      const ids = await this.loadAiPlayerIds();
      const minuteNow = minuteIndexInWindow(nowMs, this.windowMinutes);
      const plan = new Map();
      for (const id of ids) {
        plan.set(String(id), pickSlotMinute(minuteNow, this.windowMinutes, this.rng));
      }
      this.windowKey = wKey;
      this.plan = plan;
      this.fired = new Set();
      this.queue = [];
      console.log(
        `${LOG} plan window=${new Date(wKey).toISOString()} ais=${plan.size} ` +
          `minuteNow=${minuteNow} window=${this.windowMinutes} maxConcurrent=${this.maxConcurrent}`,
      );
    } finally {
      this.planningWindow = false;
    }
  }

  /** 每分钟 tick：把本分钟槽、未触发、未在跑的 AI 入队，再按并发上限出队启动。 */
  async runMinuteTick(nowMs = this.now()) {
    await this.ensureWindowPlan(nowMs);
    const minuteIdx = minuteIndexInWindow(nowMs, this.windowMinutes);
    let enqueued = 0;
    for (const [pid, slot] of this.plan) {
      if (slot !== minuteIdx) continue;
      if (this.fired.has(pid)) continue;
      if (this.runningIds.has(pid)) continue;
      this.fired.add(pid);
      this.queue.push(pid);
      enqueued += 1;
    }
    this.drainQueue();
    return {
      minuteIdx,
      enqueued,
      running: this.runningIds.size,
      queued: this.queue.length,
    };
  }

  /** 在并发上限内尽量出队启动。 */
  drainQueue() {
    while (this.runningIds.size < this.maxConcurrent && this.queue.length > 0) {
      const pid = this.queue.shift();
      this.startRoutine(pid);
    }
  }

  /** 启动单个 AI routine（fire-and-forget；完成后释放并发位、续跑队列）。 */
  startRoutine(pid) {
    this.runningIds.add(pid);
    Promise.resolve()
      .then(() => this.runRoutine(pid))
      .catch((err) => {
        console.error(`${LOG} routine 异常 player=${pid}: ${err.message}`);
      })
      .finally(() => {
        this.runningIds.delete(pid);
        this.drainQueue();
      });
  }

  /** 测试/管理：清空内存计划（下一次 tick 重新规划）。 */
  resetForTests() {
    this.windowKey = null;
    this.plan = new Map();
    this.fired = new Set();
    this.queue = [];
  }
}

/**
 * 默认 AI id 加载：本服**在岗**（`ai_players.is_active = 1`）的 AI 账号。
 * 运维休眠开关：`UPDATE ai_players SET is_active = 0 ...` 即可让对应 AI 下一窗口起不再被调度（不删档）。
 */
async function defaultLoadAiPlayerIds() {
  const [rows] = await pool.query(
    `SELECT p.player_id
       FROM players p
       INNER JOIN accounts a ON a.id = p.player_id
       INNER JOIN ai_players ai ON ai.player_id = p.player_id
      WHERE a.account_type = 'ai' AND ai.is_active = 1`,
  );
  return rows.map((r) => String(r.player_id));
}

/**
 * 进程内活动调度器句柄（server.js 注册后 set；管理端 status 读其内存态）。
 * 仅用于展示（本窗口计划人数 / 在跑数 / 排队数），不承载业务真值。
 */
let activeScheduler = null;
function setActiveScheduler(s) {
  activeScheduler = s;
}
function getActiveScheduler() {
  return activeScheduler;
}

module.exports = {
  AiPlayerBehaviorScheduler,
  defaultLoadAiPlayerIds,
  windowStartMs,
  minuteIndexInWindow,
  pickSlotMinute,
  MS_PER_MINUTE,
  setActiveScheduler,
  getActiveScheduler,
};
