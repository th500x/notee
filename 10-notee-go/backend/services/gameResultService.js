/**
 * Stores competitive rounds and deletes one account's leaderboard rows.
 * Anonymous rows have a null user_id and are not deleted here.
 */

const { query, transaction } = require('../database/connection');
const { prepareRounds } = require('../lib/gameResults');

const INSERT = `INSERT INTO game_results (
  user_id, game_id, role, outcome, attempts, elapsed_ms, percentile, penalty,
  player_count, flag_id, gender_id, recorded_at, nick_name, install_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

async function ingestRounds(userId, rounds) {
  const rows = prepareRounds(rounds, userId || null);
  await transaction(async (connection) => {
    for (const row of rows) {
      await connection.query(INSERT, [
        row.userId,
        row.gameId,
        row.role,
        row.outcome,
        row.attempts,
        row.elapsedMs,
        row.percentile,
        row.penalty,
        row.playerCount,
        row.flagId,
        row.genderId,
        row.recordedAt,
        row.nickName,
        row.installId,
      ]);
    }
  });
  return { accepted: rows.length };
}

/** Every leaderboard row this account uploaded, before or after a short-id change. */
async function deleteRankingsForUser(userId) {
  const result = await query('DELETE FROM game_results WHERE user_id = ?', [userId]);
  return result.affectedRows || 0;
}

module.exports = {
  ingestRounds,
  deleteRankingsForUser,
};
