/**
 * 探索配额：服务端恢复与消耗（与 routes/players explore-quota 行为一致）
 *
 * 恢复算法与攻城配额共用 `backend/utils/hourlyQuotaWithRestWindow.js`，见 docs/10-core-system/15-2。
 */

const { pool } = require('../database/connection');
const {
  calcHourlyQuotaWithRestWindow,
  EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
} = require('../utils/hourlyQuotaWithRestWindow');

const EXPLORE_REFILL_PER_HOUR = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.refillPerHour;
const EXPLORE_MAX_QUOTA = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.maxQuota;
const EXPLORE_REST_START = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.restHourStart;
const EXPLORE_REST_END = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.restHourEnd;

/** 与 `calcHourlyQuotaWithRestWindow(..., EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS)` 等价；保留导出供测试 require */
function calcServerQuota(remaining, lastRefillTs) {
  return calcHourlyQuotaWithRestWindow(remaining, lastRefillTs, new Date(), EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS);
}

async function getExploreQuotaState(playerId) {
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  const [rows] = await pool.query(
    'SELECT explore_quota_remaining, explore_quota_refill_ts FROM player_events WHERE player_id = ?',
    [playerId]
  );
  const row = rows[0] || {};
  const saved = calcHourlyQuotaWithRestWindow(
    row.explore_quota_remaining,
    row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null,
    new Date(),
    EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS
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
  const current = calcHourlyQuotaWithRestWindow(
    row.explore_quota_remaining,
    row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null,
    new Date(),
    EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS
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
  EXPLORE_REST_START,
  EXPLORE_REST_END,
  calcServerQuota,
  getExploreQuotaState,
  applyExploreQuotaAction,
};
