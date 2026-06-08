/**
 * 配置卡 ID → card_type / rarity（称号、成就、部队等共用）
 */

const RARITY_FROM_SEQ_DIGIT = {
  1: 'common',
  2: 'rare',
  3: 'epic',
  4: 'legendary',
  5: 'core',
};

/**
 * @param {string} cardId
 * @returns {'troop'|'character'|'title'|'achievement'|'equipment'|null}
 */
function resolveCardTypeFromConfigId(cardId) {
  const id = String(cardId || '').trim();
  if (!id) return null;
  if (id.includes('_troop_')) return 'troop';
  if (id.includes('_char_')) return 'character';
  if (id.includes('_title_')) return 'title';
  if (id.includes('_achi_')) return 'achievement';
  if (id.includes('_equip_')) return 'equipment';
  return null;
}

/**
 * @param {string} cardId
 * @returns {string}
 */
function resolveRarityFromConfigId(cardId) {
  const id = String(cardId || '').trim();
  const parts = id.split('_');
  const seqStr = parts[parts.length - 1] || '';
  const digit = seqStr.charAt(0);
  return RARITY_FROM_SEQ_DIGIT[digit] || 'common';
}

module.exports = {
  resolveCardTypeFromConfigId,
  resolveRarityFromConfigId,
  RARITY_FROM_SEQ_DIGIT,
};
