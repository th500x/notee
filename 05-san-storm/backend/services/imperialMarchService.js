/**
 * 御驾亲征（11-3 §6 · 实装段3）
 *
 * 战事期内 1h 墙钟：攻方对 **NPC / 驻地守军**（非披挂 PVP）出击时，
 * 在 `initiateAttackerCitySiege` 响应中附带一支 **友军** 单位 — 君主为指挥将领、
 * 部队为势力可抽池内 **legendary** 随机一支。
 *
 * @module services/imperialMarchService
 */

const { pool } = require('../database/connection');
const aiKingConfigService = require('./aiKingConfigService');
const factionPolicyService = require('./factionPolicyService');
const { pathToFileURL } = require('url');
const path = require('path');

async function loadSmallMapEnemyRosterEsm() {
  const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
  return import(pathToFileURL(filePath).href);
}

function parseFactionTroopPool(factionId) {
  const m = String(factionId || '').match(/_faction_(\d+)/);
  let factionNumber = '0';
  if (m) {
    const nz = m[1].replace(/^0+/, '');
    factionNumber = nz ? nz.charAt(0) : '0';
  }
  return { season: 'san_1', factionNumber };
}

/**
 * @param {{ imperialMarch?: boolean, imperialMarchExpiresAt?: Date|string|null }} policiesRow
 * @param {number} [nowMs]
 */
function isImperialMarchActive(policiesRow, nowMs = Date.now()) {
  if (!policiesRow?.imperialMarch) return false;
  const exp = policiesRow.imperialMarchExpiresAt;
  if (!exp) return false;
  const t = exp instanceof Date ? exp.getTime() : new Date(exp).getTime();
  return Number.isFinite(t) && nowMs < t;
}

/**
 * 从 config 表组装御驾友军（单支 legendary + 君主 character）。
 *
 * @param {string} factionId
 * @returns {Promise<object|null>}
 */
async function buildImperialMarchSiegeAlly(factionId) {
  const king = aiKingConfigService.getKingByFactionId(factionId);
  const kingCharId = king.characterId || king.character_id;
  if (!kingCharId) return null;

  const sm = await loadSmallMapEnemyRosterEsm();
  const { season } = parseFactionTroopPool(factionId);

  const [charRows] = await pool.query(
    'SELECT * FROM config_characters WHERE season = ? AND character_id = ? LIMIT 1',
    [season, kingCharId],
  );
  const kingChar = charRows[0];
  if (!kingChar) {
    console.warn(`[imperialMarch] 君主角色 ${kingCharId} 不在 config_characters`);
    return null;
  }

  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [season]);
  const troopPool = sm.filterTroopsByFactionId(troops, factionId);
  const recruitEff = await factionPolicyService.getEffectiveRecruit(factionId);
  let extendedPool = troopPool;
  if (recruitEff.enabled && recruitEff.san0Band) {
    const san0Like = troops.filter((t) => {
      const id = String(t.troop_id || '');
      return id.startsWith(`san_0_troop_${recruitEff.san0Band}`);
    });
    extendedPool = [...troopPool, ...san0Like];
  }
  const san1Common = troops.filter((t) => {
    const id = String(t.troop_id || '');
    return id.startsWith('san_1_troop_0');
  });
  const merged = [...extendedPool, ...san1Common];
  let troop = sm.pickRandomTroopByRarity(merged, 'legendary');
  if (!troop) troop = sm.pickRandomTroopByRarity(troops, 'legendary');
  if (!troop) return null;

  const displayName = king.characterName || king.character_name || kingChar.character_name;
  return {
    index: 9000,
    troopId: troop.troop_id,
    troopName: troop.troop_name,
    rarity: troop.rarity,
    maxTroops: troop.max_troops,
    currentTroops: troop.max_troops,
    attack: troop.attack,
    defense: troop.defense,
    speed: troop.speed,
    movement: troop.movement,
    attackRange: troop.attack_range,
    troopType: troop.troop_type,
    weaponType: troop.weapon_type,
    alive: true,
    imperialMarch: true,
    character: {
      characterId: kingChar.character_id,
      name: displayName,
      courtesyName: kingChar.courtesy_name || displayName,
      rarity: kingChar.rarity,
      luck: kingChar.luck,
      courage: kingChar.courage,
      combat: kingChar.combat,
      command: kingChar.command,
      intelligence: kingChar.intelligence,
      politics: kingChar.politics,
      charm: kingChar.charm,
      traitModifier: kingChar.trait_modifier || 0,
    },
  };
}

/**
 * 对 `initiateAttackerCitySiege` 响应附加御驾友军（仅 NPC / 驻地，非披挂）。
 *
 * @param {object} payload
 * @param {object} war
 * @param {object|null} policiesRow
 */
async function attachImperialMarchToSiegePayload(payload, war, policiesRow) {
  if (!payload || !policiesRow) return payload;
  if (payload.defenderType === 'pvp_online') return payload;
  if (!isImperialMarchActive(policiesRow)) return payload;
  try {
    const ally = await buildImperialMarchSiegeAlly(war.attackerFactionId);
    if (ally) payload.imperialMarchAlly = ally;
  } catch (e) {
    console.error('[imperialMarch] attach:', e.message);
  }
  return payload;
}

module.exports = {
  isImperialMarchActive,
  buildImperialMarchSiegeAlly,
  attachImperialMarchToSiegePayload,
};
