/**
 * 探索配额：服务端恢复与消耗（与 routes/players explore-quota 行为一致）
 */

const { pool } = require('../database/connection');

const EXPLORE_REFILL_PER_HOUR = 6;
const EXPLORE_MAX_QUOTA = 18;
const EXPLORE_REST_START = 0;
const EXPLORE_REST_END = 8;

function isExploreRestHour(hour) {
  return hour >= EXPLORE_REST_START && hour < EXPLORE_REST_END;
}

function getHourTs(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
}

function countExploreActiveHours(fromTs, toTs) {
  if (toTs <= fromTs) return 0;
  let count = 0;
  let ts = fromTs;
  let i = 0;
  while (ts < toTs && i < 48) {
    if (!isExploreRestHour(new Date(ts).getHours())) count++;
    ts += 3600000;
    i++;
  }
  return count;
}

function calcServerQuota(remaining, lastRefillTs) {
  const now = new Date();
  const currentHourTs = getHourTs(now);
  if (!lastRefillTs) {
    return {
      remaining: isExploreRestHour(now.getHours()) ? 0 : EXPLORE_REFILL_PER_HOUR,
      lastRefillTs: currentHourTs,
    };
  }
  const activeHours = countExploreActiveHours(lastRefillTs, currentHourTs);
  if (activeHours > 0) {
    return {
      remaining: Math.min((remaining || 0) + activeHours * EXPLORE_REFILL_PER_HOUR, EXPLORE_MAX_QUOTA),
      lastRefillTs: currentHourTs,
    };
  }
  return { remaining: remaining || 0, lastRefillTs };
}

async function getExploreQuotaState(playerId) {
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  const [rows] = await pool.query(
    'SELECT explore_quota_remaining, explore_quota_refill_ts FROM player_events WHERE player_id = ?',
    [playerId]
  );
  const row = rows[0] || {};
  const saved = calcServerQuota(
    row.explore_quota_remaining,
    row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null
  );
  if (
    saved.lastRefillTs !== (row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null) ||
    saved.remaining !== row.explore_quota_remaining
  ) {
    await pool.query(
      'UPDATE player_events SET explore_quota_remaining = ?, explore_quota_refill_ts = ? WHERE player_id = ?',
      [saved.remaining, String(saved.lastRefillTs), playerId]
    );
  }
  return {
    remaining: saved.remaining,
    lastRefillTs: saved.lastRefillTs,
    max: EXPLORE_MAX_QUOTA,
    refillPerHour: EXPLORE_REFILL_PER_HOUR,
  };
}

async function applyExploreQuotaAction(playerId, action) {
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  const [rows] = await pool.query(
    'SELECT explore_quota_remaining, explore_quota_refill_ts FROM player_events WHERE player_id = ?',
    [playerId]
  );
  const row = rows[0] || {};
  const current = calcServerQuota(
    row.explore_quota_remaining,
    row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null
  );
  let newRemaining = current.remaining;
  if (action === 'consume') {
    if (newRemaining <= 0) return { ok: false, error: '探索次数不足' };
    newRemaining -= 1;
  } else if (action === 'refund') {
    newRemaining = Math.min(newRemaining + 1, EXPLORE_MAX_QUOTA);
  } else if (action === 'fillMax') {
    newRemaining = EXPLORE_MAX_QUOTA;
  }
  await pool.query(
    'UPDATE player_events SET explore_quota_remaining = ?, explore_quota_refill_ts = ? WHERE player_id = ?',
    [newRemaining, String(current.lastRefillTs), playerId]
  );
  return {
    ok: true,
    data: { remaining: newRemaining, lastRefillTs: current.lastRefillTs, max: EXPLORE_MAX_QUOTA },
  };
}

module.exports = {
  EXPLORE_MAX_QUOTA,
  EXPLORE_REFILL_PER_HOUR,
  calcServerQuota,
  getExploreQuotaState,
  applyExploreQuotaAction,
};
