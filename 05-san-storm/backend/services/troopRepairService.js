/**
 * 事件道具触发的部队耐久修复（读 config_items.special_effect）
 */

const { pool } = require('../database/connection');

/**
 * @param {string} itemId
 * @returns {Promise<string|null>}
 */
async function getItemSpecialEffect(itemId) {
  if (!itemId) return null;
  const [rows] = await pool.query(
    'SELECT special_effect FROM config_items WHERE item_id = ? LIMIT 1',
    [itemId]
  );
  const v = rows[0]?.special_effect;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * 选出 battle_count 最高的传奇部队实例（最残）；同分取 instance_id 最小。
 * @returns {Promise<{ instance_id: string, card_id: string, battle_count: number, max_battle_count: number, troop_name: string }|null>}
 */
async function findMostWornLegendaryTroop(query, playerId) {
  const [rows] = await query(
    `SELECT pc.instance_id, pc.card_id, COALESCE(pc.battle_count, 0) AS battle_count,
            COALESCE(pc.max_battle_count, 0) AS max_battle_count,
            COALESCE(ct.troop_name, pc.card_id) AS troop_name
     FROM player_cards pc
     LEFT JOIN config_troops ct ON ct.troop_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'troop' AND pc.rarity = 'legendary'
     ORDER BY battle_count DESC, pc.instance_id ASC
     LIMIT 1`,
    [playerId]
  );
  return rows[0] || null;
}

/** 选出 battle_count 最高的核心部队实例（最残）；同分取 instance_id 最小。 */
async function findMostWornCoreTroop(query, playerId) {
  const [rows] = await query(
    `SELECT pc.instance_id, pc.card_id, COALESCE(pc.battle_count, 0) AS battle_count,
            COALESCE(pc.max_battle_count, 0) AS max_battle_count,
            COALESCE(ct.troop_name, pc.card_id) AS troop_name
     FROM player_cards pc
     LEFT JOIN config_troops ct ON ct.troop_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'troop' AND pc.rarity = 'core'
     ORDER BY battle_count DESC, pc.instance_id ASC
     LIMIT 1`,
    [playerId]
  );
  return rows[0] || null;
}

/** config_items.special_effect：传奇耐久修满（兼容旧键名） */
function isLegendaryTroopRepairEffect(effect) {
  return effect === 'repair_min_durability_full_legendary'
    || effect === 'repair_legendary_min_durability_full';
}

/** config_items.special_effect：核心耐久修满（兼容旧键名） */
function isCoreTroopRepairEffect(effect) {
  return effect === 'repair_min_durability_full_core'
    || effect === 'repair_core_min_durability_full';
}

/**
 * repair_min_durability_full_legendary：将上述实例 battle_count 置 0（满耐久）
 * @returns {Promise<{ instanceId: string, cardId: string, troopName: string, previousBattleCount: number }>}
 */
async function applyRepairLegendaryMinDurabilityFull(query, playerId) {
  const target = await findMostWornLegendaryTroop(query, playerId);
  if (!target) {
    const err = new Error('NO_LEGENDARY_TROOP');
    err.code = 'NO_LEGENDARY_TROOP';
    throw err;
  }
  const prev = Number(target.battle_count) || 0;
  await query(
    `UPDATE player_cards SET battle_count = 0 WHERE instance_id = ? AND player_id = ? AND card_type = 'troop'`,
    [target.instance_id, playerId]
  );
  return {
    instanceId: target.instance_id,
    cardId: target.card_id,
    troopName: target.troop_name,
    previousBattleCount: prev,
  };
}

/**
 * repair_min_durability_full_core：将 battle_count 最高的核心部队实例 battle_count 置 0
 */
async function applyRepairCoreMinDurabilityFull(query, playerId) {
  const target = await findMostWornCoreTroop(query, playerId);
  if (!target) {
    const err = new Error('NO_CORE_TROOP');
    err.code = 'NO_CORE_TROOP';
    throw err;
  }
  const prev = Number(target.battle_count) || 0;
  await query(
    `UPDATE player_cards SET battle_count = 0 WHERE instance_id = ? AND player_id = ? AND card_type = 'troop'`,
    [target.instance_id, playerId]
  );
  return {
    instanceId: target.instance_id,
    cardId: target.card_id,
    troopName: target.troop_name,
    previousBattleCount: prev,
  };
}

/**
 * @param {string} effect special_effect 值
 */
async function applyTroopRepairEffect(query, playerId, effect) {
  if (isLegendaryTroopRepairEffect(effect)) {
    return applyRepairLegendaryMinDurabilityFull(query, playerId);
  }
  if (isCoreTroopRepairEffect(effect)) {
    return applyRepairCoreMinDurabilityFull(query, playerId);
  }
  const err = new Error('UNKNOWN_TROOP_REPAIR_EFFECT');
  err.code = 'UNKNOWN_TROOP_REPAIR_EFFECT';
  throw err;
}

/** 仅这些 special_effect 会走部队耐久修复（其它效果留给别模块） */
function isTroopDurabilityRepairEffect(effect) {
  return isLegendaryTroopRepairEffect(effect) || isCoreTroopRepairEffect(effect);
}

module.exports = {
  getItemSpecialEffect,
  findMostWornLegendaryTroop,
  findMostWornCoreTroop,
  applyTroopRepairEffect,
  isTroopDurabilityRepairEffect,
  isLegendaryTroopRepairEffect,
  isCoreTroopRepairEffect,
};
