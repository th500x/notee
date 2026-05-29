/**
 * player_statistics 表读取（个人中心「统计」页）
 *
 * @see docs/00-base/01-database-split/60-tables-other.md player_statistics
 */

const { pool } = require('../database/connection');

function num(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** @param {Record<string, unknown>} row */
function formatStatisticsRow(row) {
  return {
    playerId: row.player_id,
    totalBattles: num(row.total_battles),
    wins: num(row.wins),
    losses: num(row.losses),
    draws: num(row.draws),
    winRate: num(row.win_rate),
    totalDamageDealt: num(row.total_damage_dealt),
    totalDamageTaken: num(row.total_damage_taken),
    totalKills: num(row.total_kills),
    totalBattleScore: num(row.total_battle_score),
    totalEventsCompleted: num(row.total_events_completed),
    totalPlaytime: num(row.total_playtime),
    todayPlaytime: num(row.today_playtime),
    weekPlaytime: num(row.week_playtime),
    monthPlaytime: num(row.month_playtime),
    totalGoldEarned: num(row.total_gold_earned),
    totalGoldSpent: num(row.total_gold_spent),
    totalFoodEarned: num(row.total_food_earned),
    totalFoodSpent: num(row.total_food_spent),
    totalContributionEarned: num(row.total_contribution_earned),
    totalContributionSpent: num(row.total_contribution_spent),
    totalReputationEarned: num(row.total_reputation_earned),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * @returns {Promise<{ notFound: true } | { data: object }>}
 */
async function getPlayerStatistics(playerId) {
  const [rows] = await pool.query(
    `SELECT player_id, total_battles, wins, losses, draws, win_rate,
            total_damage_dealt, total_damage_taken, total_kills,
            total_battle_score, total_events_completed,
            total_playtime, today_playtime, week_playtime, month_playtime,
            total_gold_earned, total_gold_spent, total_food_earned, total_food_spent,
            total_contribution_earned, total_contribution_spent, total_reputation_earned,
            created_at, updated_at
     FROM player_statistics WHERE player_id = ?`,
    [playerId],
  );
  if (!rows.length) {
    return { notFound: true };
  }
  return { data: formatStatisticsRow(rows[0]) };
}

module.exports = {
  getPlayerStatistics,
  formatStatisticsRow,
};
