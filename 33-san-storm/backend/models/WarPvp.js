/**
 * PVP 势力战事数据模型（17-2 · wars_pvp）
 *
 * 表结构权威：`backend/database/migrations/create-wars-pvp-table.sql`
 * 文档：`docs/01-jun-exploration/10-core-system/17-3-WAR_SYSTEM.md` §9.2
 *
 * 命名：DB snake_case，前端 camelCase；仅在本模型 / 服务层做转换，
 *      路由层一律消费 camelCase（与 17-2 实现计划 §6 阶段 1 D2 任务对齐）。
 *
 * @module models/WarPvp
 */

const { pool } = require('../database/connection');

const WAR_PVP_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const WAR_PVP_VICTORY_CONDITIONS = Object.freeze({
  CAPTURE_CITY: 'capture_city',
  ELIMINATE_BASE_CAMP: 'eliminate_attacker_base_camp',
  HOLD_CITY: 'hold_city',
  /** @deprecated 旧 break_morale；新战事用 WAR_MORALE_RACE */
  BREAK_MORALE: 'break_morale',
  WAR_MORALE_RACE: 'war_morale_race',
  TIMEOUT: 'timeout',
});

const SETTLEMENT_PHASE = Object.freeze({
  NONE: 'none',
  PLACEHOLDER: 'placeholder',
  FINAL: 'final',
});

