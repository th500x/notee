/**
 * 个人中心「成就」页：全量配置 + 玩家是否持有 + 进度
 *
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md
 */

const { pool } = require('../database/connection');
const { formatAttributeBonusDisplay, formatRewardsDisplay } = require('../utils/catalogDisplayFormat');
const { buildAchievementCatalogProgress } = require('../utils/achievementCatalogProgress');
const { buildPlayerProgressSnapshot } = require('./playerProgressSnapshotService');
const {
  buildAchievementChainIndex,
  resolveAchievementClaimStatus,
} = require('../utils/achievementEligibility');

/**
 * @param {string} playerId
 * @returns {Promise<{ notFound: true } | { data: { achievements: object[] } }>}
 */
async function getPlayerAchievementCatalog(playerId) {
  const [playerRows] = await pool.query('SELECT player_id FROM players WHERE player_id = ? LIMIT 1', [
    playerId,
  ]);
  if (playerRows.length === 0) {
    return { notFound: true };
  }

  const snapshot = await buildPlayerProgressSnapshot(playerId);

  const [configRows] = await pool.query(
    `SELECT achievement_id, achievement_name, chain_id, chain_level,
            unlock_conditions, unlock_conditions_desc, attribute_bonus,
            special_effect_desc, rewards, display_effect
     FROM config_achievements
     ORDER BY achievement_id`,
  );

  const [ownedRows] = await pool.query(
    `SELECT DISTINCT card_id AS achievement_id
     FROM player_cards
     WHERE player_id = ? AND card_type = 'achievement'`,
    [playerId],
  );
  const ownedSet = new Set(ownedRows.map((r) => r.achievement_id));
  const chainIndex = buildAchievementChainIndex(configRows);

  const achievements = configRows.map((row) => {
    const claimStatus = resolveAchievementClaimStatus(row, snapshot, ownedSet, chainIndex);
    const owned = claimStatus === 'owned';
    const progress = buildAchievementCatalogProgress(row, snapshot, owned);
    return {
      achievementId: row.achievement_id,
      achievementName: row.achievement_name || row.achievement_id,
      unlockConditionsDesc: row.unlock_conditions_desc || '—',
      attributeBonus: formatAttributeBonusDisplay(row.attribute_bonus),
      specialEffectDesc: row.special_effect_desc || '—',
      rewards: formatRewardsDisplay(row.rewards),
      displayEffect: row.display_effect?.trim() || '—',
      owned,
      claimStatus,
      chainId: progress.chainId,
      chainLevel: progress.chainLevel,
      progressCurrent: progress.progressCurrent,
      progressTarget: progress.progressTarget,
      progressLabel: progress.progressLabel,
    };
  });

  return { data: { achievements } };
}

module.exports = {
  getPlayerAchievementCatalog,
};
