/**
 * 编组 / 驻地「军营」与主城驻军所共用的部队池判定（未上阵、未在驻地槽、次数规则、排除驻军所仓库）
 */

const { pool } = require('../database/connection');
const garrisonService = require('./garrisonService');

const GARRISON_CARD_FIELDS = [
  'char1_card',
  'char1_equipment_card',
  'char1_title',
  'char1_achievement',
  'char1_treasure',
  'char1_troop1',
  'char1_troop2',
  'char2_card',
  'char2_equipment_card',
  'char2_title',
  'char2_achievement',
  'char2_treasure',
  'char2_troop1',
  'char2_troop2',
];

function collectOccupiedInstanceIds(rows) {
  const ids = new Set();
  for (const g of rows || []) {
    for (const f of GARRISON_CARD_FIELDS) {
      const v = g[f];
      if (v) ids.add(String(v));
    }
  }
  return ids;
}

/**
 * @param {string} playerId
 * @returns {Promise<string[]>}
 */
async function getEligibleBarracksTroopInstanceIds(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return [];

  const rows = await garrisonService.getPlayerGarrisons(pid);
  const occupied = collectOccupiedInstanceIds(rows);

  const [troops] = await pool.query(
    `SELECT instance_id, battle_count, max_battle_count, rarity
     FROM player_cards
     WHERE player_id = ?
       AND card_type = 'troop'
       AND IFNULL(is_equipped, 0) = 0
       AND IFNULL(main_city_barracks_storage, 0) = 0`,
    [pid],
  );

  const out = [];
  for (const r of troops || []) {
    const iid = r.instance_id != null ? String(r.instance_id) : '';
    if (!iid || occupied.has(iid)) continue;
    const maxB = Number(r.max_battle_count) || 10;
    const bc = Math.max(0, Number(r.battle_count) || 0);
    if (bc < maxB || String(r.rarity) === 'legendary') out.push(iid);
  }
  return out;
}

/**
 * @param {string} playerId
 * @returns {Promise<string[]>}
 */
async function getEligibleBarracksCharacterInstanceIds(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return [];

  const rows = await garrisonService.getPlayerGarrisons(pid);
  const occupied = collectOccupiedInstanceIds(rows);

  const [characters] = await pool.query(
    `SELECT instance_id
     FROM player_cards
     WHERE player_id = ?
       AND card_type = 'character'
       AND IFNULL(is_equipped, 0) = 0
       AND IFNULL(main_city_barracks_storage, 0) = 0`,
    [pid],
  );

  const out = [];
  for (const r of characters || []) {
    const iid = r.instance_id != null ? String(r.instance_id) : '';
    if (!iid || occupied.has(iid)) continue;
    out.push(iid);
  }
  return out;
}

module.exports = {
  getEligibleBarracksTroopInstanceIds,
  getEligibleBarracksCharacterInstanceIds,
};