function parseJsonOrNull(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * snake_case 行 → camelCase 领域对象。
 * 服务 / 路由 / 前端的「读路径」一律消费此结构，避免散装 snake。
 *
 * @param {object} row
 * @returns {object | null}
 */
function formatPvpWarRow(row) {
  if (!row) return null;
  return {
    pvpWarId: row.pvp_war_id,
    season: row.season,
    serverId: row.server_id || null,
    warName: row.war_name,
    warType: row.war_type,
    targetCityId: row.target_city_id,
    targetCityName: row.target_city_name,
    attackerFactionId: row.attacker_faction_id,
    attackerFactionName: row.attacker_faction_name || null,
    defenderFactionId: row.defender_faction_id,
    defenderFactionName: row.defender_faction_name || null,
    attackerWarMorale:
      row.attacker_war_morale != null ? Number(row.attacker_war_morale) : null,
    defenderWarMorale:
      row.defender_war_morale != null ? Number(row.defender_war_morale) : null,
    status: row.status,
    winnerFactionId: row.winner_faction_id || null,
    victoryCondition: row.victory_condition || null,
    baseCamp: parseJsonOrNull(row.base_camp),
    sideStats: parseJsonOrNull(row.side_stats),
    duelHistory: parseJsonOrNull(row.duel_history),
    startTime: row.start_time || null,
    endTime: row.end_time || null,
    settledAt: row.settled_at || null,
    settlementPhase: row.settlement_phase || SETTLEMENT_PHASE.NONE,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**
 * 生成下一个 PVP 战事 ID：`san_{season}_war_{4位}`。
 * 与 PVE 表 `wars` 的随机 ID 不同（17-2 §1.1）。
 *
 * @param {string} season - 如 san_1
 * @param {object} [conn] - 可选事务连接
 */
async function generateNextPvpWarId(season, conn = null) {
  const runner = conn || pool;
  const sNum = String(season || 'san_1').replace(/^san_/, '');
  const prefix = `san_${sNum}_war_`;
  const [rows] = await runner.query(
    'SELECT pvp_war_id FROM wars_pvp WHERE pvp_war_id LIKE ? ORDER BY pvp_war_id DESC LIMIT 1',
    [`${prefix}%`],
  );
  let next = 1;
  if (rows.length) {
    const tail = rows[0].pvp_war_id.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/** 单行查询 + 解析 */
async function getById(pvpWarId, conn = null) {
  const runner = conn || pool;
  const [rows] = await runner.query('SELECT * FROM wars_pvp WHERE pvp_war_id = ?', [pvpWarId]);
  if (!rows.length) return null;
  return formatPvpWarRow(rows[0]);
}

/**
 * 同城仅一场进行中战事（17-2 §1.4 同城规则；约束在应用层而非 DB unique）。
 * @returns {Promise<object|null>}
 */
async function getActiveByCity(targetCityId, conn = null) {
  const runner = conn || pool;
  const [rows] = await runner.query(
    "SELECT * FROM wars_pvp WHERE target_city_id = ? AND status IN ('pending','active') ORDER BY created_at DESC LIMIT 1",
    [targetCityId],
  );
  if (!rows.length) return null;
  return formatPvpWarRow(rows[0]);
}

/**
 * 列表查询（默认按创建时间倒序）。
 * @param {{ status?: string|string[], factionId?: string, attackerFactionId?: string, season?: string, limit?: number }} filters
 */
async function listWars(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status) {
    const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
    where.push(`status IN (${arr.map(() => '?').join(',')})`);
    params.push(...arr);
  }
  if (filters.factionId) {
    where.push('(attacker_faction_id = ? OR defender_faction_id = ?)');
    params.push(filters.factionId, filters.factionId);
  }
  if (filters.attackerFactionId) {
    where.push('attacker_faction_id = ?');
    params.push(filters.attackerFactionId);
  }
  if (filters.season) {
    where.push('season = ?');
    params.push(filters.season);
  }
  const limit = Math.max(1, Math.min(200, Number(filters.limit) || 50));
  const sql = `SELECT * FROM wars_pvp ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${limit}`;
  const [rows] = await pool.query(sql, params);
  return rows.map(formatPvpWarRow);
}

/**
 * 攻方势力当前进行中的 PVP 战事条数（pending + active）。
 * 用于「每势力同时最多 N 场」上限（17-2 M2 工程约束）。
 *
 * @param {string} attackerFactionId
 * @param {object} [conn]
 * @returns {Promise<number>}
 */
async function countActiveOrPendingByAttackerFaction(attackerFactionId, conn = null) {
  const runner = conn || pool;
  const [rows] = await runner.query(
    "SELECT COUNT(*) AS c FROM wars_pvp WHERE attacker_faction_id = ? AND status IN ('pending','active')",
    [attackerFactionId],
  );
  return Number(rows[0]?.c || 0);
}

/**
 * 插入新战事；调用方负责构造完整字段（`pvpWarService.createPvpWarDraft` 等）。
 */
async function insertPvpWar(record, conn = null) {
  const runner = conn || pool;
  const baseCamp = record.baseCamp != null ? JSON.stringify(record.baseCamp) : null;
  const sideStats = record.sideStats != null ? JSON.stringify(record.sideStats) : null;
  const duelHistory = record.duelHistory != null ? JSON.stringify(record.duelHistory) : null;
  await runner.query(
    `INSERT INTO wars_pvp (
       pvp_war_id, season, server_id, war_name, war_type,
       target_city_id, target_city_name,
       attacker_faction_id, attacker_faction_name,
       defender_faction_id, defender_faction_name,
       attacker_war_morale, defender_war_morale,
       status, winner_faction_id, victory_condition,
       base_camp, side_stats, duel_history,
       start_time, end_time, settled_at, settlement_phase
     ) VALUES (
       ?, ?, ?, ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?
     )`,
    [
      record.pvpWarId,
      record.season,
      record.serverId || null,
      record.warName,
      record.warType || 'siege',
      record.targetCityId,
      record.targetCityName,
      record.attackerFactionId,
      record.attackerFactionName || null,
      record.defenderFactionId,
      record.defenderFactionName || null,
      record.attackerWarMorale != null && Number.isFinite(record.attackerWarMorale)
        ? record.attackerWarMorale
        : null,
      record.defenderWarMorale != null && Number.isFinite(record.defenderWarMorale)
        ? record.defenderWarMorale
        : null,
      record.status || WAR_PVP_STATUS.PENDING,
      record.winnerFactionId || null,
      record.victoryCondition || null,
      baseCamp,
      sideStats,
      duelHistory,
      record.startTime || null,
      record.endTime || null,
      record.settledAt || null,
      record.settlementPhase || SETTLEMENT_PHASE.NONE,
    ],
  );
}

/**
 * 通用更新（白名单字段）。
 * @param {string} pvpWarId
 * @param {Partial<object>} patch - camelCase 字段
 * @param {object} [conn]
 */
async function updatePvpWar(pvpWarId, patch, conn = null) {
  const runner = conn || pool;
  const fields = [];
  const params = [];
  const map = {
    warName: 'war_name',
    status: 'status',
    attackerWarMorale: 'attacker_war_morale',
    defenderWarMorale: 'defender_war_morale',
    winnerFactionId: 'winner_faction_id',
    victoryCondition: 'victory_condition',
    startTime: 'start_time',
    endTime: 'end_time',
    settledAt: 'settled_at',
    settlementPhase: 'settlement_phase',
  };
  for (const [camel, snake] of Object.entries(map)) {
    if (patch[camel] !== undefined) {
      fields.push(`${snake} = ?`);
      params.push(patch[camel]);
    }
  }
  if (patch.baseCamp !== undefined) {
    fields.push('base_camp = ?');
    params.push(patch.baseCamp == null ? null : JSON.stringify(patch.baseCamp));
  }
  if (patch.sideStats !== undefined) {
    fields.push('side_stats = ?');
    params.push(patch.sideStats == null ? null : JSON.stringify(patch.sideStats));
  }
  if (patch.duelHistory !== undefined) {
    fields.push('duel_history = ?');
    params.push(patch.duelHistory == null ? null : JSON.stringify(patch.duelHistory));
  }
  if (!fields.length) return;
  params.push(pvpWarId);
  await runner.query(`UPDATE wars_pvp SET ${fields.join(', ')} WHERE pvp_war_id = ?`, params);
}

module.exports = {
  WAR_PVP_STATUS,
  WAR_PVP_VICTORY_CONDITIONS,
  SETTLEMENT_PHASE,
  formatPvpWarRow,
  generateNextPvpWarId,
  getById,
  getActiveByCity,
  listWars,
  countActiveOrPendingByAttackerFaction,
  insertPvpWar,
  updatePvpWar,
};
