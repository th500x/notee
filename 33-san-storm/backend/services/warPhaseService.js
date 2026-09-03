/**
 * 战事阶段服务（11-3 §5 · 临时政策阶段机）
 *
 * - **阶段定义（合意 · 2026-05-25）**：
 *   - **通知期** `[T0, T0+5min)` — 任何攻城禁止（让玩家看到「战事已开 / 5 分钟筹备」）
 *   - **前军期** `[T0+5min, T0+10min)` — **若启用前军政策** 才存在；该窗内仅 AI 征发军团对 NPC/驻地行动；**玩家攻城禁止**
 *   - **中军期** 从 `T0+10min`（启用前军）或 `T0+5min`（未启用前军）开始，到 `T_end` 或后军窗起点 — **玩家自由攻城阶段**
 *   - **后军窗** `[H:00, H:05)` — **若启用后军政策** 才存在；该窗内仅 AI 后军行动；**玩家攻城禁止**（方案 A 保守 · 11-3 §5.3）
 *   - **后军窗后** 自动回到中军期，直到 `T_end`
 *
 * - **后军窗计算（11-3 §5.3）**：令 `T1 = T0 + 10min`（含前军，无前军则 `T0 + 5min`），
 *   取 **严格大于 `T1` 的第一个整点 H:00**；若 `T1` 恰为 `HH:00:00` 也要顺延到下一整点（避免零长度窗）。
 *   `H:05 <= T_end` 才允许开启后军（否则提案时即置灰 / 拒收）。
 *
 * **单点读约束**：阶段 / 攻城门禁 **只走** 本服务；`pvpService` / 攻城路由 / `tickActivePvpWars`
 * 均通过 `getPhaseSnapshot` + `assertPlayerSiegeAllowed` 决策，禁止散写比较 now 与 T0+5min。
 *
 * @module services/warPhaseService
 * @see 11-3-FACTION_POLICY_SYSTEM.md §5、§5.3、§5.5.2
 */

const { httpError } = require('../utils/httpError');

/** 阶段枚举 — 与 `wars_pvp_policies.phase_snapshot_json.phases` 标签一致 */
const PHASE = Object.freeze({
  /** 战事尚未激活（PENDING / 草案 / 已结束）— 调用方应在 active 时才走本服务 */
  NOT_ACTIVE: 'not_active',
  /** 通知期 [T0, T0+5min) */
  NOTIFY: 'notify',
  /** 前军期 [T0+5min, T1)（仅当启用前军） */
  FRONT_ARMY: 'front_army',
  /** 中军期（玩家自由攻城） */
  MID_ARMY: 'mid_army',
  /** 后军窗 [H:00, H:05)（仅当启用后军） */
  REAR_ARMY: 'rear_army',
  /** 战事到点 / 已结束 */
  ENDED: 'ended',
});

const FIVE_MIN_MS = 5 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 后军窗时长（11-3 §5.3：H:00～H:05） */
const REAR_WINDOW_DURATION_MS = FIVE_MIN_MS;

/**
 * 计算后军窗起点：严格大于 `T1` 的第一个整点 `H:00`。
 * 若 `T1` 已是 HH:00:00（毫秒/秒/分皆为 0）也顺延到 `(H+1):00`，避免零长度窗。
 *
 * @param {Date|number} t1Input
 * @returns {Date}
 */
