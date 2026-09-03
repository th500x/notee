/**
 * 事件奖励 · 官职随机池（与 random:troop:* 同构：配表 token → 结算时从 config 池抽取）
 *
 * 使用 .cjs：shared/package.json 为 "type":"module"，.js 按 ESM 解析，后端 require 须 CommonJS。
 *
 * 语法：random:position:level:{N}
 *   N = config_positions.position_level（如 7 = 都尉品阶）
 */

'use strict';

const fs = require('fs');
const path = require('path');

let aiPositionIdsCache = null;

function getAiOnlyPositionIds() {
  if (aiPositionIdsCache) return aiPositionIdsCache;
  aiPositionIdsCache = new Set();
  try {
    const fp = path.join(__dirname, '../../public/data/shared/positions.json');
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const p of j.positions || []) {
      const req = String(p.requirement || '').trim().toUpperCase();
      if (req === 'AI' || req === 'KING_DAILY') {
        aiPositionIdsCache.add(p.id);
      }
    }
  } catch (e) {
    console.warn('[eventPositionRewardPools] positions.json:', e.message);
  }
  return aiPositionIdsCache;
}

/**
 * @param {string|null|undefined} factionId
 * @returns {string}
 */
function parseSeasonFromFactionId(factionId) {
  if (!factionId || typeof factionId !== 'string') return 'san_1';
  const parts = factionId.split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : 'san_1';
}

/**
 * @param {string} token - 如 random:position:level:7
 * @returns {{ positionLevel: number } | null}
 */
function parseRandomPositionRewardToken(token) {
  const t = String(token || '').trim();
  if (!t.startsWith('random:position:')) return null;
  const parts = t.split(':');
  if (parts[1] !== 'position' || parts[2] !== 'level') return null;
  const positionLevel = parseInt(parts[3], 10);
  if (!Number.isFinite(positionLevel)) return null;
  return { positionLevel };
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {{ factionId?: string|null, positionLevel: number }} opts
 * @returns {Promise<string|null>}
 */
async function drawRandomPositionByLevel(connection, opts) {
  const positionLevel = Number(opts.positionLevel);
  if (!Number.isFinite(positionLevel)) return null;

  const season = parseSeasonFromFactionId(opts.factionId);
  const aiIds = getAiOnlyPositionIds();

  const [posList] = await connection.query(
    `SELECT position_id, requirement
     FROM config_positions
     WHERE season = ? AND position_level = ?
     ORDER BY position_rank ASC`,
    [season, positionLevel],
  );

  const pool = (posList || []).filter((row) => {
    if (aiIds.has(row.position_id)) return false;
    const req = String(row.requirement || '').trim().toUpperCase();
    if (req === 'AI' || req === 'KING_DAILY') return false;
    return true;
  });

  if (pool.length === 0) {
    console.warn(
      `[eventPositionRewardPools] 官职池为空 season=${season} position_level=${positionLevel}`,
    );
    return null;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.position_id;
}

module.exports = {
  parseSeasonFromFactionId,
  parseRandomPositionRewardToken,
  drawRandomPositionByLevel,
  getAiOnlyPositionIds,
};
