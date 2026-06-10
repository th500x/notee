/**
 * 宝物战斗助阵：装备 `battle_ally:*` 宝物时，开战前由服务端随机传奇将领 + 部队。
 * @see docs/20-data-layer/26-1-TREASURE_SYSTEM.md §6.4
 * @module services/battleTreasureAllyService
 */

const { pool } = require('../database/connection');
const { pathToFileURL } = require('url');
const path = require('path');
const { parseBattleTreasureAllySpec } = require('../../shared/utils/battleTreasureAllyEffect.cjs');
const { buildBattleAllyNpcUnit } = require('../../shared/utils/battleAllyNpcUnit.cjs');

const DEFAULT_SEASON = 'san_1';
const LINEUP_SLOT_TO_GARRISON_CHAR = {
  player: null,
  character1: 'char1',
  character2: 'char2',
};

async function loadSmallMapEnemyRosterEsm() {
  const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
  return import(pathToFileURL(filePath).href);
}

/**
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
function parseEquippedByList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {string[]} slots
 */
async function loadMainLineupTreasureCardIds(conn, playerId, slots) {
  if (!slots.length) return [];
  const ph = slots.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT DISTINCT card_id FROM player_cards
     WHERE player_id = ? AND card_type = 'treasure'
       AND is_equipped = TRUE AND equipped_slot = 'treasure'
       AND equipped_by IN (${ph})`,
    [playerId, ...slots],
  );
  return rows.map((r) => r.card_id).filter(Boolean);
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {string} cityId
 * @param {number|string} garrisonSlot
 * @param {string[]} slots
 */
async function loadGarrisonTreasureCardIds(conn, playerId, cityId, garrisonSlot, slots) {
  if (!cityId || garrisonSlot == null || !slots.length) return [];
  const [gRows] = await conn.query(
    `SELECT char1_treasure, char2_treasure FROM player_garrison
     WHERE player_id = ? AND city_id = ? AND garrison_slot = ? LIMIT 1`,
    [playerId, cityId, garrisonSlot],
  );
  const row = gRows[0];
  if (!row) return [];

  const instanceIds = [];
  for (const slot of slots) {
    const charKey = LINEUP_SLOT_TO_GARRISON_CHAR[slot];
    if (!charKey) continue;
    const inst = row[`${charKey}_treasure`];
    if (inst) instanceIds.push(inst);
  }
  if (instanceIds.length === 0) return [];

  const ph = instanceIds.map(() => '?').join(',');
  const [cards] = await conn.query(
    `SELECT DISTINCT card_id FROM player_cards
     WHERE player_id = ? AND card_type = 'treasure' AND instance_id IN (${ph})`,
    [playerId, ...instanceIds],
  );
  return cards.map((r) => r.card_id).filter(Boolean);
}

/**
 * @param {string[]} cardIds
 * @param {object[]} configRows
 */
function filterBattleAllyTreasureIds(cardIds, configRows) {
  const byId = new Map(configRows.map((r) => [r.treasure_id, r]));
  const out = [];
  for (const id of cardIds) {
    const row = byId.get(id);
    if (row && parseBattleTreasureAllySpec(row.special_effect)) out.push(id);
  }
  return [...new Set(out)];
}

/**
 * @param {{ charRarity: string, troopRarity: string, troopCount: number }} spec
 * @param {object[]} allChars
 * @param {object[]} allTroops
 * @param {object} sm
 * @param {number} startIndex
 */
function rollTreasureAllyGroup(spec, allChars, allTroops, sm, startIndex) {
  let commander = sm.pickRandomCharacterByRarity(allChars, spec.charRarity);
  if (!commander) commander = sm.pickRandomCharacterByRarity(allChars, 'legendary');
  if (!commander) return [];

  const units = [];
  let idx = startIndex;
  for (let i = 0; i < spec.troopCount; i += 1) {
    let troop = sm.pickRandomTroopByRarity(allTroops, spec.troopRarity);
    if (!troop) troop = sm.pickRandomTroopByRarity(allTroops, 'legendary');
    if (!troop) break;
    const unit = buildBattleAllyNpcUnit({
      characterRow: commander,
      troopRow: troop,
      index: idx,
      sourceFlags: { treasureBattleAlly: true },
    });
    if (unit) {
      units.push(unit);
      idx += 1;
    }
  }
  return units;
}

/**
 * @param {string} playerId
 * @param {{ equippedBy?: string|string[], garrisonCityId?: string, garrisonSlot?: number|string }} [opts]
 * @returns {Promise<object[]>}
 */
async function buildBattleTreasureAllies(playerId, opts = {}) {
  if (!playerId) return [];

  const slots = parseEquippedByList(
    Array.isArray(opts.equippedBy) ? opts.equippedBy.join(',') : opts.equippedBy,
  );
  if (slots.length === 0) return [];

  const mainIds = await loadMainLineupTreasureCardIds(pool, playerId, slots);
  let garrisonIds = [];
  if (opts.garrisonCityId && opts.garrisonSlot != null) {
    garrisonIds = await loadGarrisonTreasureCardIds(
      pool,
      playerId,
      opts.garrisonCityId,
      opts.garrisonSlot,
      slots,
    );
  }

  const candidateIds = [...new Set([...mainIds, ...garrisonIds])];
  if (candidateIds.length === 0) return [];

  const ph = candidateIds.map(() => '?').join(',');
  const [configRows] = await pool.query(
    `SELECT treasure_id, special_effect FROM config_treasures WHERE treasure_id IN (${ph})`,
    candidateIds,
  );
  const battleAllyIds = filterBattleAllyTreasureIds(candidateIds, configRows);
  if (battleAllyIds.length === 0) return [];

  const sm = await loadSmallMapEnemyRosterEsm();
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [DEFAULT_SEASON]);
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [DEFAULT_SEASON]);
  if (!troops.length) return [];

  const allies = [];
  let index = 9100;
  for (const treasureId of battleAllyIds) {
    const cfg = configRows.find((r) => r.treasure_id === treasureId);
    const spec = parseBattleTreasureAllySpec(cfg?.special_effect);
    if (!spec) continue;
    const group = rollTreasureAllyGroup(spec, chars, troops, sm, index);
    allies.push(...group);
    index += group.length;
  }
  return allies;
}

module.exports = {
  buildBattleTreasureAllies,
  parseEquippedByList,
};
