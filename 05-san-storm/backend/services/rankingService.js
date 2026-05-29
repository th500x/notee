/**
 * 活动排行榜服务
 * 排行榜数据查询、快照补建、积分冻结均在此处理；路由层只做 HTTP 映射。
 *
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md §4（活动榜）
 * @see docs/10-core-system/18-4-RANKING_SYSTEM.md（常驻榜）
 * @see docs/00-base/01-database-split/60-tables-other.md §6 temp_event_ranking
 * @module backend/services/rankingService
 */

const { pool } = require('../database/connection');
const ACTIVITY_RANKING_EVENTS = require('../config/activityRankingEvents');
const campaignService = require('./campaignService');

/** 常驻总体榜：最低战斗场次（与 18-4 一致） */
const OVERALL_MIN_BATTLES = 10;
const OVERALL_DEFAULT_LIMIT = 30;
const OVERALL_MAX_LIMIT = 50;
const CAMPAIGN_DEFAULT_LIMIT = 30;
const CAMPAIGN_MAX_LIMIT = 50;

/** SQL 表达式：场均战后分（与 18-4、getOverallRankings 列表一致） */
const OVERALL_AVG_EXPR = 'ROUND(s.total_battle_score / s.total_battles)';

/**
 * 道具「黄巾徽章」持有量：`players.items` JSON 中 `item_season_badge`（与 `docs/tools/item/item-template.csv`、config_items 一致）
 */
const YELLOW_TURBAN_BADGE_ITEM_ID = 'item_season_badge';
const OVERALL_BADGE_COUNT_EXPR = `COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(p.items, '$.${YELLOW_TURBAN_BADGE_ITEM_ID}')) AS UNSIGNED), 0)`;

/**
 * @param {string} [raw]
 * @returns {'avg'|'wins'|'reputation'|'events'}
 */
function normalizeOverallSortKey(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'wins' || s === 'win') return 'wins';
  if (s === 'reputation' || s === 'rep') return 'reputation';
  if (s === 'badges' || s === 'badge' || s === 'events' || s === 'event') return 'events';
  if (s === 'avg' || s === 'average' || s === 'avg_battle_score' || s === 'avgbattlescore') return 'avg';
  return 'avg';
}

const OVERALL_ORDER_BY = {
  avg: `${OVERALL_AVG_EXPR} DESC, s.wins DESC, p.reputation DESC, ${OVERALL_BADGE_COUNT_EXPR} DESC, p.player_id ASC`,
  wins: `s.wins DESC, ${OVERALL_AVG_EXPR} DESC, p.reputation DESC, ${OVERALL_BADGE_COUNT_EXPR} DESC, p.player_id ASC`,
  reputation: `p.reputation DESC, ${OVERALL_AVG_EXPR} DESC, s.wins DESC, ${OVERALL_BADGE_COUNT_EXPR} DESC, p.player_id ASC`,
  events: `${OVERALL_BADGE_COUNT_EXPR} DESC, ${OVERALL_AVG_EXPR} DESC, s.wins DESC, p.reputation DESC, p.player_id ASC`,
};

/**
 * 统计「排序优于当前玩家」的入榜人数（total_battles >= minBattles）
 * @param {import('mysql2/promise').Pool} poolRef
 */
