/**
 * PVP 战事临时政策服务（11-3 §4 / §5 / §6 · 实装段3）
 *
 * - **数据落点**：`wars_pvp_policies`（DDL 见 `create-wars-pvp-policies.sql`）
 * - **生命周期**：与所属 `wars_pvp` 行同生死；战事终局（completed / failed / cancelled）后 **不需要主动清理**，
 *   但读路径都以「`wars_pvp` 仍 active」为前置（`warPhaseService.getPhaseSnapshot` 已校验）。
 * - **审批口径（合意 · 2026-05-25）**：临时政策 **附属于战事提案**（一次 `proposalType='war'` AI 审批），
 *   不单独走 `evolution`；审批通过 → 同事务扣发动费 + 政策费 + 写本表；未通过 → 全不扣不创建。
 * - **价目（11-3 §4 · 固定价 · 不随档位/月倍率调整）**：
 *   - 前军 / 后军：各 300 银 + 1500 粮
 *   - 御驾亲征：500 银 + 2500 粮
 *
 * @module services/warPolicyTransientService
 * @see 11-3-FACTION_POLICY_SYSTEM.md §4、§5、§6、§7.1
 */

const { httpError } = require('../utils/httpError');
const factionReserveService = require('./factionReserveService');
const warPhaseService = require('./warPhaseService');

/**
 * 临时政策类目（与 `wars_pvp_policies` 列名 + `phase_snapshot_json` 键一致；
 * 前端 / API body 用 camelCase）。
 */
const TRANSIENT_POLICY_KEYS = Object.freeze(['frontAssault', 'rearAssault', 'imperialMarch']);

/**
 * 固定价目（11-3 §4 · 2026-05-25 定稿）。
 * 与发动战事费（`warInitiationCostService`，按城池档位×月倍率）合并扣，但本表 **不参与档位/倍率运算**。
 */
const POLICY_FEES = Object.freeze({
  frontAssault: { silver: 300, food: 1500 },
  rearAssault: { silver: 300, food: 1500 },
  imperialMarch: { silver: 500, food: 2500 },
});

/** 御驾亲征效果时长：墙钟 1h（11-3 §6） */
const IMPERIAL_MARCH_DURATION_MS = 60 * 60 * 1000;

/**
 * 规整 + 校验客户端传入的 `transientPolicies` 对象。
 * 容错：缺字段视为 false；非布尔 → 强转布尔。
 *
 * @param {object|null|undefined} input
 * @returns {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }}
 */
function normalizeTransientPolicies(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    frontAssault: !!src.frontAssault,
    rearAssault: !!src.rearAssault,
    imperialMarch: !!src.imperialMarch,
  };
}

/**
 * 加总开启的政策费（用于面板预览 / 储备校验展示）。
 *
 * @param {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }} normalized
 * @returns {{ silver: number, food: number, breakdown: Array<{ key: string, silver: number, food: number }> }}
 */
function computeTotalFees(normalized) {
  let silver = 0;
  let food = 0;
  const breakdown = [];
  for (const key of TRANSIENT_POLICY_KEYS) {
    if (normalized[key]) {
      const fee = POLICY_FEES[key];
      silver += fee.silver;
      food += fee.food;
      breakdown.push({ key, silver: fee.silver, food: fee.food });
    }
  }
  return { silver, food, breakdown };
}

/**
 * 校验政策组合是否合法（业务级 4xx）。
 *
 * 规则：
 * - **后军禁止开启条件（11-3 §5.3）**：含前军时 `T1 = T0+10min`，无前军 `T1 = T0+5min`；
 *   `T_end - T1 ≥ 60min` 时才允许 rearAssault。**当前** PVP 战事固定 24h，
 *   `T_end - T1` 最小 = 23h50min，远大于 1h — 测试阶段实际不会触发；保留校验以防未来缩短战事时长。
 *
 * @param {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }} normalized
 * @param {Date|number} t0
 * @param {Date|number} tEnd
 * @throws HttpError(400, ...)
 */
function validateTransientPolicies(normalized, t0, tEnd) {
  if (normalized.rearAssault) {
    const t1 = warPhaseService.computeT1(t0, normalized);
    if (!warPhaseService.canEnableRearAssault(t1, tEnd)) {
      throw httpError(
        400,
        '本场战事剩余时长不足 1 小时，不可开启「后军突击」（与战事强制收束竞态）',
        'REAR_ASSAULT_NOT_ALLOWED',
      );
    }
  }
}

/**
 * 同事务内扣临时政策费（先于 `warInitiationCostService.assertAndDeductInTransaction` 调用顺序无所谓，
 * 但应**同一事务**；任一失败回滚整事务、政策不写入、战事不激活）。
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }} normalized
 * @returns {Promise<{ silver: number, food: number, breakdown: Array<object> }>} 实际扣费金额
 */
