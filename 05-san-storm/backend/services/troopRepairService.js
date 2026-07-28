/**
 * 部队耐久修复（部队徽章 · 编组手动选用）
 * 旧「事件结算自动修最残传奇/核心」已废止。
 */

const { pool } = require('../database/connection');
const {
  TROOP_BADGE_ITEM_ID,
  TROOP_BADGE_SPECIAL_EFFECT,
  troopBadgeRepairCostForRarity,
  isTroopBadgeManualRepairEffect,
} = require('../../shared/utils/troopBadgeDurabilityRepair.cjs');

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
 * 指定实例：须为本玩家传奇/核心部队，且 battle_count > 0（未满耐久）。
 * @returns {Promise<{ instanceId: string, cardId: string, troopName: string, rarity: string, previousBattleCount: number, maxBattleCount: number, cost: number }>}
 */
async function repairSelectedTroopWithBadge(playerId, instanceId) {
  const iid = String(instanceId || '').trim();
  if (!iid) {
    const err = new Error('MISSING_INSTANCE_ID');
    err.code = 'MISSING_INSTANCE_ID';
    throw err;
  }

  const [rows] = await pool.query(
    `SELECT pc.instance_id, pc.card_id, pc.rarity,
            COALESCE(pc.battle_count, 0) AS battle_count,
            COALESCE(pc.max_battle_count, 0) AS max_battle_count,
            COALESCE(ct.troop_name, pc.card_id) AS troop_name
     FROM player_cards pc
     LEFT JOIN config_troops ct ON ct.troop_id = pc.card_id
     WHERE pc.player_id = ? AND pc.instance_id = ? AND pc.card_type = 'troop'
     LIMIT 1`,
    [playerId, iid]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error('TROOP_NOT_FOUND');
    err.code = 'TROOP_NOT_FOUND';
    throw err;
  }
  const rarity = String(row.rarity || '').toLowerCase();
  const cost = troopBadgeRepairCostForRarity(rarity);
  if (cost == null) {
    const err = new Error('TROOP_RARITY_NOT_REPAIRABLE');
    err.code = 'TROOP_RARITY_NOT_REPAIRABLE';
    throw err;
  }
  const prev = Number(row.battle_count) || 0;
  if (prev <= 0) {
    const err = new Error('TROOP_ALREADY_FULL_DURABILITY');
    err.code = 'TROOP_ALREADY_FULL_DURABILITY';
    throw err;
  }

  const [itemRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  if (!itemRows[0]) {
    const err = new Error('PLAYER_NOT_FOUND');
    err.code = 'PLAYER_NOT_FOUND';
    throw err;
  }
  let items = {};
  if (itemRows[0].items) {
    items =
      typeof itemRows[0].items === 'string' ? JSON.parse(itemRows[0].items) : itemRows[0].items;
  }
  const have = Number(items[TROOP_BADGE_ITEM_ID]) || 0;
  if (have < cost) {
    const err = new Error('BADGE_INSUFFICIENT');
    err.code = 'BADGE_INSUFFICIENT';
    err.have = have;
    err.need = cost;
    throw err;
  }

  items[TROOP_BADGE_ITEM_ID] = have - cost;
  if (items[TROOP_BADGE_ITEM_ID] <= 0) delete items[TROOP_BADGE_ITEM_ID];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE players SET items = ? WHERE player_id = ?', [
      JSON.stringify(items),
      playerId,
    ]);
    const [upd] = await conn.query(
      `UPDATE player_cards SET battle_count = 0
       WHERE instance_id = ? AND player_id = ? AND card_type = 'troop'
         AND COALESCE(battle_count, 0) > 0`,
      [iid, playerId]
    );
    if (!upd.affectedRows) {
      await conn.rollback();
      const err = new Error('TROOP_ALREADY_FULL_DURABILITY');
      err.code = 'TROOP_ALREADY_FULL_DURABILITY';
      throw err;
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }

  return {
    instanceId: row.instance_id,
    cardId: row.card_id,
    troopName: row.troop_name,
    rarity,
    previousBattleCount: prev,
    maxBattleCount: Number(row.max_battle_count) || 0,
    cost,
    badgeItemId: TROOP_BADGE_ITEM_ID,
    remainingBadges: Number(items[TROOP_BADGE_ITEM_ID]) || 0,
  };
}

module.exports = {
  getItemSpecialEffect,
  repairSelectedTroopWithBadge,
  isTroopBadgeManualRepairEffect,
  TROOP_BADGE_ITEM_ID,
  TROOP_BADGE_SPECIAL_EFFECT,
  // 兼容旧 import 名：一律视为非「事件结算自动整编」
  isTroopDurabilityRepairEffect: () => false,
  isLegendaryTroopRepairEffect: () => false,
  isCoreTroopRepairEffect: () => false,
  applyTroopRepairEffect: async () => {
    const err = new Error('AUTO_TROOP_REPAIR_REMOVED');
    err.code = 'AUTO_TROOP_REPAIR_REMOVED';
    throw err;
  },
};
