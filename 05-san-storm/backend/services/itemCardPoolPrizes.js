/**
 * 道具卡池奖品表与发放（13-3 · poolType=item）
 *
 * 权重为万分比：固定 12.2% + 粮草两项均分剩余 → 4390/4390。
 */

const { getInitialUsesRemaining, parseTreasureIdParts } = require('../../shared/utils/treasureUses.cjs');

/** @typedef {{ id: string, label: string, weight: number, kind: string, amount?: number, band?: number, itemId?: string }} ItemPoolPrizeDef */

/** @type {ItemPoolPrizeDef[]} */
const ITEM_POOL_PRIZES = [
  { id: 'treasure_4xxx', label: '随机传奇宝物×1', weight: 100, kind: 'treasure_band', band: 4 },
  { id: 'treasure_5xxx', label: '随机核心宝物×1', weight: 10, kind: 'treasure_band', band: 5 },
  { id: 'badge_x1', label: '黄巾徽章×1', weight: 100, kind: 'item', itemId: 'item_season_badge', amount: 1 },
  { id: 'token_x1', label: '兵符×1', weight: 500, kind: 'item', itemId: 'item_token', amount: 1 },
  { id: 'jade_x1', label: '玉牌×1', weight: 500, kind: 'item', itemId: 'item_jade', amount: 1 },
  { id: 'food_150', label: '粮草×150', weight: 4390, kind: 'food', amount: 150 },
  { id: 'badge_x20', label: '黄巾徽章×20', weight: 10, kind: 'item', itemId: 'item_season_badge', amount: 20 },
  { id: 'food_200', label: '粮草×200', weight: 4390, kind: 'food', amount: 200 },
];

const TOTAL_WEIGHT = ITEM_POOL_PRIZES.reduce((s, p) => s + p.weight, 0);

function listItemPoolPrizesForStatus() {
  return ITEM_POOL_PRIZES.map((p) => ({
    id: p.id,
    label: p.label,
    weight: p.weight,
    chancePercent: Math.round((p.weight / TOTAL_WEIGHT) * 1000) / 10,
  }));
}

/**
 * @returns {ItemPoolPrizeDef}
 */
function rollItemPrize() {
  let roll = Math.floor(Math.random() * TOTAL_WEIGHT);
  for (const prize of ITEM_POOL_PRIZES) {
    if (roll < prize.weight) return prize;
    roll -= prize.weight;
  }
  return ITEM_POOL_PRIZES[ITEM_POOL_PRIZES.length - 1];
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {number} band 4 | 5
 */
async function pickRandomTreasureId(connection, band) {
  const like = `%_treasure_${band}___`;
  const [rows] = await connection.query(
    `SELECT treasure_id, treasure_name FROM config_treasures
     WHERE treasure_id LIKE ?
     ORDER BY RAND() LIMIT 1`,
    [like],
  );
  if (!rows.length) {
    throw new Error(`道具卡池：无可用 ${band}xxx 宝物配置`);
  }
  return { treasureId: rows[0].treasure_id, treasureName: rows[0].treasure_name };
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string} itemId
 * @param {number} quantity
 */
async function addItemOnConnection(connection, playerId, itemId, quantity) {
  const [rows] = await connection.query(
    'SELECT items FROM players WHERE player_id = ? FOR UPDATE',
    [playerId],
  );
  if (!rows.length) throw new Error('玩家不存在');
  let items = {};
  if (rows[0].items) {
    items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : { ...rows[0].items };
  }
  items[itemId] = (items[itemId] || 0) + quantity;
  await connection.query('UPDATE players SET items = ? WHERE player_id = ?', [
    JSON.stringify(items),
    playerId,
  ]);
  let name = itemId;
  const [cfg] = await connection.query(
    'SELECT item_name FROM config_items WHERE item_id = ?',
    [itemId],
  );
  if (cfg[0]?.item_name) name = cfg[0].item_name;
  return { itemId, name, quantity: items[itemId], granted: quantity };
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {ItemPoolPrizeDef} prize
 */
async function grantItemPrize(connection, playerId, prize) {
  if (prize.kind === 'food') {
    const amount = Math.max(0, Math.floor(Number(prize.amount) || 0));
    await connection.query('UPDATE players SET food = food + ? WHERE player_id = ?', [
      amount,
      playerId,
    ]);
    return {
      prizeId: prize.id,
      prizeLabel: prize.label,
      kind: 'food',
      amount,
      displayName: `粮草×${amount}`,
      rarity: 'common',
      cardId: `food:${amount}`,
      cardName: `粮草×${amount}`,
      compensated: false,
    };
  }

  if (prize.kind === 'item') {
    const amount = Math.max(1, Math.floor(Number(prize.amount) || 1));
    const granted = await addItemOnConnection(connection, playerId, prize.itemId, amount);
    return {
      prizeId: prize.id,
      prizeLabel: prize.label,
      kind: 'item',
      itemId: granted.itemId,
      amount,
      displayName: `${granted.name}×${amount}`,
      rarity: 'common',
      cardId: `${granted.itemId}:${amount}`,
      cardName: `${granted.name}×${amount}`,
      compensated: false,
    };
  }

  if (prize.kind === 'treasure_band') {
    const { treasureId, treasureName } = await pickRandomTreasureId(connection, prize.band);
    const { rarity } = parseTreasureIdParts(treasureId);
    const instanceId = `${treasureId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const usesRemaining = getInitialUsesRemaining(treasureId);
    await connection.query('INSERT INTO player_cards SET ?', [
      {
        instance_id: instanceId,
        player_id: playerId,
        card_type: 'treasure',
        card_id: treasureId,
        rarity: rarity || (prize.band === 5 ? 'core' : 'legendary'),
        uses_remaining: usesRemaining,
      },
    ]);
    return {
      prizeId: prize.id,
      prizeLabel: prize.label,
      kind: 'treasure',
      cardId: treasureId,
      cardName: treasureName,
      instanceId,
      displayName: treasureName,
      rarity: rarity || (prize.band === 5 ? 'core' : 'legendary'),
      compensated: false,
    };
  }

  throw new Error(`未知道具卡池奖品类型: ${prize.kind}`);
}

module.exports = {
  ITEM_POOL_PRIZES,
  TOTAL_WEIGHT,
  listItemPoolPrizesForStatus,
  rollItemPrize,
  grantItemPrize,
};
