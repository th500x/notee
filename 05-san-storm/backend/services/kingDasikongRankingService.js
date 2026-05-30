/**
 * 大司空日榜：temp_event_ranking + san_1_king_dasikong_daily
 * @see docs/40-ai/41-1-AI_KING_SYSTEM.md §日榜存储
 */

const { pool } = require('../database/connection');
const {
  EVENT_ID,
  SCORE_WEIGHTS,
  DASIKONG_POSITION_ID,
  DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL,
} = require('../config/kingDasikongDaily');

const STAT = {
  battle: 'COALESCE(s.total_battle_score, 0)',
  events: 'COALESCE(s.total_events_completed, 0)',
  repEarned: 'COALESCE(s.total_reputation_earned, 0)',
  contribEarned: 'COALESCE(s.total_contribution_earned, 0)',
  silver: 'COALESCE(s.total_gold_earned, 0)',
  food: 'COALESCE(s.total_food_earned, 0)',
};

const DELTA = {
  battle: `${STAT.battle} - COALESCE(snap.snapshot_battle_score, 0)`,
  events: `${STAT.events} - COALESCE(snap.snapshot_events_completed, 0)`,
  rep: `(${STAT.repEarned} - COALESCE(snap.snapshot_reputation, 0)
        + ${STAT.contribEarned} - COALESCE(snap.snapshot_contribution, 0))`,
  sf: `(${STAT.silver} - COALESCE(snap.snapshot_silver, 0)
        + ${STAT.food} - COALESCE(snap.snapshot_food, 0))`,
};

/** 势力内真实活跃玩家（以 players 为驱动，statistics 可缺行） */
const REAL_PLAYERS_IN_FACTION = `
  FROM players p
  INNER JOIN accounts a ON a.id = p.player_id
    AND a.account_type = 'real'
    AND a.status = 'active'
  LEFT JOIN player_statistics s ON s.player_id = p.player_id
  WHERE p.faction_id = ? AND p.player_id <> 'sys1'
`;

