/**
 * 宝物使用次数 — 与 26-1-TREASURE_SYSTEM 一致
 * 须与 treasureUses.js 同步
 */

const TREASURE_MAX_USES_BY_RARITY_DIGIT = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: null,
};

const RARITY_DIGIT_TO_ENUM = {
  1: 'common',
  2: 'rare',
  3: 'epic',
  4: 'legendary',
  5: 'core',
};

function parseTreasureIdParts(treasureId) {
  const match = String(treasureId || '').match(/^(san_\d+)_treasure_(\d)(\d{3})$/);
  if (!match) {
    return { season: null, rarityDigit: null, rarity: 'common', seq: null };
  }
  const rarityDigit = Number(match[2]);
  return {
    season: match[1],
    rarityDigit,
    rarity: RARITY_DIGIT_TO_ENUM[rarityDigit] || 'common',
    seq: match[3],
  };
}

function getTreasureMaxUsesFromCardId(cardId) {
  const { rarityDigit } = parseTreasureIdParts(cardId);
  if (!rarityDigit) return null;
  return TREASURE_MAX_USES_BY_RARITY_DIGIT[rarityDigit] ?? null;
}

function isPermanentTreasureCardId(cardId) {
  return getTreasureMaxUsesFromCardId(cardId) == null;
}

function getInitialUsesRemaining(cardId) {
  const maxUses = getTreasureMaxUsesFromCardId(cardId);
  return maxUses == null ? null : maxUses;
}

module.exports = {
  TREASURE_MAX_USES_BY_RARITY_DIGIT,
  parseTreasureIdParts,
  getTreasureMaxUsesFromCardId,
  isPermanentTreasureCardId,
  getInitialUsesRemaining,
};
