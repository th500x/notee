/**
 * 创角 · 势力人数平衡补偿（读库 + 预览挂载）
 *
 * @module backend/services/factionBalanceBonusService
 */

const { pool } = require('../database/connection');
const {
  computeFactionBalanceBonusSilver,
} = require('../../shared/utils/factionBalanceBonus.cjs');

async function queryFactionPlayerCountsByServer(serverId) {
  // 人数平衡补偿只按真人口径计算；AI 账号不计入（见 42-1 §3 身份与计数）
  const [rows] = await pool.query(
    `SELECT p.faction_id, COUNT(*) AS player_count
     FROM players p
     JOIN accounts a ON p.player_id = a.id
     WHERE a.serverId = ? AND a.account_type = 'real'
     GROUP BY p.faction_id`,
    [serverId],
  );
  return rows.map((row) => ({
    factionId: row.faction_id,
    playerCount: Number(row.player_count) || 0,
  }));
}

/**
 * 创角提交时按当前同服人数重算（权威口径）。
 *
 * @param {string} factionId
 * @param {string} serverId
 * @returns {Promise<{ amount: number, currentPlayers: number, maxPlayersOnServer: number }>}
 */
async function resolveBalanceBonusForFaction(factionId, serverId) {
  const counts = await queryFactionPlayerCountsByServer(serverId);
  const maxPlayersOnServer = counts.length
    ? Math.max(...counts.map((c) => c.playerCount))
    : 0;
  const currentPlayers = counts.find((c) => c.factionId === factionId)?.playerCount ?? 0;
  const amount = computeFactionBalanceBonusSilver(currentPlayers, maxPlayersOnServer);
  return { amount, currentPlayers, maxPlayersOnServer };
}

/**
 * 为 `getAvailableFactions` 列表挂载预览字段（不入库）。
 *
 * @param {object[]} factions 须已含 current_players
 */
function attachBalanceBonusPreviewToFactions(factions) {
  const list = Array.isArray(factions) ? factions : [];
  const maxPlayersOnServer = list.length
    ? Math.max(...list.map((f) => Number(f.current_players) || 0))
    : 0;
  for (const faction of list) {
    const amount = computeFactionBalanceBonusSilver(faction.current_players, maxPlayersOnServer);
    faction.balance_bonus_silver = amount;
    faction.balance_bonus_preview = { type: 'silver', amount };
  }
}

module.exports = {
  attachBalanceBonusPreviewToFactions,
  resolveBalanceBonusForFaction,
};
