/**
 * 称号/成就 unlock_conditions 求值用玩家快照（单次查询聚合）
 */

const { pool } = require('../database/connection');
const { ACHIEVEMENT_METRIC_KEYS } = require('../../shared/utils/unlockConditionKeys.js');

/**
 * @param {unknown} raw
 * @returns {Record<string, { status?: string }>}
 */
function parseExploreEventsJson(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * @param {Record<string, { status?: string }>} exploreEvents
 * @returns {Set<string>}
 */
function completedExploreEventIdSet(exploreEvents) {
  const out = new Set();
  for (const [eventId, rec] of Object.entries(exploreEvents || {})) {
    if (rec?.status === 'completed') out.add(String(eventId));
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {{ tenureByPositionLevel: Record<string, number>, hasPremium: boolean }}
 */
function parseTitleProgressJson(raw) {
  const fallback = { tenureByPositionLevel: {}, hasPremium: false };
  if (raw == null || raw === '') return fallback;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fallback;
  const tenureRaw = obj.tenureByPositionLevel ?? obj.tenure_by_position_level ?? {};
  const tenureByPositionLevel = {};
  if (tenureRaw && typeof tenureRaw === 'object') {
    for (const [k, v] of Object.entries(tenureRaw)) {
      const n = Number(v);
      if (Number.isFinite(n)) tenureByPositionLevel[String(k)] = Math.max(0, Math.trunc(n));
    }
  }
  return {
    tenureByPositionLevel,
    hasPremium: !!(obj.hasPremium ?? obj.has_premium),
  };
}

/**
 * @param {*} connection
 * @param {string} playerId
 * @returns {Promise<{
 *   playerId: string,
 *   metrics: Record<string, number>,
 *   completedExploreEventIds: Set<string>,
 *   tenureDaysByPositionLevel: Record<string, number>,
 *   hasPremium: boolean,
 * }>}
 */
async function buildPlayerProgressSnapshot(playerId, connection = null) {
  const pid = String(playerId || '').trim();
  const exec = connection ? connection.query.bind(connection) : pool.query.bind(pool);

  const [statRows] = await exec(
    `SELECT wins, total_gold_earned, total_events_completed
     FROM player_statistics WHERE player_id = ? LIMIT 1`,
    [pid],
  );
  const stat = statRows[0] || {};

  const [legendaryRows] = await exec(
    `SELECT COUNT(DISTINCT pc.card_id) AS cnt
     FROM player_cards pc
     INNER JOIN config_characters cc ON cc.character_id = pc.card_id
     WHERE pc.player_id = ?
       AND pc.card_type = 'character'
       AND cc.rarity = 'legendary'`,
    [pid],
  );
  const legendaryCount = Number(legendaryRows[0]?.cnt) || 0;

  const [eventRows] = await exec(
    'SELECT explore_events FROM player_events WHERE player_id = ? LIMIT 1',
    [pid],
  );
  const exploreEvents = parseExploreEventsJson(eventRows[0]?.explore_events);

  const [progressRows] = await exec(
    'SELECT title_progress FROM player_progress WHERE player_id = ? LIMIT 1',
    [pid],
  );
  const titleProgress = parseTitleProgressJson(progressRows[0]?.title_progress);

  const [accountRows] = await exec(
    'SELECT hasPremium FROM accounts WHERE id = ? LIMIT 1',
    [pid],
  );
  const accountPremium = !!accountRows[0]?.hasPremium;

  return {
    playerId: pid,
    metrics: {
      [ACHIEVEMENT_METRIC_KEYS.WIN_BATTLES]: Number(stat.wins) || 0,
      [ACHIEVEMENT_METRIC_KEYS.TOTAL_SILVER_EARNED]: Number(stat.total_gold_earned) || 0,
      [ACHIEVEMENT_METRIC_KEYS.LEGENDARY_CHARACTERS_COLLECTED]: legendaryCount,
      [ACHIEVEMENT_METRIC_KEYS.TOTAL_EVENTS_COMPLETED]: Number(stat.total_events_completed) || 0,
    },
    completedExploreEventIds: completedExploreEventIdSet(exploreEvents),
    tenureDaysByPositionLevel: titleProgress.tenureByPositionLevel,
    hasPremium: accountPremium || titleProgress.hasPremium,
  };
}

module.exports = {
  buildPlayerProgressSnapshot,
  parseExploreEventsJson,
  parseTitleProgressJson,
  completedExploreEventIdSet,
};
