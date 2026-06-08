/**
 * player_statistics 表经济类累计：统一有符号增量（与 players 资源变动语义对齐）
 *
 * - silver / food / contribution：delta > 0 → total_*_earned；delta < 0 → total_*_spent（绝对值）
 * - reputation：仅有 total_reputation_earned；delta < 0 时用 GREATEST(0, earned + delta) 下调（无 spent 列）
 */

const { pool } = require('../database/connection');
const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');

function normalizeSignedInt(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/**
 * @param {string} playerId
 * @param {{ silver?: number, food?: number, reputation?: number, contribution?: number }} deltas - 有符号整数
 * @param {import('mysql2/promise').PoolConnection} [connection] - 与业务事务同事务时传入
 * @returns {Promise<void>}
 */
async function applyResourceDelta(playerId, deltas = {}, connection = null) {
  const pid = playerId != null ? String(playerId).trim() : '';
  if (!pid) return;

  const silver = normalizeSignedInt(deltas.silver);
  const food = normalizeSignedInt(deltas.food);
  const reputation = normalizeSignedInt(deltas.reputation);
  const contribution = normalizeSignedInt(deltas.contribution);

  if (!silver && !food && !reputation && !contribution) return;

  const setParts = [];
  const params = [];

  if (silver > 0) {
    setParts.push('total_gold_earned = total_gold_earned + ?');
    params.push(silver);
  } else if (silver < 0) {
    setParts.push('total_gold_spent = total_gold_spent + ?');
    params.push(-silver);
  }

  if (food > 0) {
    setParts.push('total_food_earned = total_food_earned + ?');
    params.push(food);
  } else if (food < 0) {
    setParts.push('total_food_spent = total_food_spent + ?');
    params.push(-food);
  }

  if (contribution > 0) {
    setParts.push('total_contribution_earned = total_contribution_earned + ?');
    params.push(contribution);
  } else if (contribution < 0) {
    setParts.push('total_contribution_spent = total_contribution_spent + ?');
    params.push(-contribution);
  }

  if (reputation > 0) {
    setParts.push('total_reputation_earned = total_reputation_earned + ?');
    params.push(reputation);
  } else if (reputation < 0) {
    setParts.push('total_reputation_earned = GREATEST(0, total_reputation_earned + ?)');
    params.push(reputation);
  }

  if (setParts.length === 0) return;

  params.push(pid);
  const sql = `UPDATE player_statistics SET ${setParts.join(', ')} WHERE player_id = ?`;
  const exec = connection ? connection.query.bind(connection) : pool.query.bind(pool);
  const [r] = await exec(sql, params);
  if (!r.affectedRows) {
    console.warn('[statisticsDelta] 未命中 player_statistics 行', { playerId: pid, deltas: { silver, food, reputation, contribution } });
  }
}

/**
 * 仅统计「获得」侧（正数），用于攻城领奖、战役领奖、卡池补偿等与 players 加资源一致的路径。
 * 无 connection 时吞错并打日志（与历史 incrementSpent 行为一致，避免已提交业务因统计失败抛错）。
 *
 * @param {string} playerId
 * @param {{ silver?: number, food?: number, reputation?: number, contribution?: number }} amounts - 非负
 * @param {import('mysql2/promise').PoolConnection} [connection]
 */
async function recordEarned(playerId, amounts = {}, connection = null) {
  const d = {};
  const s = Math.max(0, Math.floor(Number(amounts.silver) || 0));
  const f = Math.max(0, Math.floor(Number(amounts.food) || 0));
  const r = Math.max(0, Math.floor(Number(amounts.reputation) || 0));
  const c = Math.max(0, Math.floor(Number(amounts.contribution) || 0));
  if (s > 0) d.silver = s;
  if (f > 0) d.food = f;
  if (r > 0) d.reputation = r;
  if (c > 0) d.contribution = c;
  if (Object.keys(d).length === 0) return;

  if (connection) {
    await applyResourceDelta(playerId, d, connection);
    return;
  }
  try {
    await applyResourceDelta(playerId, d);
    if (d.silver > 0) {
      runPlayerMilestoneCheckSafe(playerId, 'silver_earn').catch(() => {});
    }
  } catch (e) {
    console.error('[statisticsDelta] recordEarned failed', e);
  }
}

/**
 * @param {string} playerId
 * @param {{ silver?: number, food?: number, contribution?: number }} amounts - 均为正数消耗量
 */
async function incrementSpent(playerId, amounts = {}) {
  const pid = playerId != null ? String(playerId).trim() : '';
  const silver = Math.max(0, Math.floor(Number(amounts.silver) || 0));
  const food = Math.max(0, Math.floor(Number(amounts.food) || 0));
  const contribution = Math.max(0, Math.floor(Number(amounts.contribution) || 0));
  if (!pid || (silver === 0 && food === 0 && contribution === 0)) return;

  const d = {};
  if (silver > 0) d.silver = -silver;
  if (food > 0) d.food = -food;
  if (contribution > 0) d.contribution = -contribution;

  try {
    await applyResourceDelta(playerId, d);
  } catch (e) {
    console.error('[statisticsDelta] incrementSpent failed', e);
  }
}

module.exports = {
  applyResourceDelta,
  recordEarned,
  incrementSpent,
};