function computeRearWindowStart(t1Input) {
  const t1 = t1Input instanceof Date ? t1Input.getTime() : Number(t1Input);
  if (!Number.isFinite(t1)) throw new Error('[warPhase] computeRearWindowStart: 非法 T1');
  const d = new Date(t1);
  const isExactHour =
    d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
  const next = new Date(d);
  next.setMilliseconds(0);
  next.setSeconds(0);
  next.setMinutes(0);
  if (isExactHour) {
    // 严格大于：当 T1 恰为整点也顺延到下一整点
    next.setHours(next.getHours() + 1);
  } else {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

/**
 * 根据政策开关计算 `T1`（前/后军/中军切换点）：含前军 = T0+10min；不含前军 = T0+5min。
 *
 * @param {Date|number} t0Input
 * @param {{ frontAssault?: boolean }} policies
 * @returns {Date}
 */
function computeT1(t0Input, policies) {
  const t0 = t0Input instanceof Date ? t0Input.getTime() : Number(t0Input);
  if (!Number.isFinite(t0)) throw new Error('[warPhase] computeT1: 非法 T0');
  const delta = policies && policies.frontAssault ? TEN_MIN_MS : FIVE_MIN_MS;
  return new Date(t0 + delta);
}

/**
 * 是否允许启用后军（11-3 §5.3 · `T_end - T1 ≥ 60min`）。
 *
 * @param {Date|number} t1Input
 * @param {Date|number} tEndInput
 * @returns {boolean}
 */
function canEnableRearAssault(t1Input, tEndInput) {
  const t1 = t1Input instanceof Date ? t1Input.getTime() : Number(t1Input);
  const tEnd = tEndInput instanceof Date ? tEndInput.getTime() : Number(tEndInput);
  if (!Number.isFinite(t1) || !Number.isFinite(tEnd)) return false;
  return tEnd - t1 >= ONE_HOUR_MS;
}

/**
 * 计算当前所处阶段；用于攻城门禁、UI 浮层、tick 调度。
 *
 * @param {{ status: string, startTime?: Date|string|null, endTime?: Date|string|null }} war
 * @param {{ frontAssault?: boolean, rearAssault?: boolean }} [policies] - 来自 `wars_pvp_policies`
 * @param {Date|number} [nowInput] - 默认 now
 * @returns {{
 *   phase: string,
 *   t0?: Date, t1?: Date, midArmyAt?: Date, tEnd?: Date,
 *   rearWindow?: { start: Date, end: Date } | null,
 *   playerSiegeAllowed: boolean,
 *   reason?: string,
 * }}
 */
function getPhaseSnapshot(war, policies, nowInput) {
  const now = nowInput instanceof Date ? nowInput.getTime() : (Number(nowInput) || Date.now());
  if (!war || war.status !== 'active' || !war.startTime || !war.endTime) {
    return {
      phase: PHASE.NOT_ACTIVE,
      playerSiegeAllowed: false,
      reason: '战事未激活',
    };
  }
  const t0 = new Date(war.startTime);
  const tEnd = new Date(war.endTime);
  if (now >= tEnd.getTime()) {
    return {
      phase: PHASE.ENDED,
      t0, tEnd,
      playerSiegeAllowed: false,
      reason: '战事已到期',
    };
  }

  const eff = policies || {};
  const t1 = computeT1(t0, eff);
  const midArmyAt = t1;

  // 通知期
  if (now < t0.getTime() + FIVE_MIN_MS) {
    return {
      phase: PHASE.NOTIFY,
      t0, t1, midArmyAt, tEnd,
      rearWindow: null,
      playerSiegeAllowed: false,
      reason: '战事处于通知期（开战后 5 分钟筹备），暂不可攻城',
    };
  }
  // 前军期（仅当启用前军）
  if (eff.frontAssault && now < t1.getTime()) {
    return {
      phase: PHASE.FRONT_ARMY,
      t0, t1, midArmyAt, tEnd,
      rearWindow: null,
      playerSiegeAllowed: false,
      reason: '战事处于前军期（征发军团行动），玩家暂不可攻城',
    };
  }

  // 计算后军窗（若启用且 T_end - T1 >= 60min）
  let rearWindow = null;
  if (eff.rearAssault && canEnableRearAssault(t1, tEnd)) {
    const rwStart = computeRearWindowStart(t1);
    const rwEnd = new Date(rwStart.getTime() + REAR_WINDOW_DURATION_MS);
    if (rwEnd.getTime() <= tEnd.getTime()) {
      rearWindow = { start: rwStart, end: rwEnd };
    }
  }

  // 后军窗内
  if (rearWindow && now >= rearWindow.start.getTime() && now < rearWindow.end.getTime()) {
    return {
      phase: PHASE.REAR_ARMY,
      t0, t1, midArmyAt, tEnd,
      rearWindow,
      playerSiegeAllowed: false,
      reason: '战事处于后军窗（征发军团行动），玩家暂不可攻城',
    };
  }

  // 否则为中军期
  return {
    phase: PHASE.MID_ARMY,
    t0, t1, midArmyAt, tEnd,
    rearWindow,
    playerSiegeAllowed: true,
  };
}

/**
 * 玩家攻城入口门禁：通知 / 前军 / 后军窗 期间禁止玩家发起对该战事目标城的攻城（含披挂 PVP 与 NPC/驻地战）。
 *
 * @param {object} war - WarPvp 行（formatted）
 * @param {object|null|undefined} policies - 来自 `wars_pvp_policies` 行；可为 null（无临时政策）
 * @param {Date|number} [nowInput]
 * @throws HttpError(409, reason, 'WAR_PHASE_FORBIDDEN')
 */
function assertPlayerSiegeAllowed(war, policies, nowInput) {
  const snap = getPhaseSnapshot(war, policies, nowInput);
  if (!snap.playerSiegeAllowed) {
    const err = httpError(
      409,
      snap.reason || '当前战事阶段不允许玩家攻城',
      'WAR_PHASE_FORBIDDEN',
    );
    err.details = { phase: snap.phase };
    throw err;
  }
}

/**
 * 构建 T0 冻结的 phase snapshot JSON（写入 `wars_pvp_policies.phase_snapshot_json`）。
 * 仅落地"骨架信息"；前/后军剩余配额由 `aiConscriptLegionService` 在调度时维护，
 * 但 **初值** 在此一次性写好（M=20）。
 *
 * @param {Date} t0
 * @param {Date} tEnd
 * @param {{ frontAssault?: boolean, rearAssault?: boolean, imperialMarch?: boolean }} policies
 * @returns {object}
 */
function buildPhaseSnapshot(t0, tEnd, policies) {
  const eff = policies || {};
  const t1 = computeT1(t0, eff);
  const midArmyAt = t1;
  let rearWindow = null;
  if (eff.rearAssault && canEnableRearAssault(t1, tEnd)) {
    const rwStart = computeRearWindowStart(t1);
    const rwEnd = new Date(rwStart.getTime() + REAR_WINDOW_DURATION_MS);
    if (rwEnd.getTime() <= tEnd.getTime()) {
      rearWindow = { start: rwStart.toISOString(), end: rwEnd.toISOString() };
    }
  }
  return {
    t0: t0.toISOString(),
    t1: t1.toISOString(),
    midArmyAt: midArmyAt.toISOString(),
    tEnd: tEnd.toISOString(),
    rearWindow,
    /** M=20，K 取消（11-3 §5.5.2 修订 2026-05-25） */
    frontAssault: eff.frontAssault
      ? { quotaTotal: 20, quotaRemaining: 20, stopped: false }
      : null,
    rearAssault: eff.rearAssault && rearWindow
      ? { quotaTotal: 20, quotaRemaining: 20, stopped: false }
      : null,
    /** 御驾 1h 由路由写 `imperial_march_expires_at` 列；snapshot 仅记录开关 */
    imperialMarch: eff.imperialMarch ? { enabled: true } : null,
  };
}

module.exports = {
  PHASE,
  REAR_WINDOW_DURATION_MS,
  FIVE_MIN_MS,
  TEN_MIN_MS,
  ONE_HOUR_MS,
  ONE_DAY_MS,
  computeT1,
  computeRearWindowStart,
  canEnableRearAssault,
  getPhaseSnapshot,
  assertPlayerSiegeAllowed,
  buildPhaseSnapshot,
};
