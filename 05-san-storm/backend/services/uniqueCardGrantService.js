/**
 * 唯一配置卡发放：称号 / 成就等同 ID 仅一张（与 rewardService 事件奖励同源规则）
 *
 * @see docs/20-data-layer/25-1-TITLE_SYSTEM.md §6.1
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §8
 */

const {
  resolveCardTypeFromConfigId,
  resolveRarityFromConfigId,
} = require('../utils/configCardId');

const CONFIG_NAME_QUERIES = {
  title: {
    table: 'config_titles',
    idField: 'title_id',
    nameField: 'title_name',
  },
  achievement: {
    table: 'config_achievements',
    idField: 'achievement_id',
    nameField: 'achievement_name',
  },
};

/**
 * @param {*} connection
 * @param {string} playerId
 * @param {string} cardType
 * @param {string} cardId
 * @param {object[]} details
 * @param {string|null} [cardName]
 * @returns {Promise<boolean>} true = 已持有（重复丢弃）
 */
async function checkUniqueCardDuplicate(connection, playerId, cardType, cardId, details, cardName = null) {
  const [existing] = await connection.query(
    'SELECT instance_id FROM player_cards WHERE player_id = ? AND card_id = ? AND card_type = ? LIMIT 1',
    [playerId, cardId, cardType],
  );
  if (!existing.length) return false;
  if (Array.isArray(details)) {
    details.push({
      type: 'card_duplicate',
      cardType,
      cardId,
      cardName: cardName || cardId,
      discarded: true,
    });
  }
  console.log(`[uniqueCardGrant] ${cardType} 重复: ${cardId} → 已丢弃`);
  return true;
}

/**
 * @param {*} connection
 * @param {string} cardType
 * @param {string} cardId
 * @returns {Promise<string>}
 */
async function resolveConfigCardDisplayName(connection, cardType, cardId) {
  const meta = CONFIG_NAME_QUERIES[cardType];
  if (!meta) return cardId;
  const [rows] = await connection.query(
    `SELECT ${meta.nameField} AS name FROM ${meta.table} WHERE ${meta.idField} = ? LIMIT 1`,
    [cardId],
  );
  return rows[0]?.name || cardId;
}

/**
 * 发放称号或成就配置卡（须在同事务 connection 内调用）
 *
 * @param {*} connection
 * @param {{ playerId: string, cardId: string, details?: object[] }} p
 * @returns {Promise<{ granted: boolean, discarded: boolean, instanceId?: string, cardType?: string, cardName?: string }>}
 */
async function grantUniqueTitleOrAchievementCard(connection, p) {
  const playerId = String(p.playerId || '').trim();
  const cardId = String(p.cardId || '').trim();
  const details = Array.isArray(p.details) ? p.details : [];

  if (!playerId || !cardId) {
    return { granted: false, discarded: false };
  }

  const cardType = resolveCardTypeFromConfigId(cardId);
  if (cardType !== 'title' && cardType !== 'achievement') {
    console.warn('[uniqueCardGrant] 非称号/成就 ID，拒绝发放:', cardId);
    return { granted: false, discarded: false };
  }

  const cardName = await resolveConfigCardDisplayName(connection, cardType, cardId);
  const isDuplicate = await checkUniqueCardDuplicate(
    connection,
    playerId,
    cardType,
    cardId,
    details,
    cardName,
  );
  if (isDuplicate) {
    return { granted: false, discarded: true, cardType, cardName };
  }

  const rarity = resolveRarityFromConfigId(cardId);
  const instanceId = `${cardId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await connection.query('INSERT INTO player_cards SET ?', {
    instance_id: instanceId,
    player_id: playerId,
    card_type: cardType,
    card_id: cardId,
    rarity,
  });
  details.push({ type: 'card', cardType, cardId, cardName, instanceId });
  return { granted: true, discarded: false, instanceId, cardType, cardName };
}

module.exports = {
  checkUniqueCardDuplicate,
  grantUniqueTitleOrAchievementCard,
  resolveConfigCardDisplayName,
};
