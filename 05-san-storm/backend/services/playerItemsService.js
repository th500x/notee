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

module.exports = {
  listItems,
  addItem,
  consumeItem,
};