async function countOverallPlayersAbove(poolRef, {
  serverId,
  minBattles,
  sortKey,
  avg,
  wins,
  reputation,
  eventsCompleted,
  playerId,
}) {
  const R = OVERALL_AVG_EXPR;
  const B = OVERALL_BADGE_COUNT_EXPR;
  const base = `
    FROM player_statistics s
    INNER JOIN players p ON p.player_id = s.player_id
    INNER JOIN accounts a ON a.id = p.player_id
      AND a.serverId = ?
      AND a.account_type = 'real'
      AND a.status = 'active'
    WHERE s.total_battles >= ? AND `;

  let cond;
  let rest;
  switch (sortKey) {
    case 'wins':
      cond = `(s.wins > ? OR (s.wins = ? AND ${R} > ?) OR (s.wins = ? AND ${R} = ? AND p.reputation > ?) OR (s.wins = ? AND ${R} = ? AND p.reputation = ? AND ${B} > ?) OR (s.wins = ? AND ${R} = ? AND p.reputation = ? AND ${B} = ? AND p.player_id < ?))`;
      rest = [wins, wins, avg, wins, avg, reputation, wins, avg, reputation, eventsCompleted, wins, avg, reputation, eventsCompleted, playerId];
      break;
    case 'reputation':
      cond = `(p.reputation > ? OR (p.reputation = ? AND ${R} > ?) OR (p.reputation = ? AND ${R} = ? AND s.wins > ?) OR (p.reputation = ? AND ${R} = ? AND s.wins = ? AND ${B} > ?) OR (p.reputation = ? AND ${R} = ? AND s.wins = ? AND ${B} = ? AND p.player_id < ?))`;
      rest = [reputation, reputation, avg, reputation, avg, wins, reputation, avg, wins, eventsCompleted, reputation, avg, wins, eventsCompleted, playerId];
      break;
    case 'events':
      cond = `(${B} > ? OR (${B} = ? AND ${R} > ?) OR (${B} = ? AND ${R} = ? AND s.wins > ?) OR (${B} = ? AND ${R} = ? AND s.wins = ? AND p.reputation > ?) OR (${B} = ? AND ${R} = ? AND s.wins = ? AND p.reputation = ? AND p.player_id < ?))`;
      rest = [eventsCompleted, eventsCompleted, avg, eventsCompleted, avg, wins, eventsCompleted, avg, wins, reputation, eventsCompleted, avg, wins, reputation, playerId];
      break;
    case 'avg':
    default:
      cond = `(${R} > ? OR (${R} = ? AND s.wins > ?) OR (${R} = ? AND s.wins = ? AND p.reputation > ?) OR (${R} = ? AND s.wins = ? AND p.reputation = ? AND ${B} > ?) OR (${R} = ? AND s.wins = ? AND p.reputation = ? AND ${B} = ? AND p.player_id < ?))`;
      rest = [avg, avg, wins, avg, wins, reputation, avg, wins, reputation, eventsCompleted, avg, wins, reputation, eventsCompleted, playerId];
      break;
  }

  const [rows] = await poolRef.query(
    `SELECT COUNT(*) AS c ${base} ${cond}`,
    [serverId, minBattles, ...rest],
  );
  return Number(rows[0]?.c) || 0;
}

/**
 * @param {{ serverId?: string, playerId?: string }} q
 * @returns {Promise<string|null>}
 */
async function resolveServerIdForStanding({ serverId, playerId }) {
  const sid = serverId != null ? String(serverId).trim() : '';
  if (sid) return sid;
  const pid = playerId != null ? String(playerId).trim() : '';
  if (!pid) return null;
  const [rows] = await pool.query('SELECT serverId FROM accounts WHERE id = ? LIMIT 1', [pid]);
  return rows[0]?.serverId ? String(rows[0].serverId) : null;
}

/**
 * @param {string} campaignId
 * @returns {boolean}
 */
function isSafeCampaignIdForJsonPath(campaignId) {
  return typeof campaignId === 'string' && /^[a-zA-Z0-9_]+$/.test(campaignId);
}

/**
 * MySQL JSON path: `$."campaign_id".field`（campaign_id 已白名单校验）
 * @param {string} campaignId
 * @param {'bestScore'|'bestGrade'} field
 */
function campaignProgressJsonPath(campaignId, field) {
  return `$."${campaignId}".${field}`;
}

// ── Delta SQL 片段（实时增量 vs 冻结增量）──────────────────────────────────

const LEGACY_DELTA = {
  battle: `s.total_battle_score - snap.snapshot_battle_score`,
  events: `s.total_events_completed - snap.snapshot_events_completed`,
  rep:    `(s.total_reputation_earned - snap.snapshot_reputation + s.total_contribution_earned - snap.snapshot_contribution)`,
  sf:     `(s.total_gold_earned - snap.snapshot_silver + s.total_food_earned - snap.snapshot_food)`,
};

