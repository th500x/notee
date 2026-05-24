/**
 * 三公府 · 官职晋升：下一品阶列表（声望门槛 + 势力内是否已被占用）
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { grantPositionById } = require('./rewardService');

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
    console.warn('[positionPromotionService] positions.json:', e.message);
  }
  return aiPositionIdsCache;
}

function parseSeasonFromFactionId(factionId) {
  if (!factionId || typeof factionId !== 'string') return 'san_1';
  const parts = factionId.split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : 'san_1';
}

function formatPositionCardRow(row) {
  let bonuses = {};
  try {
    bonuses = typeof row.position_bonuses === 'string' ? JSON.parse(row.position_bonuses) : (row.position_bonuses || {});
  } catch {
    bonuses = {};
  }
  let perms = [];
  try {
    perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || []);
  } catch {
    perms = [];
  }
  const repNeed = Number(row.requirement) || 0;
  return {
    id: row.position_id,
    name: row.position_name,
    level: row.position_level,
    rank: row.position_rank,
    rarity: row.rarity || 'common',
    icon: row.icon,
    description: row.description,
    /** 与 playerProfileService.position_config 一致，供 PositionCard 展示「晋升要求」 */
    requirement: row.requirement,
    permissions: Array.isArray(perms) ? perms : [],
    requirementReputation: repNeed,
    position_bonuses: {
      reputationBonus: Number(bonuses.reputation ?? bonuses.reputationBonus ?? 0) || 0,
      contributionBonus: Number(bonuses.contribution ?? bonuses.contributionBonus ?? 0) || 0,
      resourceBonus: Number(bonuses.resource ?? bonuses.resourceBonus ?? 0) || 0,
      infantryBonus: Number(bonuses.infantry ?? bonuses.infantryBonus ?? 0) || 0,
      cavalryBonus: Number(bonuses.cavalry ?? bonuses.cavalryBonus ?? 0) || 0,
      archerBonus: Number(bonuses.archer ?? bonuses.archerBonus ?? 0) || 0,
    },
  };
}

/**
 * @param {string} playerId
 */
async function getPromotionsForPlayer(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const [pRows] = await pool.query(
    `SELECT player_id, faction_id, reputation, position_level, current_position_id, character_name
     FROM players WHERE player_id = ? LIMIT 1`,
    [pid],
  );
  if (!pRows[0]) return { ok: false, status: 404, error: '玩家不存在' };
  const p = pRows[0];
  if (!p.faction_id) {
    return {
      ok: true,
      data: {
        targetLevel: null,
        positions: [],
        playerReputation: Number(p.reputation) || 0,
        playerPositionLevel: 8,
        notice: '未加入势力，无法晋升官职',
      },
    };
  }

  const plRaw = p.position_level;
  const pl = plRaw == null || Number.isNaN(Number(plRaw)) ? 8 : Number(plRaw);
  const targetLevel = pl - 1;
  if (targetLevel < 0) {
    return {
      ok: true,
      data: {
        targetLevel: null,
        positions: [],
        playerReputation: Number(p.reputation) || 0,
        playerPositionLevel: pl,
        notice: '已达最高品阶',
      },
    };
  }

  const season = parseSeasonFromFactionId(p.faction_id);
  const aiIds = getAiOnlyPositionIds();
  const [posList] = await pool.query(
    `SELECT position_id, position_name, position_level, position_rank, rarity, icon, description, requirement, position_bonuses, permissions
     FROM config_positions
     WHERE season = ? AND position_level = ?
     ORDER BY position_rank ASC`,
    [season, targetLevel],
  );

  const rows = (posList || []).filter((r) => !aiIds.has(r.position_id));
  const fid = p.faction_id;
  const out = [];

  for (const row of rows) {
    const base = formatPositionCardRow(row);
    const [holders] = await pool.query(
      `SELECT player_id, character_name FROM players WHERE faction_id = ? AND current_position_id = ?`,
      [fid, row.position_id],
    );
    let occupiedByCharacterName = null;
    let isSelfOccupant = false;
    for (const h of holders || []) {
      if (h.player_id === pid) {
        isSelfOccupant = true;
      } else {
        occupiedByCharacterName = h.character_name || String(h.player_id);
      }
    }
    const takenByOther = !!occupiedByCharacterName;
    const rep = Number(p.reputation) || 0;
    const needRep = base.requirementReputation;
    const reputationOk = needRep <= 0 || rep >= needRep;
    const canPromote = !takenByOther && !isSelfOccupant && reputationOk;

    out.push({
      positionId: row.position_id,
      position: base,
      requirementReputation: needRep,
      occupiedByCharacterName,
      isSelfOccupant,
      takenByOther,
      reputationOk,
      canPromote,
    });
  }

  return {
    ok: true,
    data: {
      targetLevel,
      positions: out,
      playerReputation: Number(p.reputation) || 0,
      playerPositionLevel: pl,
      currentPositionId: p.current_position_id,
    },
  };
}

/**
 * @param {string} playerId
 * @param {string} positionId
 */
async function promotePlayer(playerId, positionId) {
  const pid = String(playerId || '').trim();
  const posId = String(positionId || '').trim();
  if (!pid || !posId) return { ok: false, status: 400, error: '参数无效' };

  const list = await getPromotionsForPlayer(pid);
  if (!list.ok) return list;

  const entry = list.data.positions.find((x) => x.positionId === posId);
  if (!entry) {
    return { ok: false, status: 400, error: '该官职不在当前可晋升列表中' };
  }
  if (!entry.canPromote) {
    if (entry.isSelfOccupant) return { ok: false, status: 400, error: '您已担任该官职' };
    if (entry.takenByOther) {
      return {
        ok: false,
        status: 409,
        error: `该官职已由 ${entry.occupiedByCharacterName} 担任`,
      };
    }
    if (!entry.reputationOk) return { ok: false, status: 400, error: '声望不足' };
    return { ok: false, status: 400, error: '暂时无法晋升' };
  }

  const grant = await grantPositionById(pid, posId);
  if (!grant.ok) return grant;

  const [fullRows] = await pool.query(
    `SELECT position_id, position_name, position_level, position_rank, rarity, icon, description, requirement, position_bonuses, permissions
     FROM config_positions WHERE position_id = ? LIMIT 1`,
    [posId],
  );
  const position = fullRows[0] ? formatPositionCardRow(fullRows[0]) : null;

  return {
    ok: true,
    data: {
      ...grant.detail,
      position,
    },
  };
}

module.exports = {
  getPromotionsForPlayer,
  promotePlayer,
};
