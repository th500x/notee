/**
 * 官职 · 战斗兵种加成（步/骑/弓 %）归一化与装配。
 * 与 calcDamage / siegeCombatCore 中 character.positionBonuses 字段契约一致。
 *
 * 使用 .cjs：shared 为 ESM 包，后端 require 须 CommonJS。
 * 游戏前端须用 `game/src/utils/positionCombatBonuses.js`（ESM），勿直接 import 本文件。
 */

'use strict';

/**
 * @param {object|null|undefined} raw position_bonuses（API camelCase）或 DB JSON（reputation/infantry 等 snake）
 * @returns {{ infantryBonus: number, cavalryBonus: number, archerBonus: number }|null}
 */
function normalizePositionCombatBonuses(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const infantry = Number(raw.infantryBonus ?? raw.infantry ?? 0) || 0;
  const cavalry = Number(raw.cavalryBonus ?? raw.cavalry ?? 0) || 0;
  const archer = Number(raw.archerBonus ?? raw.archer ?? 0) || 0;
  if (infantry === 0 && cavalry === 0 && archer === 0) return null;
  return { infantryBonus: infantry, cavalryBonus: cavalry, archerBonus: archer };
}

/**
 * @param {object|null|undefined} charData
 * @param {object|null|undefined} bonuses
 * @returns {object|null|undefined}
 */
function attachPositionCombatBonuses(charData, bonuses) {
  const norm = normalizePositionCombatBonuses(bonuses);
  if (!norm || !charData) return charData;
  return { ...charData, positionBonuses: norm };
}

/**
 * @param {object|null|undefined} player profile 行或 context player（含 position_config）
 * @returns {object|null}
 */
function getPositionCombatBonusesFromPlayer(player) {
  const pb = player?.position_config?.position_bonuses;
  return normalizePositionCombatBonuses(pb);
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} poolConn
 * @param {string} playerId
 * @returns {Promise<object|null>}
 */
async function loadPositionCombatBonusesForPlayer(poolConn, playerId) {
  if (!playerId) return null;
  const [rows] = await poolConn.query(
    `SELECT cp.position_bonuses
     FROM players p
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id
     WHERE p.player_id = ?
     LIMIT 1`,
    [playerId],
  );
  if (!rows.length || !rows[0].position_bonuses) return null;
  const raw = rows[0].position_bonuses;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return normalizePositionCombatBonuses(parsed);
}

module.exports = {
  normalizePositionCombatBonuses,
  attachPositionCombatBonuses,
  getPositionCombatBonusesFromPlayer,
  loadPositionCombatBonusesForPlayer,
};
