/**
 * 大司空日榜：temp_event_ranking + san_1_king_dasikong_daily
 * @see docs/40-ai/41-1-AI_KING_SYSTEM.md §日榜存储
 */

const { pool } = require('../database/connection');
const {
  GAME_CALENDAR_TZ,
  queryGameCalendarDateYmd,
  queryGameCalendarDateOffsetYmd,
} = require('../config/gameCalendar');
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
  reputation: `${STAT.repEarned} - COALESCE(snap.snapshot_reputation, 0)`,
  contribution: `${STAT.contribEarned} - COALESCE(snap.snapshot_contribution, 0)`,
};

/** 真人账号：注册写 account_type=real；历史 NULL/空串视同 real（排除 ai） */
const REAL_ACCOUNT_ACTIVE_SQL = `
  COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real'
  AND a.status = 'active'`;

/** 势力内真实活跃玩家（以 players 为驱动，statistics 可缺行） */
const REAL_PLAYERS_FROM = `
  FROM players p
  INNER JOIN accounts a ON a.id = p.player_id
    AND ${REAL_ACCOUNT_ACTIVE_SQL}
  LEFT JOIN player_statistics s ON s.player_id = p.player_id`;

const REAL_PLAYERS_FACTION_WHERE = `
  WHERE p.faction_id = ? AND p.player_id <> 'sys1'`;

/** INSERT … SELECT 等仅需 FROM+WHERE 的场景 */
const REAL_PLAYERS_IN_FACTION = `
  ${REAL_PLAYERS_FROM}
  ${REAL_PLAYERS_FACTION_WHERE}`;

/** 日榜 delta 查询：JOIN 必须在 WHERE 之前 */
const REAL_PLAYERS_WITH_SNAP_JOIN = `
  ${REAL_PLAYERS_FROM}
  LEFT JOIN temp_event_ranking snap
    ON snap.player_id = p.player_id AND snap.event_id = ?`;

function totalScoreSql() {
  const w = SCORE_WEIGHTS;
  return `(${DELTA.battle}) * ${w.battle}
        + (${DELTA.events}) * ${w.events}
        + (${DELTA.reputation}) * ${w.reputation}
        + (${DELTA.contribution}) * ${w.contribution}`;
}

/**
 * 势力今日是否已日切（以 MAX(baseline_date) 为准，避免个别脏行误判）
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function hasProcessedToday(connection, factionId, eventId = EVENT_ID) {
  const [rows] = await connection.query(
    `SELECT
       DATE_FORMAT(MAX(snap.baseline_date), '%Y-%m-%d') AS maxBaseline,
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS todayYmd
     FROM temp_event_ranking snap
     INNER JOIN players p ON p.player_id = snap.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real' AND a.status = 'active'
     WHERE snap.event_id = ? AND p.faction_id = ?`,
    [eventId, factionId],
  );
  const maxBaseline = rows[0]?.maxBaseline;
  const todayYmd = rows[0]?.todayYmd;
  return Boolean(maxBaseline && todayYmd && maxBaseline === todayYmd);
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function countFactionSnapshots(connection, factionId, eventId = EVENT_ID) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c FROM temp_event_ranking snap
     INNER JOIN players p ON p.player_id = snap.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real' AND a.status = 'active'
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
       frozen_delta_reputation = NULL,
       frozen_delta_contribution = NULL,
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
       (${DELTA.reputation}) AS delta_reputation,
       (${DELTA.contribution}) AS delta_contribution,
       (${scoreSql}) AS total_score
     ${REAL_PLAYERS_WITH_SNAP_JOIN}
     ${REAL_PLAYERS_FACTION_WHERE}
       AND (
         p.position_level IS NULL
         OR p.position_level > ?
         OR p.current_position_id = ?
       )
     ORDER BY total_score DESC,
       delta_battle DESC,
       delta_events DESC,
       delta_reputation DESC,
       delta_contribution DESC,
       p.player_id ASC
     LIMIT 1`,
    [eventId, factionId, DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL, DASIKONG_POSITION_ID],
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
     ${REAL_PLAYERS_WITH_SNAP_JOIN}
     ${REAL_PLAYERS_FACTION_WHERE}
     ORDER BY totalScore DESC, p.player_id ASC
     LIMIT ?`,
    [EVENT_ID, factionId, lim],
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
       AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real' AND a.status = 'active'
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
  return queryGameCalendarDateYmd(connection);
}

/** @returns {Promise<string|null>} 昨日 YYYY-MM-DD（东八区） */
async function getYesterdayYmd(connection) {
  return queryGameCalendarDateOffsetYmd(connection, 1);
}

