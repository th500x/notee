/**
 * 上阵编组 Extra（玩法2）· A–D 四套配置持久化
 * 存储于 player_lineup_sets（lineup_scope='extra', city_id=''）。
 * 无玩家行；与 Main（is_equipped）/ 驻地（scope=garrison）全局 instance 互斥。
 * 本阶段不接战斗构建。
 *
 * @module backend/services/lineupExtraService
 */

const { pool } = require('../database/connection');
const {
  CARD_FIELDS,
  SCOPE_EXTRA,
  SCOPE_GARRISON,
  EXTRA_CITY_ID,
} = require('../constants/lineupSets');

const EXTRA_TROOP_FIELDS = ['char1_troop1', 'char1_troop2', 'char2_troop1', 'char2_troop2'];

const MIN_SLOT = 1;
const MAX_SLOT = 4;

function assertSlot(slotNumber) {
  const n = Math.floor(Number(slotNumber));
  if (!Number.isFinite(n) || n < MIN_SLOT || n > MAX_SLOT) {
    return null;
  }
  return n;
}

function mergePayloadWithPrevRow(prevSlot, incoming) {
  if (!prevSlot) return { ...incoming };
  const merged = { ...incoming };
  for (const f of CARD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, f)) {
      merged[f] = prevSlot[f] ?? null;
    }
  }
  return merged;
}

async function getAll(playerId) {
  const [rows] = await pool.query(
    `SELECT * FROM player_lineup_sets
     WHERE player_id = ? AND lineup_scope = ? AND city_id = ?
     ORDER BY lineup_slot`,
    [playerId, SCOPE_EXTRA, EXTRA_CITY_ID],
  );
  return rows;
}

async function getSlot(playerId, slotNumber) {
  const slot = assertSlot(slotNumber);
  if (!slot) return null;
  const [rows] = await pool.query(
    `SELECT * FROM player_lineup_sets
     WHERE player_id = ? AND lineup_scope = ? AND city_id = ? AND lineup_slot = ?`,
    [playerId, SCOPE_EXTRA, EXTRA_CITY_ID, slot],
  );
  return rows[0] || null;
}

/**
 * @param {string} playerId
 * @returns {Promise<Set<string>>}
 */
async function getOccupiedInstanceIds(playerId) {
  const rows = await getAll(playerId);
  const ids = new Set();
  for (const row of rows) {
    for (const f of CARD_FIELDS) {
      if (row[f]) ids.add(String(row[f]));
    }
  }
  return ids;
}

/**
 * 查询给定 instance 是否落在本玩家任意 Extra 套（可选排除某 slot）。
 * @returns {Promise<boolean>}
 */
