/**
 * 编组挂件（称号 / 成就 / 宝物）special_effect → 部队卡 bonus_* 字段
 * 须与 cardTroopSpecialEffect.js 同步
 *
 * 契约：04-2-DATA_TERM_DICTIONARY §1 troop_flat 子集；25-1 / 26-1
 */

const { unwrapConfigSpecialEffectRaw } = require('./configSpecialEffectRaw.cjs');

/** config special_effect key → player_cards.bonus_* 列 */
const CARD_TROOP_SPECIAL_EFFECT_KEYS = {
  max_troops_bonus: 'bonus_max_troops',
  attack_bonus: 'bonus_attack',
  defense_bonus: 'bonus_defense',
  speed_bonus: 'bonus_speed',
  movement_bonus: 'bonus_movement',
};

const CARD_TROOP_EFFECT_CONFIG_TABLES = {
  title: { table: 'config_titles', idField: 'title_id' },
  achievement: { table: 'config_achievements', idField: 'achievement_id' },
  treasure: { table: 'config_treasures', idField: 'treasure_id' },
};

const CARD_TROOP_EFFECT_CARD_TYPES = ['title', 'achievement', 'treasure'];

/**
 * 解析已 unwrap 的标记语言字符串，如 `max_troops_bonus:500;attack_bonus:10`
 * @param {string|null|undefined} effectStr
 * @returns {Record<string, number>}
 */
function parseCardTroopSpecialEffect(effectStr) {
  if (!effectStr) return {};
  const bonus = {};
  effectStr.split(';').forEach((part) => {
    const [key, val] = part.trim().split(':');
    if (!key || val === undefined || val === '') return;
    const field = CARD_TROOP_SPECIAL_EFFECT_KEYS[key.trim()];
    if (field) bonus[field] = parseInt(val, 10) || 0;
  });
  return bonus;
}

/**
 * @param {unknown} rawValue config 表 special_effect 列原值（plain / JSON { raw }）
 */
function parseCardTroopSpecialEffectFromConfigValue(rawValue) {
  return parseCardTroopSpecialEffect(unwrapConfigSpecialEffectRaw(rawValue));
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {'title'|'achievement'|'treasure'|string} cardType
 * @param {string} cardId
 */
async function loadCardTroopSpecialEffectBonus(conn, cardType, cardId) {
  const cfg = CARD_TROOP_EFFECT_CONFIG_TABLES[cardType];
  if (!cfg) return {};
  const [rows] = await conn.query(
    `SELECT special_effect FROM ${cfg.table} WHERE ${cfg.idField} = ?`,
    [cardId],
  );
  return parseCardTroopSpecialEffectFromConfigValue(rows[0]?.special_effect);
}

module.exports = {
  CARD_TROOP_SPECIAL_EFFECT_KEYS,
  CARD_TROOP_EFFECT_CONFIG_TABLES,
  CARD_TROOP_EFFECT_CARD_TYPES,
  parseCardTroopSpecialEffect,
  parseCardTroopSpecialEffectFromConfigValue,
  loadCardTroopSpecialEffectBonus,
};
