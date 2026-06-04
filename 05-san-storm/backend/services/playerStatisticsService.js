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

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} [playerRow]
 */
function formatStatisticsRow(row, playerRow = null) {
  const base = {
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
  if (playerRow) {
    base.currentReputation = num(playerRow.reputation);
    base.currentContribution = num(playerRow.contribution);
    base.currentSilver = num(playerRow.silver);
    base.currentFood = num(playerRow.food);
  }
  return base;
}

/**
 * @returns {Promise<{ notFound: true } | { data: object }>}
 */
async function getPlayerStatistics(playerId) {
  const [rows] = await pool.query(
    `SELECT s.player_id, s.total_battles, s.wins, s.losses, s.draws, s.win_rate,
            s.total_damage_dealt, s.total_damage_taken, s.total_kills,
            s.total_battle_score, s.total_events_completed,
            s.total_gold_earned, s.total_gold_spent, s.total_food_earned, s.total_food_spent,
            s.total_contribution_earned, s.total_contribution_spent, s.total_reputation_earned,
            s.created_at, s.updated_at,
            p.reputation, p.contribution, p.silver, p.food
     FROM player_statistics s
     JOIN players p ON p.player_id = s.player_id
     WHERE s.player_id = ?`,
    [playerId],
  );
  if (!rows.length) {
    return { notFound: true };
  }
  const row = rows[0];
  return {
    data: formatStatisticsRow(row, {
      reputation: row.reputation,
      contribution: row.contribution,
      silver: row.silver,
      food: row.food,
    }),
  };
}

module.exports = {
  getPlayerStatistics,
  formatStatisticsRow,
};
