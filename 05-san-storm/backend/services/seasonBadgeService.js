/**
 * 赛季徽章发放（players.items JSON，与事件奖励道具同列）
 *
 * 原属 campaignService；战役系统 2026-08-04 归档后独立于此，供匪寨等玩法复用。
 * @see docs/01-strategic-world/10-core-system/17-7-BANDIT_SYSTEM.md
 */

const { pool } = require('../database/connection');
const playerItemsService = require('./playerItemsService');

/** 当前赛季徽章道具（黄巾徽章）；换赛季时改此常量 */
const SEASON_BADGE_ITEM_ID = 'item_badge_season';

async function getItemDisplayName(itemId) {
  if (!itemId) return null;
  const [rows] = await pool.query('SELECT item_name FROM config_items WHERE item_id = ? LIMIT 1', [itemId]);
  return rows[0]?.item_name || itemId;
}

/**
 * @param {string} playerId
 * @param {number} [quantity]
 * @returns {Promise<{ ok: boolean, error?: string, badge?: { itemId: string, quantity: number, displayName: string|null } }>}
 */
async function grantSeasonBadgeToPlayer(playerId, quantity = 1) {
  const q = Math.max(1, Math.floor(Number(quantity)) || 1);
  const addRes = await playerItemsService.addItem(playerId, SEASON_BADGE_ITEM_ID, q);
  if (!addRes.ok) return { ok: false, error: addRes.error || 'badge grant failed' };
  const displayName = await getItemDisplayName(SEASON_BADGE_ITEM_ID);
  return { ok: true, badge: { itemId: SEASON_BADGE_ITEM_ID, quantity: q, displayName } };
}

module.exports = {
  SEASON_BADGE_ITEM_ID,
  grantSeasonBadgeToPlayer,
};