/** 积分权重（与 19-1 文档一致）*/
const SCORE_WEIGHTS = { battle: 1, events: 300, rep: 30, sf: 3 };

/** 模块内缓存：避免每次请求都查 information_schema */
let _schemaCache = { checked: false, hasColumns: false };

/**
 * 检测 temp_event_ranking 是否含 frozen_delta_* 列（只查一次）。
 * 有则用 COALESCE 兼容冻结 / 实时两种状态；无则仅用实时差值（旧行为）。
 */
async function getDeltaSqlFragments() {
  if (!_schemaCache.checked) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temp_event_ranking'
         AND COLUMN_NAME = 'frozen_delta_battle'`,
      );
      _schemaCache.hasColumns = Number(rows[0]?.c) > 0;
    } catch (e) {
      console.warn('[rankingService] 无法检测 frozen 列，使用实时差值:', e.message);
      _schemaCache.hasColumns = false;
    }
    _schemaCache.checked = true;
  }

  if (!_schemaCache.hasColumns) return LEGACY_DELTA;

  return {
    battle: `COALESCE(snap.frozen_delta_battle, ${LEGACY_DELTA.battle})`,
    events: `COALESCE(snap.frozen_delta_events, ${LEGACY_DELTA.events})`,
    rep:    `COALESCE(snap.frozen_delta_rep_contrib, ${LEGACY_DELTA.rep})`,
    sf:     `COALESCE(snap.frozen_delta_silver_food, ${LEGACY_DELTA.sf})`,
  };
}

/** 总分 SQL 表达式（由 delta 片段拼合） */
function totalScoreSql(d) {
  return `(${d.battle}) * ${SCORE_WEIGHTS.battle}
        + (${d.events}) * ${SCORE_WEIGHTS.events}
        + (${d.rep})    * ${SCORE_WEIGHTS.rep}
        + (${d.sf})     * ${SCORE_WEIGHTS.sf}`;
}

/**
 * 活动结束后将增量冻结到 frozen_delta_* 列（幂等；有冻结列才执行）。
 * 已写入 frozen_at 的行跳过，避免重复写。
 */
async function ensureRankingFrozen(eventId, hasColumns) {
  if (!hasColumns) return;
  const cfg = ACTIVITY_RANKING_EVENTS[eventId];
  if (!cfg?.endTime) return;
  const endMs = new Date(cfg.endTime).getTime();
  if (Number.isNaN(endMs) || Date.now() <= endMs) return;

  try {
    const [done] = await pool.query(
      'SELECT frozen_at FROM temp_event_ranking WHERE event_id = ? AND frozen_at IS NOT NULL LIMIT 1',
      [eventId],
    );
    if (done.length > 0) return;

    await pool.query(
      `UPDATE temp_event_ranking snap
       JOIN player_statistics s ON s.player_id = snap.player_id
       SET
         snap.frozen_delta_battle       = ${LEGACY_DELTA.battle},
         snap.frozen_delta_events       = ${LEGACY_DELTA.events},
         snap.frozen_delta_rep_contrib  = ${LEGACY_DELTA.rep},
         snap.frozen_delta_silver_food  = ${LEGACY_DELTA.sf},
         snap.frozen_at = NOW()
       WHERE snap.event_id = ? AND snap.frozen_at IS NULL`,
      [eventId],
    );
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR' || String(e.message).includes('Unknown column')) {
      console.warn('[rankingService] 跳过积分冻结（请先执行 migrations/add-temp-ranking-snapshots-frozen-deltas.sql）:', eventId);
      return;
    }
    throw e;
  }
}

/**
 * 若玩家尚无快照（活动期间新增），自动补建（增量从当前值起，即 0 分起步）。
 * @returns {boolean} 是否有可用快照
 */
async function ensurePlayerSnapshot(eventId, playerId) {
  const [snapCheck] = await pool.query(
    'SELECT 1 FROM temp_event_ranking WHERE event_id = ? AND player_id = ?',
    [eventId, playerId],
  );
  if (snapCheck.length > 0) return true;

  try {
    await pool.query(
      `INSERT IGNORE INTO temp_event_ranking
         (event_id, player_id,
          snapshot_battle_score, snapshot_events_completed,
          snapshot_reputation, snapshot_contribution,
          snapshot_silver, snapshot_food, expires_at)
       SELECT ?, ?,
         s.total_battle_score, s.total_events_completed,
         s.total_reputation_earned, s.total_contribution_earned,
         s.total_gold_earned, s.total_food_earned,
         DATE_ADD(NOW(), INTERVAL 30 DAY)
       FROM player_statistics s WHERE s.player_id = ?`,
      [eventId, playerId, playerId],
    );
    const [rechk] = await pool.query(
      'SELECT 1 FROM temp_event_ranking WHERE event_id = ? AND player_id = ?',
      [eventId, playerId],
    );
    return rechk.length > 0;
  } catch (e) {
    console.warn('[rankingService] 自动补建快照失败:', e.message);
    return false;
  }
}

/**
 * 格式化排行榜行（数据库行 → API 响应字段）
 */
function formatRankingRow(row, rank) {
  return {
    rank,
    playerId: row.player_id,
    name: row.name || row.player_id,
    totalScore: Number(row.total_score) || 0,
    battleScore: Number(row.delta_battle) || 0,
    eventsCompleted: Number(row.delta_events) || 0,
    repContrib: Number(row.delta_rep_contrib) || 0,
    silverFood: Number(row.delta_silver_food) || 0,
  };
}

/**
 * 获取活动排行榜数据
 *
 * @param {string} eventId   - 活动 ID
 * @param {object} opts
 * @param {number} [opts.limit=10]  - 榜单显示条数（上限50）
 * @param {string} [opts.playerId]  - 当前玩家 ID（用于查"我的排名"）
 * @returns {Promise<{ rankings: object[], myRanking: object|null, totalParticipants: number, updatedAt: string }>}
 */
async function getRankings(eventId, { limit = 10, playerId = null } = {}) {
  const safeLimit = Math.min(Number(limit) || 10, 50);
  const d = await getDeltaSqlFragments();
  await ensureRankingFrozen(eventId, _schemaCache.hasColumns);

  const scoreSql = totalScoreSql(d);

  // 前 N 名排行
  const [topRows] = await pool.query(
    `SELECT
       s.player_id,
       p.character_name AS name,
       (${d.battle}) AS delta_battle,
       (${d.events}) AS delta_events,
       (${d.rep})    AS delta_rep_contrib,
       (${d.sf})     AS delta_silver_food,
       (${scoreSql}) AS total_score
     FROM player_statistics s
     JOIN temp_event_ranking snap ON s.player_id = snap.player_id AND snap.event_id = ?
     JOIN players p ON s.player_id = p.player_id
     ORDER BY total_score DESC, delta_battle DESC, delta_events DESC, delta_rep_contrib DESC, delta_silver_food DESC
     LIMIT ?`,
    [eventId, safeLimit],
  );
  const rankings = topRows.map((row, i) => formatRankingRow(row, i + 1));

  // 我的排名
  let myRanking = null;
  if (playerId) {
    const hasSnap = await ensurePlayerSnapshot(eventId, playerId);
    if (hasSnap) {
      const [myRows] = await pool.query(
        `SELECT
           (${d.battle}) AS delta_battle,
           (${d.events}) AS delta_events,
           (${d.rep})    AS delta_rep_contrib,
           (${d.sf})     AS delta_silver_food,
           (${scoreSql}) AS total_score
         FROM player_statistics s
         JOIN temp_event_ranking snap ON s.player_id = snap.player_id AND snap.event_id = ?
         WHERE s.player_id = ?`,
        [eventId, playerId],
      );
      if (myRows.length > 0) {
        const myTotal = Number(myRows[0].total_score) || 0;
        const [rankRows] = await pool.query(
          `SELECT COUNT(*) AS higher_count
           FROM player_statistics s
           JOIN temp_event_ranking snap ON s.player_id = snap.player_id AND snap.event_id = ?
           WHERE (${scoreSql}) > ?`,
          [eventId, myTotal],
        );
        myRanking = {
          rank: (rankRows[0]?.higher_count || 0) + 1,
          totalScore: myTotal,
          battleScore: Number(myRows[0].delta_battle) || 0,
          eventsCompleted: Number(myRows[0].delta_events) || 0,
          repContrib: Number(myRows[0].delta_rep_contrib) || 0,
          silverFood: Number(myRows[0].delta_silver_food) || 0,
        };
      }
    }
  }

  // 总参与人数
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM temp_event_ranking WHERE event_id = ?',
    [eventId],
  );

  return {
    rankings,
    myRanking,
    totalParticipants: countRows[0]?.total || 0,
    updatedAt: new Date().toISOString(),
  };
}

// ── 常驻排行榜（18-4）：总体 / 战役，与活动榜 getRankings 分离 ─────────────────

/**
 * @param {object} opts
 * @param {number} [opts.limit]
 * @param {string} [opts.playerId]
 * @param {string} [opts.serverId]
 * @param {string} [opts.sort] avg | wins | reputation | events | badges（主排序；events/badges 均为赛季徽章持有量，见 18-4）
 */
async function getOverallRankings(opts = {}) {
  const rawLimit = Number(opts.limit) || OVERALL_DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), OVERALL_MAX_LIMIT);
  const playerId = opts.playerId != null ? String(opts.playerId).trim() : '';
  const sortKey = normalizeOverallSortKey(opts.sort);
  const serverId = await resolveServerIdForStanding({
    serverId: opts.serverId,
    playerId: playerId || undefined,
  });
  if (!serverId) {
    const err = new Error('缺少 serverId，且无法从 playerId 解析服务器');
    err.statusCode = 400;
    throw err;
  }

  const baseJoin = `
    FROM player_statistics s
    INNER JOIN players p ON p.player_id = s.player_id
    INNER JOIN accounts a ON a.id = p.player_id
      AND a.serverId = ?
      AND a.account_type = 'real'
      AND a.status = 'active'
  `;

  const orderBy = OVERALL_ORDER_BY[sortKey] || OVERALL_ORDER_BY.avg;

  const [topRows] = await pool.query(
    `SELECT
       p.player_id,
       p.character_name,
       p.faction_name,
       ROUND(s.total_battle_score / s.total_battles) AS avg_battle_score,
       s.wins,
       p.reputation,
       ${OVERALL_BADGE_COUNT_EXPR} AS badge_count
     ${baseJoin}
     WHERE s.total_battles >= ?
     ORDER BY ${orderBy}
     LIMIT ?`,
    [serverId, OVERALL_MIN_BATTLES, limit],
  );

  const rankings = topRows.map((row, i) => {
    const badgeCount = Number(row.badge_count) || 0;
    return {
      rank: i + 1,
      playerId: row.player_id,
      name: row.character_name || row.player_id,
      factionName: row.faction_name || '',
      avgBattleScore: Number(row.avg_battle_score) || 0,
      wins: Number(row.wins) || 0,
      reputation: Number(row.reputation) || 0,
      badgeCount,
      eventsCompleted: badgeCount,
    };
  });

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     ${baseJoin}
     WHERE s.total_battles >= ?`,
    [serverId, OVERALL_MIN_BATTLES],
  );
  const totalRankedPlayers = Number(countRows[0]?.total) || 0;

  let myRanking = null;
  if (playerId) {
    const [meRows] = await pool.query(
      `SELECT
         p.player_id,
         p.character_name,
         p.faction_name,
         s.total_battles,
         ROUND(s.total_battle_score / NULLIF(s.total_battles, 0)) AS avg_battle_score,
         s.wins,
         p.reputation,
         ${OVERALL_BADGE_COUNT_EXPR} AS badge_count
       FROM player_statistics s
       INNER JOIN players p ON p.player_id = s.player_id
       INNER JOIN accounts a ON a.id = p.player_id AND a.serverId = ?
       WHERE p.player_id = ?
       LIMIT 1`,
      [serverId, playerId],
    );
    const me = meRows[0];
    if (me) {
      const tb = Number(me.total_battles) || 0;
      const avg = tb >= OVERALL_MIN_BATTLES ? Number(me.avg_battle_score) || 0 : null;
      const wins = Number(me.wins) || 0;
      const reputation = Number(me.reputation) || 0;
      const badgeCount = Number(me.badge_count) || 0;

      if (tb < OVERALL_MIN_BATTLES) {
        myRanking = {
          playerId: me.player_id,
          name: me.character_name || me.player_id,
          factionName: me.faction_name || '',
          eligible: false,
          reason: 'insufficient_battles',
          totalBattles: tb,
          avgBattleScore: null,
          rank: null,
          wins,
          reputation,
          badgeCount,
          eventsCompleted: badgeCount,
        };
      } else {
        const above = await countOverallPlayersAbove(pool, {
          serverId,
          minBattles: OVERALL_MIN_BATTLES,
          sortKey,
          avg,
          wins,
          reputation,
          eventsCompleted: badgeCount,
          playerId,
        });
        const rank = above + 1;
        myRanking = {
          playerId: me.player_id,
          name: me.character_name || me.player_id,
          factionName: me.faction_name || '',
          eligible: true,
          totalBattles: tb,
          avgBattleScore: avg,
          rank,
          wins,
          reputation,
          badgeCount,
          eventsCompleted: badgeCount,
        };
      }
    }
  }

  return {
    serverId,
    sort: sortKey,
    minBattles: OVERALL_MIN_BATTLES,
    rankings,
    myRanking,
    totalRankedPlayers,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} opts
 * @param {string} opts.campaignId
 * @param {number} [opts.limit]
 * @param {string} [opts.playerId]
 * @param {string} [opts.serverId]
 */
