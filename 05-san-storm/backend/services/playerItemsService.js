/**
 * 玩家背包道具 CRUD（与 /api/players/:playerId/items 行为一致）
 */

const { pool } = require('../database/connection');

async function listItems(playerId) {
  const [rows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  if (rows.length === 0) {
    return { notFound: true };
  }

  let items = {};
  if (rows[0].items) {
    items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
  }

  const itemIds = Object.keys(items);
  let itemConfigs = {};
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    const [configs] = await pool.query(
      `SELECT item_id, item_name, description, item_type, special_effect FROM config_items WHERE item_id IN (${placeholders})`,
      itemIds
    );
    configs.forEach((c) => {
      itemConfigs[c.item_id] = c;
    });
  }

  const itemList = itemIds
    .map((id) => ({
      itemId: id,
      quantity: items[id],
      name: itemConfigs[id]?.item_name || id,
      description: itemConfigs[id]?.description || '',
      itemType: itemConfigs[id]?.item_type || 'event_key',
      specialEffect: itemConfigs[id]?.special_effect || null,
    }))
    .filter((i) => i.quantity > 0);

  return { notFound: false, items: itemList };
}

async function addItem(playerId, itemId, quantity = 1) {
  if (!itemId) return { ok: false, status: 400, error: '缺少 itemId' };

  const [rows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  if (rows.length === 0) return { ok: false, status: 404, error: '玩家不存在' };

  let items = {};
  if (rows[0].items) {
    items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
  }

  items[itemId] = (items[itemId] || 0) + quantity;

  await pool.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), playerId]);

  return { ok: true, itemId, quantity: items[itemId] };
}

async function consumeItem(playerId, itemId, quantity = 1) {
  if (!itemId) return { ok: false, status: 400, error: '缺少 itemId' };

  const [rows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  if (rows.length === 0) return { ok: false, status: 404, error: '玩家不存在' };

  let items = {};
  if (rows[0].items) {
    items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
  }

  const current = items[itemId] || 0;
  if (current < quantity) {
    return {
      ok: false,
      status: 400,
      error: `道具不足，当前持有 ${current}，需要 ${quantity}`,
    };
  }

  items[itemId] = current - quantity;
  if (items[itemId] <= 0) delete items[itemId];

  await pool.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), playerId]);

  return { ok: true, itemId, remaining: items[itemId] || 0 };
}

const USE_ITEM_ERROR_MESSAGE = {
  MISSING_INSTANCE_ID: '请选择要恢复的部队',
  TROOP_NOT_FOUND: '未找到该部队卡',
  TROOP_RARITY_NOT_REPAIRABLE: '仅传奇/核心部队可用部队徽章恢复',
  TROOP_ALREADY_FULL_DURABILITY: '该部队耐久已满',
  PLAYER_NOT_FOUND: '玩家不存在',
  BADGE_INSUFFICIENT: '部队徽章不足',
  ITEM_NOT_USABLE: '该道具不可直接使用',
  AUTO_TROOP_REPAIR_REMOVED: '旧自动整编已停用，请在编组-道具中手动选用部队徽章',
};

/**
 * 编组-道具「使用」：当前仅支持部队徽章 → 指定传奇/核心部队恢复满耐久。
 * @param {string} playerId
 * @param {{ itemId: string, instanceId: string }} body
 */
async function useItem(playerId, body = {}) {
  const itemId = String(body.itemId || '').trim();
  const instanceId = String(body.instanceId || '').trim();
  if (!itemId) return { ok: false, status: 400, error: '缺少 itemId' };

  const {
    getItemSpecialEffect,
    repairSelectedTroopWithBadge,
    isTroopBadgeManualRepairEffect,
    TROOP_BADGE_ITEM_ID,
  } = require('./troopRepairService');

  const effect = await getItemSpecialEffect(itemId);
  if (!isTroopBadgeManualRepairEffect(effect) || itemId !== TROOP_BADGE_ITEM_ID) {
    return { ok: false, status: 400, error: USE_ITEM_ERROR_MESSAGE.ITEM_NOT_USABLE, code: 'ITEM_NOT_USABLE' };
  }
  if (!instanceId) {
    return { ok: false, status: 400, error: USE_ITEM_ERROR_MESSAGE.MISSING_INSTANCE_ID, code: 'MISSING_INSTANCE_ID' };
  }

  try {
    const repair = await repairSelectedTroopWithBadge(playerId, instanceId);
    return { ok: true, repair };
  } catch (e) {
    const code = e.code || 'USE_ITEM_FAILED';
    const status = code === 'PLAYER_NOT_FOUND' ? 404 : 400;
    let error = USE_ITEM_ERROR_MESSAGE[code] || e.message || '使用道具失败';
    if (code === 'BADGE_INSUFFICIENT') {
      error = `部队徽章不足（持有 ${e.have ?? 0}，需要 ${e.need ?? 0}）`;
    }
    return { ok: false, status, error, code, detail: { have: e.have, need: e.need } };
  }
}

module.exports = {
  listItems,
  addItem,
  consumeItem,
  useItem,
};