async function assertAndDeductPolicyFeesInTransaction(conn, factionId, normalized) {
  const fid = String(factionId || '').trim();
  if (!fid) throw new Error('[warPolicyTransient] 缺少 factionId');
  const total = computeTotalFees(normalized);
  if (total.silver === 0 && total.food === 0) {
    // 全部 OFF：跳过 SELECT FOR UPDATE / UPDATE，避免无谓行锁
    return total;
  }
  try {
    await factionReserveService.deductPoolOnConnection(
      conn,
      fid,
      { silver: total.silver, food: total.food },
      { errorPrefix: '[warPolicyTransient] 攻方势力', errorCode: 'INSUFFICIENT_FACTION_RESERVES_FOR_POLICIES' },
    );
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FACTION_RESERVES_FOR_POLICIES' && e.details) {
      const rs = e.details.reserveSilver;
      const rf = e.details.reserveFood;
      throw httpError(
        400,
        `势力银粮储备不足以支付临时政策费用（需 ${total.silver} 银、${total.food} 粮；当前储备 ${rs} 银、${rf} 粮）`,
        'INSUFFICIENT_FACTION_RESERVES_FOR_POLICIES',
      );
    }
    throw e;
  }
  await factionReserveService.addUsageOnConnection(
    conn,
    fid,
    factionReserveService.CATEGORY.WAR_START,
    { silver: total.silver, food: total.food },
  );
  return total;
}

/**
 * 写 `wars_pvp_policies` 行（含 phase_snapshot）。
 * 调用方应在同事务内 + 已扣费 + 已激活 `wars_pvp.status='active'` 之后调。
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} pvpWarId
 * @param {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }} normalized
 * @param {Date} t0
 * @param {Date} tEnd
 * @param {{ silver: number, food: number, breakdown: Array<object> }} feesPaid
 * @returns {Promise<{ pvpWarId: string, phaseSnapshot: object, imperialMarchExpiresAt: Date|null }>}
 */
async function writePoliciesAndSnapshot(conn, pvpWarId, normalized, t0, tEnd, feesPaid) {
  const phaseSnapshot = warPhaseService.buildPhaseSnapshot(t0, tEnd, normalized);
  const imperialMarchExpiresAt = normalized.imperialMarch
    ? new Date(t0.getTime() + IMPERIAL_MARCH_DURATION_MS)
    : null;
  await conn.query(
    `INSERT INTO wars_pvp_policies
       (pvp_war_id, front_assault_enabled, rear_assault_enabled, imperial_march_enabled,
        config_json, fees_deducted_json, phase_snapshot_json, imperial_march_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        front_assault_enabled = VALUES(front_assault_enabled),
        rear_assault_enabled = VALUES(rear_assault_enabled),
        imperial_march_enabled = VALUES(imperial_march_enabled),
        config_json = VALUES(config_json),
        fees_deducted_json = VALUES(fees_deducted_json),
        phase_snapshot_json = VALUES(phase_snapshot_json),
        imperial_march_expires_at = VALUES(imperial_march_expires_at)`,
    [
      pvpWarId,
      normalized.frontAssault ? 1 : 0,
      normalized.rearAssault ? 1 : 0,
      normalized.imperialMarch ? 1 : 0,
      JSON.stringify({
        frontAssault: normalized.frontAssault,
        rearAssault: normalized.rearAssault,
        imperialMarch: normalized.imperialMarch,
      }),
      JSON.stringify(feesPaid),
      JSON.stringify(phaseSnapshot),
      imperialMarchExpiresAt,
    ],
  );
  return { pvpWarId, phaseSnapshot, imperialMarchExpiresAt };
}

/**
 * 读单场 PVP 战事的临时政策行（pool 直接读，不走事务）。
 *
 * @param {string} pvpWarId
 * @returns {Promise<null | {
 *   pvpWarId: string,
 *   frontAssault: boolean,
 *   rearAssault: boolean,
 *   imperialMarch: boolean,
 *   configJson: object|null,
 *   feesDeductedJson: object|null,
 *   phaseSnapshotJson: object|null,
 *   imperialMarchExpiresAt: Date|null,
 *   createdAt: Date,
 *   revokedAt: Date|null,
 * }>}
 */
async function getPoliciesForWar(pvpWarId) {
  const { pool } = require('../database/connection');
  const [rows] = await pool.query(
    `SELECT pvp_war_id, front_assault_enabled, rear_assault_enabled, imperial_march_enabled,
            config_json, fees_deducted_json, phase_snapshot_json,
            imperial_march_expires_at, created_at, revoked_at
       FROM wars_pvp_policies WHERE pvp_war_id = ? LIMIT 1`,
    [pvpWarId],
  );
  const row = rows[0];
  if (!row) return null;
  /** 兼容 MySQL 8 / MariaDB：JSON 列读出来已是对象；旧版本可能为字符串。 */
  const parseJson = (v) => {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
  };
  return {
    pvpWarId: row.pvp_war_id,
    frontAssault: !!row.front_assault_enabled,
    rearAssault: !!row.rear_assault_enabled,
    imperialMarch: !!row.imperial_march_enabled,
    configJson: parseJson(row.config_json),
    feesDeductedJson: parseJson(row.fees_deducted_json),
    phaseSnapshotJson: parseJson(row.phase_snapshot_json),
    imperialMarchExpiresAt: row.imperial_march_expires_at || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

module.exports = {
  TRANSIENT_POLICY_KEYS,
  POLICY_FEES,
  IMPERIAL_MARCH_DURATION_MS,
  normalizeTransientPolicies,
  computeTotalFees,
  validateTransientPolicies,
  assertAndDeductPolicyFeesInTransaction,
  writePoliciesAndSnapshot,
  getPoliciesForWar,
};