/**
 * 漏跑 / 清表恢复：以 snapshot=0、baseline_date=指定日写入，供下一 step 用全量统计作「日增量」决选。
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function seedFactionZeroBaselines(connection, factionId, baselineDateYmd, eventId = EVENT_ID) {
  await connection.query(
    `INSERT INTO temp_event_ranking (
       event_id, player_id,
       snapshot_battle_score, snapshot_events_completed,
       snapshot_reputation, snapshot_contribution,
       snapshot_silver, snapshot_food,
       baseline_date, expires_at
     )
     SELECT ?, p.player_id,
       0, 0, 0, 0, 0, 0,
       ?, DATE_ADD(NOW(), INTERVAL 90 DAY)
     ${REAL_PLAYERS_IN_FACTION}
     ON DUPLICATE KEY UPDATE
       snapshot_battle_score = 0,
       snapshot_events_completed = 0,
       snapshot_reputation = 0,
       snapshot_contribution = 0,
       snapshot_silver = 0,
       snapshot_food = 0,
       baseline_date = VALUES(baseline_date),
       frozen_at = NULL,
       frozen_delta_battle = NULL,
       frozen_delta_events = NULL,
       frozen_delta_reputation = NULL,
       frozen_delta_contribution = NULL,
       frozen_delta_silver_food = NULL,
       expires_at = VALUES(expires_at)`,
    [eventId, baselineDateYmd, factionId],
  );
}

/**
 * 今日 baseline 已写入但日增量全 0、势力内确有统计活动 → 误走 recovery bootstrap 后的卡死态。
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function needsStuckZeroDeltaRecovery(connection, factionId, eventId = EVENT_ID) {
  if (!(await hasProcessedToday(connection, factionId, eventId))) return false;
  const winner = await pickDailyWinner(connection, factionId, eventId);
  if (Number(winner?.totalScore) > 0) return false;

  const [activeRows] = await connection.query(
    `SELECT COUNT(*) AS c
     ${REAL_PLAYERS_FROM}
     ${REAL_PLAYERS_FACTION_WHERE}
       AND (
         COALESCE(s.total_battle_score, 0) > 0
         OR COALESCE(s.total_events_completed, 0) > 0
         OR COALESCE(s.total_reputation_earned, 0) > 0
         OR COALESCE(s.total_contribution_earned, 0) > 0
       )`,
    [factionId],
  );
  if (Number(activeRows[0]?.c) === 0) return false;

  const [edictRows] = await connection.query(
    `SELECT 1 FROM faction_bulletins
     WHERE faction_id = ? AND category = 'edict' AND body LIKE '%大司空%'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
     LIMIT 1`,
    [factionId],
  );
  return edictRows.length === 0;
}

/** @param {import('mysql2/promise').PoolConnection} connection */
async function hasBaselineDateColumn(connection) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temp_event_ranking'
       AND COLUMN_NAME = 'baseline_date'
     LIMIT 1`,
  );
  return rows.length > 0;
}

/**
 * baseline 是否落后于服务器自然日（漏跑 0:00 tick 或未迁移 baseline_date）
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function isFactionBaselineStale(connection, factionId, eventId = EVENT_ID) {
  const snapCount = await countFactionSnapshots(connection, factionId, eventId);
  if (snapCount === 0) {
    const todayYmd = await getServerDateYmd(connection);
    return { stale: false, todayYmd, snapCount: 0, maxBaselineDate: null };
  }
  const [rows] = await connection.query(
    `SELECT
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS todayYmd,
       DATE_FORMAT(MAX(snap.baseline_date), '%Y-%m-%d') AS maxBaselineDate,
       DATE_FORMAT(MIN(snap.baseline_date), '%Y-%m-%d') AS minBaselineDate,
       SUM(CASE WHEN snap.baseline_date IS NULL THEN 1 ELSE 0 END) AS nullBaselineRows
     FROM temp_event_ranking snap
     INNER JOIN players p ON p.player_id = snap.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real' AND a.status = 'active'
     WHERE snap.event_id = ? AND p.faction_id = ?`,
    [eventId, factionId],
  );
  const todayYmd = rows[0]?.todayYmd || (await getServerDateYmd(connection));
  const maxBaselineDate = rows[0]?.maxBaselineDate || null;
  const stale = !maxBaselineDate || maxBaselineDate < todayYmd;
  return {
    stale,
    todayYmd,
    snapCount,
    maxBaselineDate,
    minBaselineDate: rows[0]?.minBaselineDate || null,
    nullBaselineRows: Number(rows[0]?.nullBaselineRows) || 0,
  };
}

/** @param {import('mysql2/promise').PoolConnection} connection */
async function getDasikongEnvironmentSnapshot(connection) {
  const [rows] = await connection.query(
    `SELECT
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS curdateYmd,
       NOW() AS nowTs,
       @@session.time_zone AS sessionTz,
       @@global.time_zone AS globalTz`,
  );
  return {
    curdateYmd: rows[0]?.curdateYmd,
    nowTs: rows[0]?.nowTs,
    mysqlSessionTz: rows[0]?.sessionTz,
    mysqlGlobalTz: rows[0]?.globalTz,
    cronTz: GAME_CALENDAR_TZ,
    nodeTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dbTimezoneEnv: process.env.DB_TIMEZONE || GAME_CALENDAR_TZ,
  };
}

/**
 * 势力大司空日榜诊断（生产只读探针 / admin 调试）
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} factionId
 */
async function getFactionDasikongDiagnostic(connection, factionId, eventId = EVENT_ID) {
  const env = await getDasikongEnvironmentSnapshot(connection);
  const staleInfo = await isFactionBaselineStale(connection, factionId, eventId);
  const processedToday = await hasProcessedToday(connection, factionId, eventId);
  const eligibleReal = await countEligibleRealPlayers(connection, factionId);
  const ranking = await listDailyActivityRanking(factionId, 5, connection);
  const winner = await pickDailyWinner(connection, factionId, eventId);

  const [missingSnapRows] = await connection.query(
    `SELECT COUNT(*) AS c
     ${REAL_PLAYERS_FROM}
     LEFT JOIN temp_event_ranking snap
       ON snap.player_id = p.player_id AND snap.event_id = ?
     ${REAL_PLAYERS_FACTION_WHERE}
       AND snap.player_id IS NULL`,
    [eventId, factionId],
  );

  const [topLeader] = await connection.query(
    `SELECT
       p.player_id,
       p.character_name,
       DATE_FORMAT(snap.baseline_date, '%Y-%m-%d') AS baselineDate,
       (${totalScoreSql()}) AS totalScore
     ${REAL_PLAYERS_WITH_SNAP_JOIN}
     ${REAL_PLAYERS_FACTION_WHERE}
     ORDER BY totalScore DESC
     LIMIT 1`,
    [eventId, factionId],
  );

  const [recentEdict] = await connection.query(
    `SELECT created_at, body FROM faction_bulletins
     WHERE faction_id = ? AND category = 'edict' AND body LIKE '%大司空%'
     ORDER BY created_at DESC LIMIT 1`,
    [factionId],
  );

  return {
    env,
    factionId,
    eventId,
    processedToday,
    eligibleReal,
    playersMissingSnap: Number(missingSnapRows[0]?.c) || 0,
    ranking,
    pickWinner: winner,
    topLeader: topLeader[0] || null,
    recentEdict: recentEdict[0] || null,
    ...staleInfo,
    interpretation: staleInfo.stale
      ? 'baseline 落后于 CURDATE()：0:00 tick 未成功或漏跑；日榜显示的是多日累计增量'
      : staleInfo.snapCount === 0 && eligibleReal > 0
        ? '尚无日榜 snapshot（0:00 未跑或 startup catch-up 未 bootstrap）；重启 backend 后应补建 baseline'
        : processedToday && (await needsStuckZeroDeltaRecovery(connection, factionId, eventId))
          ? '今日 baseline 已写但日增量为 0 且无近期任命；startup 应回卷昨日零基准后补决选'
          : processedToday
          ? '今日已日切（MAX baseline_date = CURDATE()）；日榜为今日增量'
          : 'baseline 已是今日但 processedToday=false，或 snap 数据异常，需看 min/max/nullBaselineRows',
  };
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
  getYesterdayYmd,
  seedFactionZeroBaselines,
  needsStuckZeroDeltaRecovery,
  hasBaselineDateColumn,
  isFactionBaselineStale,
  getDasikongEnvironmentSnapshot,
  getFactionDasikongDiagnostic,
  totalScoreSql,
};
