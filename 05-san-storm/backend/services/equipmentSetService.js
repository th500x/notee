/**
 * 装备卡（equipmentSet）封装：草稿唯一、四槽引用、装备件 bound_equipment_set_instance_id
 * @see docs/20-data-layer/24-1-EQUIPMENT_SYSTEM.md
 */

const { pool } = require('../database/connection');

const SHELL_CARD_ID = 'san_1_equipment_set_shell';

const DATA_KEYS = {
  weapon: 'weapon_instance_id',
  armor: 'armor_instance_id',
  aux_left: 'accessory_1_instance_id',
  aux_right: 'accessory_2_instance_id',
};

const SLOT_BY_KEY = {
  weapon_instance_id: 'weapon',
  armor_instance_id: 'armor',
  accessory_1_instance_id: 'aux_left',
  accessory_2_instance_id: 'aux_right',
};

function emptySetData() {
  return {
    display_name: null,
    weapon_instance_id: null,
    armor_instance_id: null,
    accessory_1_instance_id: null,
    accessory_2_instance_id: null,
  };
}

function parseSetData(raw) {
  if (!raw) return emptySetData();
  let o = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return emptySetData();
    }
  }
  const d = emptySetData();
  Object.assign(d, o);
  // 兼容旧数据中的驼峰字段，并统一归一到 snake_case
  if (!d.display_name && o.displayName) d.display_name = o.displayName;
  if (!d.weapon_instance_id && o.weaponInstanceId) d.weapon_instance_id = o.weaponInstanceId;
  if (!d.armor_instance_id && o.armorInstanceId) d.armor_instance_id = o.armorInstanceId;
  if (!d.accessory_1_instance_id && o.accessory1InstanceId) d.accessory_1_instance_id = o.accessory1InstanceId;
  if (!d.accessory_2_instance_id && o.accessory2InstanceId) d.accessory_2_instance_id = o.accessory2InstanceId;
  return d;
}

function isDraftData(data) {
  const n = data.display_name;
  return n == null || String(n).trim() === '';
}

const equipTypeMap = { 1: 'weapon', 2: 'armor', 3: 'accessory' };
function equipmentTypeFromCardId(cardId) {
  const parts = String(cardId || '').split('_');
  const typeCode = parts[3] || '1';
  return equipTypeMap[Number(typeCode)] || 'weapon';
}

function slotMatchesEquipmentType(slot, equipmentType) {
  if (slot === 'weapon') return equipmentType === 'weapon';
  if (slot === 'armor') return equipmentType === 'armor';
  if (slot === 'aux_left' || slot === 'aux_right') return equipmentType === 'accessory';
  return false;
}