async function getCampaignRankings(opts = {}) {
  const campaignId = opts.campaignId != null ? String(opts.campaignId).trim() : '';
  if (!campaignId || !isSafeCampaignIdForJsonPath(campaignId)) {
    const err = new Error('无效 campaignId');
    err.statusCode = 400;
    throw err;
  }

  const def = await campaignService.getDefinition(campaignId);
  if (!def) {
    const err = new Error('战役不存在或未启用');
    err.statusCode = 404;
    throw err;
  }

  const rawLimit = Number(opts.limit) || CAMPAIGN_DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), CAMPAIGN_MAX_LIMIT);
  const playerId = opts.playerId != null ? String(opts.playerId).trim() : '';
  const serverId = await resolveServerIdForStanding({
    serverId: opts.serverId,
    playerId: playerId || undefined,
  });
  if (!serverId) {
    const err = new Error('缺少 serverId，且无法从 playerId 解析服务器');
    err.statusCode = 400;
    throw err;
  }

  const pathScore = campaignProgressJsonPath(campaignId, 'bestScore');
  const pathGrade = campaignProgressJsonPath(campaignId, 'bestGrade');

  const [topRows] = await pool.query(
    `SELECT
       p.player_id,
       p.character_name,
       p.faction_name,
       CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) AS best_score,
       JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS best_grade_raw
     FROM player_progress pp
     INNER JOIN players p ON p.player_id = pp.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND a.serverId = ?
       AND a.account_type = 'real'
       AND a.status = 'active'
     WHERE JSON_EXTRACT(pp.campaign_progress, ?) IS NOT NULL
       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) > 0
     ORDER BY best_score DESC, p.player_id ASC
     LIMIT ?`,
    [pathScore, pathGrade, serverId, pathScore, pathScore, limit],
  );

  const rankings = topRows.map((row, i) => {
    const bestScore = Number(row.best_score) || 0;
    const storedGrade = row.best_grade_raw && String(row.best_grade_raw).trim() !== ''
      ? String(row.best_grade_raw).trim().charAt(0).toUpperCase()
      : '';
    const grade =
      ['S', 'A', 'B', 'C', 'D'].includes(storedGrade)
        ? storedGrade
        : campaignService.gradeFromBattleScore(bestScore).grade;
    return {
      rank: i + 1,
      playerId: row.player_id,
      name: row.character_name || row.player_id,
      factionName: row.faction_name || '',
      bestScore,
      grade,
    };
  });

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM player_progress pp
     INNER JOIN players p ON p.player_id = pp.player_id
     INNER JOIN accounts a ON a.id = p.player_id
       AND a.serverId = ?
       AND a.account_type = 'real'
       AND a.status = 'active'
     WHERE JSON_EXTRACT(pp.campaign_progress, ?) IS NOT NULL
       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) > 0`,
    [serverId, pathScore, pathScore],
  );
  const totalRankedPlayers = Number(countRows[0]?.total) || 0;

  let myRanking = null;
  if (playerId) {
    const [meRows] = await pool.query(
      `SELECT
         p.player_id,
         p.character_name,
         p.faction_name,
         CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) AS best_score,
         JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS best_grade_raw
       FROM player_progress pp
       INNER JOIN players p ON p.player_id = pp.player_id
       INNER JOIN accounts a ON a.id = p.player_id AND a.serverId = ?
       WHERE p.player_id = ?
       LIMIT 1`,
      [pathScore, pathGrade, serverId, playerId],
    );
    const me = meRows[0];
    if (me) {
      const bestScore = Number(me.best_score) || 0;
      if (bestScore <= 0) {
        myRanking = {
          playerId: me.player_id,
          name: me.character_name || me.player_id,
          factionName: me.faction_name || '',
          challenged: false,
          rank: null,
          bestScore: null,
          grade: null,
        };
      } else {
        const storedGrade = me.best_grade_raw && String(me.best_grade_raw).trim() !== ''
          ? String(me.best_grade_raw).trim().charAt(0).toUpperCase()
          : '';
        const grade =
          ['S', 'A', 'B', 'C', 'D'].includes(storedGrade)
            ? storedGrade
            : campaignService.gradeFromBattleScore(bestScore).grade;

        const [rankAbove] = await pool.query(
          `SELECT COUNT(*) AS c
           FROM player_progress pp
           INNER JOIN players p ON p.player_id = pp.player_id
           INNER JOIN accounts a ON a.id = p.player_id
             AND a.serverId = ?
             AND a.account_type = 'real'
             AND a.status = 'active'
           WHERE JSON_EXTRACT(pp.campaign_progress, ?) IS NOT NULL
             AND CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) > ?`,
          [serverId, pathScore, pathScore, bestScore],
        );
        const [rankTie] = await pool.query(
          `SELECT COUNT(*) AS c
           FROM player_progress pp
           INNER JOIN players p ON p.player_id = pp.player_id
           INNER JOIN accounts a ON a.id = p.player_id
             AND a.serverId = ?
             AND a.account_type = 'real'
             AND a.status = 'active'
           WHERE JSON_EXTRACT(pp.campaign_progress, ?) IS NOT NULL
             AND CAST(JSON_UNQUOTE(JSON_EXTRACT(pp.campaign_progress, ?)) AS UNSIGNED) = ?
             AND p.player_id < ?`,
          [serverId, pathScore, pathScore, bestScore, playerId],
        );
        const rank = (Number(rankAbove[0]?.c) || 0) + (Number(rankTie[0]?.c) || 0) + 1;

        myRanking = {
          playerId: me.player_id,
          name: me.character_name || me.player_id,
          factionName: me.faction_name || '',
          challenged: true,
          rank,
          bestScore,
          grade,
        };
      }
    }
  }

  return {
    serverId,
    campaignId,
    campaignName: def.campaign_name || campaignId,
    rankings,
    myRanking,
    totalRankedPlayers,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { getRankings, getOverallRankings, getCampaignRankings };