function totalScoreSql() {
  const w = SCORE_WEIGHTS;
  return `(${DELTA.battle}) * ${w.battle}
        + (${DELTA.events}) * ${w.events}
        + (${DELTA.rep}) * ${w.rep}
        + (${DELTA.sf}) * ${w.sf}`;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function hasProcessedToday(connection, factionId, eventId = EVENT_ID) {
  const [rows] = await connection.query(
    `SELECT 1 FROM temp_event_ranking snap
     INNER JOIN players p ON p.player_id = snap.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND a.account_type = 'real' AND a.status = 'active'
     WHERE snap.event_id = ? AND p.faction_id = ? AND snap.baseline_date = CURDATE()
     LIMIT 1`,
    [eventId, factionId],
  );
  return rows.length > 0;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function countFactionSnapshots(connection, factionId, eventId = EVENT_ID) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c FROM temp_event_ranking snap
     INNER JOIN players p ON p.player_id = snap.player_id
     WHERE snap.event_id = ? AND p.faction_id = ?`,
    [eventId, factionId],
  );
  return Number(rows[0]?.c) || 0;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} baselineDateYmd 'YYYY-MM-DD'
 */
async function resetFactionBaselines(connection, factionId, baselineDateYmd, eventId = EVENT_ID) {
  await connection.query(
    `INSERT INTO temp_event_ranking (
       event_id, player_id,
       snapshot_battle_score, snapshot_events_completed,
       snapshot_reputation, snapshot_contribution,
       snapshot_silver, snapshot_food,
       baseline_date, expires_at
     )
     SELECT ?, p.player_id,
       ${STAT.battle}, ${STAT.events},
       ${STAT.repEarned}, ${STAT.contribEarned},
       ${STAT.silver}, ${STAT.food},
       ?, DATE_ADD(NOW(), INTERVAL 90 DAY)
     ${REAL_PLAYERS_IN_FACTION}
     ON DUPLICATE KEY UPDATE
       snapshot_battle_score = VALUES(snapshot_battle_score),
       snapshot_events_completed = VALUES(snapshot_events_completed),
       snapshot_reputation = VALUES(snapshot_reputation),
       snapshot_contribution = VALUES(snapshot_contribution),
       snapshot_silver = VALUES(snapshot_silver),
       snapshot_food = VALUES(snapshot_food),
       baseline_date = VALUES(baseline_date),
       frozen_at = NULL,
       frozen_delta_battle = NULL,
       frozen_delta_events = NULL,
       frozen_delta_rep_contrib = NULL,
       frozen_delta_silver_food = NULL,
       expires_at = VALUES(expires_at)`,
    [eventId, baselineDateYmd, factionId],
  );
}

/**
 * 决选上一自然日增量最高者（tie-break 见 41-1）
 * @param {import('mysql2/promise').PoolConnection} connection
 * @returns {Promise<{ playerId: string, characterName: string, totalScore: number } | null>}
 */
async function pickDailyWinner(connection, factionId, eventId = EVENT_ID) {
  const scoreSql = totalScoreSql();
  const [rows] = await connection.query(
    `SELECT
       p.player_id,
       p.character_name,
       (${DELTA.battle}) AS delta_battle,
       (${DELTA.events}) AS delta_events,
       (${DELTA.rep}) AS delta_rep_contrib,
       (${DELTA.sf}) AS delta_silver_food,
       (${scoreSql}) AS total_score
     ${REAL_PLAYERS_IN_FACTION}
       AND (
         p.position_level IS NULL
         OR p.position_level > ?
         OR p.current_position_id = ?
       )
     LEFT JOIN temp_event_ranking snap
       ON snap.player_id = p.player_id AND snap.event_id = ?
     ORDER BY total_score DESC,
       delta_battle DESC,
       delta_events DESC,
       delta_rep_contrib DESC,
       delta_silver_food DESC,
       p.player_id ASC
     LIMIT 1`,
    [factionId, DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL, DASIKONG_POSITION_ID, eventId],
  );
  const row = rows[0];
  if (!row?.player_id) return null;
  return {
    playerId: row.player_id,
    characterName: row.character_name || row.player_id,
    totalScore: Number(row.total_score) || 0,
  };
}

/**
 * 势力内日活跃榜（展示用，不含高官豁免过滤）
 * @param {string} factionId
 * @param {number} [limit=10]
 * @param {import('mysql2/promise').PoolConnection} [connection]
 */
async function listDailyActivityRanking(factionId, limit = 10, connection = null) {
  const lim = Math.max(1, Math.min(50, Number(limit) || 10));
  const scoreSql = totalScoreSql();
  const q = connection || pool;
  const [rows] = await q.query(
    `SELECT
       p.player_id AS playerId,
       p.character_name AS characterName,
       (${scoreSql}) AS totalScore
     ${REAL_PLAYERS_IN_FACTION}
     LEFT JOIN temp_event_ranking snap
       ON snap.player_id = p.player_id AND snap.event_id = ?
     ORDER BY totalScore DESC, p.player_id ASC
     LIMIT ?`,
    [factionId, EVENT_ID, lim],
  );
  return (rows || []).map((r, idx) => ({
    rank: idx + 1,
    playerId: r.playerId,
    characterName: r.characterName || r.playerId,
    totalScore: Math.max(0, Math.floor(Number(r.totalScore) || 0)),
  }));
}

/**
 * 势力是否已过「首日仅建基准」阶段（任一真实玩家角色创建于今日之前）
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function isFactionPastDasikongBootstrapDay(connection, factionId) {
  const [rows] = await connection.query(
    `SELECT 1 FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
       AND a.account_type = 'real' AND a.status = 'active'
     WHERE p.faction_id = ? AND p.player_id <> 'sys1'
       AND p.created_at < CURDATE()
     LIMIT 1`,
    [factionId],
  );
  return rows.length > 0;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function countEligibleRealPlayers(connection, factionId) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c
     ${REAL_PLAYERS_IN_FACTION}`,
    [factionId],
  );
  return Number(rows[0]?.c) || 0;
}

/** @returns {Promise<string>} YYYY-MM-DD */
async function getServerDateYmd(connection) {
  const [dr] = await connection.query('SELECT CURDATE() AS d');
  const d = dr[0]?.d;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

module.exports = {
  EVENT_ID,
  hasProcessedToday,
  countFactionSnapshots,
  countEligibleRealPlayers,
  isFactionPastDasikongBootstrapDay,
  resetFactionBaselines,
  pickDailyWinner,
  listDailyActivityRanking,
  getServerDateYmd,
  totalScoreSql,
};