function newSetInstanceId(playerId) {
  return `eset_${playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 草稿行在 Node 侧解析（避免 MariaDB/XAMPP 下 JSON_EXTRACT + JSON_UNQUOTE 与 TEXT/JSON 列组合导致 WHERE 匹配失败，误 INSERT 新空卡）
 */
function draftRowScore(data) {
  return [
    data.weapon_instance_id,
    data.armor_instance_id,
    data.accessory_1_instance_id,
    data.accessory_2_instance_id,
  ].filter(Boolean).length;
}

/**
 * 获取或创建当前玩家的草稿套装（display_name 为空；至多一条草稿逻辑由业务保证）
 */
async function getOrCreateDraftSet(playerId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [allSets] = await conn.query(
      `SELECT *
       FROM player_cards
       WHERE player_id = ? AND card_type = 'equipmentSet'
       ORDER BY obtained_at ASC
       FOR UPDATE`,
      [playerId]
    );

    const drafts = (allSets || [])
      .map((r) => ({ row: r, data: parseSetData(r.equipment_set_data) }))
      .filter(({ data }) => isDraftData(data));

    let row = null;
    if (drafts.length > 0) {
      drafts.sort((a, b) => {
        const sa = draftRowScore(a.data);
        const sb = draftRowScore(b.data);
        if (sb !== sa) return sb - sa;
        return new Date(a.row.obtained_at) - new Date(b.row.obtained_at);
      });
      row = drafts[0].row;
    }

    if (!row) {
      const instanceId = newSetInstanceId(playerId);
      const payload = JSON.stringify(emptySetData());
      await conn.query(
        `INSERT INTO player_cards
         (instance_id, player_id, card_type, card_id, rarity, is_equipped,
          equipment_set_id, equipment_set_data, bound_equipment_set_instance_id)
         VALUES (?, ?, 'equipmentSet', ?, 'common', FALSE, NULL, ?, NULL)`,
        [instanceId, playerId, SHELL_CARD_ID, payload]
      );
      const [again] = await conn.query(
        'SELECT * FROM player_cards WHERE instance_id = ? AND player_id = ?',
        [instanceId, playerId]
      );
      row = again[0];
    }

    await conn.commit();
    return row;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function loadEquipmentCardRow(conn, playerId, instanceId) {
  const [r] = await conn.query(
    `SELECT instance_id, card_id, card_type, rarity, is_equipped, equipped_by, equipped_slot,
            bound_equipment_set_instance_id
     FROM player_cards
     WHERE instance_id = ? AND player_id = ? AND card_type = 'equipment'`,
    [instanceId, playerId]
  );
  return r[0] || null;
}

/**
 * @param {string} playerId
 * @param {string} setInstanceId
 * @param {'weapon'|'armor'|'aux_left'|'aux_right'} slot
 * @param {string|null} equipmentInstanceId
 */
async function assignSlot(playerId, setInstanceId, slot, equipmentInstanceId) {
  if (!DATA_KEYS[slot]) {
    throw Object.assign(new Error('invalid_slot'), { code: 'INVALID_SLOT' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [setRows] = await conn.query(
      `SELECT * FROM player_cards
       WHERE instance_id = ? AND player_id = ? AND card_type = 'equipmentSet'
       FOR UPDATE`,
      [setInstanceId, playerId]
    );
    const setRow = setRows[0];
    if (!setRow) {
      throw Object.assign(new Error('set_not_found'), { code: 'SET_NOT_FOUND' });
    }

    const data = parseSetData(setRow.equipment_set_data);

    const jsonKey = DATA_KEYS[slot];
    const prevId = data[jsonKey] || null;

    if (!equipmentInstanceId) {
      if (!isDraftData(data)) {
        throw Object.assign(new Error('cannot_remove_finalized_slot'), { code: 'CANNOT_REMOVE_FINALIZED_SLOT' });
      }
      if (prevId) {
        await conn.query(
          `UPDATE player_cards SET bound_equipment_set_instance_id = NULL
           WHERE instance_id = ? AND player_id = ?`,
          [prevId, playerId]
        );
      }
      data[jsonKey] = null;
      await conn.query(
        `UPDATE player_cards SET equipment_set_data = ? WHERE instance_id = ?`,
        [JSON.stringify(data), setInstanceId]
      );
      await conn.commit();
      return data;
    }

    const piece = await loadEquipmentCardRow(conn, playerId, equipmentInstanceId);
    if (!piece) {
      throw Object.assign(new Error('equipment_not_found'), { code:'EQUIPMENT_NOT_FOUND' });
    }
    if (piece.is_equipped) {
      throw Object.assign(new Error('equipment_already_equipped'), { code: 'ALREADY_EQUIPPED' });
    }
    const et = equipmentTypeFromCardId(piece.card_id);
    if (!slotMatchesEquipmentType(slot, et)) {
      throw Object.assign(new Error('equipment_type_mismatch'), { code: 'TYPE_MISMATCH' });
    }
    const bound = piece.bound_equipment_set_instance_id;
    if (bound && bound !== setInstanceId) {
      throw Object.assign(new Error('equipment_bound_elsewhere'), { code: 'BOUND_ELSEWHERE' });
    }

    const idKeys = Object.keys(SLOT_BY_KEY);
    for (const k of idKeys) {
      const v = data[k];
      if (k === jsonKey || !v) continue;
      if (v === equipmentInstanceId) {
        throw Object.assign(new Error('duplicate_piece_in_set'), { code: 'DUPLICATE_PIECE' });
      }
    }

    if (prevId && prevId !== equipmentInstanceId) {
      await conn.query(
        `UPDATE player_cards SET bound_equipment_set_instance_id = NULL
         WHERE instance_id = ? AND player_id = ?`,
        [prevId, playerId]
      );
    }

    await conn.query(
      `UPDATE player_cards SET bound_equipment_set_instance_id = ?
       WHERE instance_id = ? AND player_id = ? AND card_type = 'equipment'`,
      [setInstanceId, equipmentInstanceId, playerId]
    );

    data[jsonKey] = equipmentInstanceId;
    await conn.query(
      `UPDATE player_cards SET equipment_set_data = ? WHERE instance_id = ?`,
      [JSON.stringify(data), setInstanceId]
    );

    await conn.commit();
    return data;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function allSlotsFilled(data) {
  return (
    data.weapon_instance_id &&
    data.armor_instance_id &&
    data.accessory_1_instance_id &&
    data.accessory_2_instance_id
  );
}

/** 与 24-2 一致：trim 后 1～12 个 Unicode 码点 */
function normalizeEquipmentSetDisplayName(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const cp = [...s];
  if (cp.length < 1 || cp.length > 12) return null;
  return s;
}

/**
 * 按实例 ID 读取套装行（装备卡）
 */
async function getEquipmentSetById(playerId, setInstanceId) {
  const [rows] = await pool.query(
    `SELECT * FROM player_cards
     WHERE instance_id = ? AND player_id = ? AND card_type = 'equipmentSet'`,
    [setInstanceId, playerId]
  );
  if (!rows[0]) {
    throw Object.assign(new Error('set_not_found'), { code: 'SET_NOT_FOUND' });
  }
  return rows[0];
}

/**
 * 已命名套装重命名（草稿请走 finalize）
 */
async function renameEquipmentSet(playerId, setInstanceId, displayName) {
  const name = normalizeEquipmentSetDisplayName(displayName);
  if (!name) {
    throw Object.assign(new Error('invalid_display_name'), { code: 'INVALID_NAME' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [setRows] = await conn.query(
      `SELECT * FROM player_cards
       WHERE instance_id = ? AND player_id = ? AND card_type = 'equipmentSet'
       FOR UPDATE`,
      [setInstanceId, playerId]
    );
    const setRow = setRows[0];
    if (!setRow) {
      throw Object.assign(new Error('set_not_found'), { code: 'SET_NOT_FOUND' });
    }

    const data = parseSetData(setRow.equipment_set_data);
    if (isDraftData(data)) {
      throw Object.assign(new Error('rename_draft_use_finalize'), { code: 'RENAME_DRAFT_USE_FINALIZE' });
    }

    data.display_name = name;
    await conn.query(
      `UPDATE player_cards SET equipment_set_data = ? WHERE instance_id = ?`,
      [JSON.stringify(data), setInstanceId]
    );

    await conn.commit();
    return data;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function finalizeSet(playerId, setInstanceId, displayName) {
  const name = normalizeEquipmentSetDisplayName(displayName);
  if (!name) {
    throw Object.assign(new Error('invalid_display_name'), { code: 'INVALID_NAME' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [setRows] = await conn.query(
      `SELECT * FROM player_cards
       WHERE instance_id = ? AND player_id = ? AND card_type = 'equipmentSet'
       FOR UPDATE`,
      [setInstanceId, playerId]
    );
    const setRow = setRows[0];
    if (!setRow) {
      throw Object.assign(new Error('set_not_found'), { code: 'SET_NOT_FOUND' });
    }

    const data = parseSetData(setRow.equipment_set_data);
    if (!isDraftData(data)) {
      throw Object.assign(new Error('already_finalized'), { code: 'ALREADY_FINALIZED' });
    }
    if (!allSlotsFilled(data)) {
      throw Object.assign(new Error('slots_incomplete'), { code: 'INCOMPLETE' });
    }

    data.display_name = name;
    await conn.query(
      `UPDATE player_cards SET equipment_set_data = ? WHERE instance_id = ?`,
      [JSON.stringify(data), setInstanceId]
    );

    await conn.commit();
    return data;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  SHELL_CARD_ID,
  DATA_KEYS,
  emptySetData,
  parseSetData,
  isDraftData,
  getOrCreateDraftSet,
  getEquipmentSetById,
  assignSlot,
  renameEquipmentSet,
  finalizeSet,
  allSlotsFilled,
  slotMatchesEquipmentType,
  equipmentTypeFromCardId,
};