async function isInstanceInExtra(playerId, instanceId, { excludeSlot = null } = {}) {
  if (!instanceId) return false;
  const orClause = CARD_FIELDS.map((f) => `${f} = ?`).join(' OR ');
  const params = [...CARD_FIELDS.map(() => instanceId), playerId, SCOPE_EXTRA, EXTRA_CITY_ID];
  let sql = `SELECT lineup_slot FROM player_lineup_sets
             WHERE (${orClause}) AND player_id = ?
               AND lineup_scope = ? AND city_id = ?`;
  if (excludeSlot != null) {
    sql += ' AND lineup_slot <> ?';
    params.push(excludeSlot);
  }
  sql += ' LIMIT 1';
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

async function saveSlot(playerId, slotNumber, config) {
  const slot = assertSlot(slotNumber);
  if (!slot) {
    return { success: false, error: '无效的上阵 Extra 槽位（须 1–4）' };
  }

  const prevSlot = await getSlot(playerId, slot);
  const merged = mergePayloadWithPrevRow(prevSlot, config || {});
  const instanceIds = CARD_FIELDS.map((f) => merged[f]).filter(Boolean);

  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');

    // 其它 Extra 套占用
    const extraOr = CARD_FIELDS.map((f) => `e.${f} = pc.instance_id`).join(' OR ');
    const [extraConflicts] = await pool.query(
      `SELECT e.lineup_slot, pc.instance_id
       FROM player_lineup_sets e
       JOIN player_cards pc ON pc.instance_id IN (${placeholders})
       WHERE e.player_id = ? AND e.lineup_scope = ? AND e.city_id = ?
         AND e.lineup_slot <> ?
         AND (${extraOr})`,
      [...instanceIds, playerId, SCOPE_EXTRA, EXTRA_CITY_ID, slot],
    );
    if (extraConflicts.length > 0) {
      return { success: false, error: '卡牌已被其它上阵 Extra 套占用' };
    }

    // Main 上阵
    const [equippedConflicts] = await pool.query(
      `SELECT instance_id FROM player_cards
       WHERE instance_id IN (${placeholders}) AND player_id = ? AND is_equipped = TRUE`,
      [...instanceIds, playerId],
    );
    if (equippedConflicts.length > 0) {
      return { success: false, error: '部分卡牌已在上阵编组 Main 中，请先卸下再配置 Extra' };
    }

    // 驻地
    const garrisonOr = CARD_FIELDS.map((f) => `g.${f} = pc.instance_id`).join(' OR ');
    const [garrisonConflicts] = await pool.query(
      `SELECT g.lineup_slot, g.city_id, pc.instance_id
       FROM player_lineup_sets g
       JOIN player_cards pc ON pc.instance_id IN (${placeholders})
       WHERE g.player_id = ? AND g.lineup_scope = ? AND (${garrisonOr})`,
      [...instanceIds, playerId, SCOPE_GARRISON],
    );
    if (garrisonConflicts.length > 0) {
      return { success: false, error: '部分卡牌已在驻地编组中，请先卸下再配置 Extra' };
    }
  }

  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');
    const [owned] = await pool.query(
      `SELECT instance_id FROM player_cards
       WHERE player_id = ? AND instance_id IN (${placeholders})`,
      [playerId, ...instanceIds],
    );
    if (owned.length !== instanceIds.length) {
      return { success: false, error: '存在不属于本玩家的卡牌实例' };
    }
  }

  const newlyAssignedTroopIds = [
    ...new Set(
      EXTRA_TROOP_FIELDS.map((f) => {
        const nextId = merged[f] || null;
        const prevId = prevSlot?.[f] || null;
        return nextId && nextId !== prevId ? nextId : null;
      }).filter(Boolean),
    ),
  ];
  if (newlyAssignedTroopIds.length > 0) {
    const ph = newlyAssignedTroopIds.map(() => '?').join(',');
    const [exhaustedCore] = await pool.query(
      `SELECT instance_id FROM player_cards
       WHERE player_id = ? AND instance_id IN (${ph})
         AND card_type = 'troop' AND rarity = 'core'
         AND max_battle_count IS NOT NULL
         AND battle_count >= max_battle_count`,
      [playerId, ...newlyAssignedTroopIds],
    );
    if (exhaustedCore.length > 0) {
      return {
        success: false,
        error: '核心(金)部队耐久已耗尽，无法用于上阵 Extra',
      };
    }
  }

  await pool.query(
    `INSERT INTO player_lineup_sets (
      player_id, lineup_scope, city_id, lineup_slot, city_name,
      char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
      char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
      is_active
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
    ON DUPLICATE KEY UPDATE
      char1_card = VALUES(char1_card), char1_equipment_card = VALUES(char1_equipment_card),
      char1_title = VALUES(char1_title), char1_achievement = VALUES(char1_achievement),
      char1_treasure = VALUES(char1_treasure), char1_troop1 = VALUES(char1_troop1), char1_troop2 = VALUES(char1_troop2),
      char2_card = VALUES(char2_card), char2_equipment_card = VALUES(char2_equipment_card),
      char2_title = VALUES(char2_title), char2_achievement = VALUES(char2_achievement),
      char2_treasure = VALUES(char2_treasure), char2_troop1 = VALUES(char2_troop1), char2_troop2 = VALUES(char2_troop2)`,
    [
      playerId,
      SCOPE_EXTRA,
      EXTRA_CITY_ID,
      slot,
      merged.char1_card || null,
      merged.char1_equipment_card || null,
      merged.char1_title || null,
      merged.char1_achievement || null,
      merged.char1_treasure || null,
      merged.char1_troop1 || null,
      merged.char1_troop2 || null,
      merged.char2_card || null,
      merged.char2_equipment_card || null,
      merged.char2_title || null,
      merged.char2_achievement || null,
      merged.char2_treasure || null,
      merged.char2_troop1 || null,
      merged.char2_troop2 || null,
    ],
  );

  return { success: true, lineup: await getSlot(playerId, slot) };
}

async function clearSlot(playerId, slotNumber) {
  const slot = assertSlot(slotNumber);
  if (!slot) {
    return { success: false, error: '无效的上阵 Extra 槽位（须 1–4）' };
  }
  const nullSets = CARD_FIELDS.map((f) => `${f} = NULL`).join(', ');
  await pool.query(
    `UPDATE player_lineup_sets SET ${nullSets}
     WHERE player_id = ? AND lineup_scope = ? AND city_id = ? AND lineup_slot = ?`,
    [playerId, SCOPE_EXTRA, EXTRA_CITY_ID, slot],
  );
  return { success: true };
}

module.exports = {
  CARD_FIELDS,
  MIN_SLOT,
  MAX_SLOT,
  getAll,
  getSlot,
  getOccupiedInstanceIds,
  isInstanceInExtra,
  saveSlot,
  clearSlot,
};
