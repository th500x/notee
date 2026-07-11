/**
 * 个人中心「称号」页：全量配置 + 玩家是否持有
 *
 * @see docs/00/20-data-layer/25-1-TITLE_SYSTEM.md
 */

const { pool } = require('../database/connection');
const { formatAttributeBonusDisplay } = require('../utils/catalogDisplayFormat');

/**
 * @param {string} playerId
 * @returns {Promise<{ notFound: true } | { data: { titles: object[] } }>}
 */
async function getPlayerTitleCatalog(playerId) {
  const [playerRows] = await pool.query('SELECT player_id FROM players WHERE player_id = ? LIMIT 1', [
    playerId,
  ]);
  if (playerRows.length === 0) {
    return { notFound: true };
  }

  const [configRows] = await pool.query(
    `SELECT title_id, title_name, unlock_conditions_desc, attribute_bonus, special_effect_desc
     FROM config_titles
     ORDER BY title_id`,
  );

  const [ownedRows] = await pool.query(
    `SELECT DISTINCT card_id AS title_id
     FROM player_cards
     WHERE player_id = ? AND card_type = 'title'`,
    [playerId],
  );
  const ownedSet = new Set(ownedRows.map((r) => r.title_id));

  const titles = configRows.map((row) => ({
    titleId: row.title_id,
    titleName: row.title_name || row.title_id,
    unlockConditionsDesc: row.unlock_conditions_desc || '—',
    attributeBonus: formatAttributeBonusDisplay(row.attribute_bonus),
    specialEffectDesc: row.special_effect_desc || '—',
    owned: ownedSet.has(row.title_id),
  }));

  return { data: { titles } };
}

module.exports = {
  getPlayerTitleCatalog,
  formatAttributeBonusDisplay,
};
