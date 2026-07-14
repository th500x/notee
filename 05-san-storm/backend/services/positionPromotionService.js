/**
 * 三公府 · 官职晋升：下一品阶列表（声望门槛 + 势力内是否已被占用）
 * 同级切换：Lv1/Lv2 玩家在空席时可切换担任同级另一官职（24h CD，与长效政策谏言通过 CD 一致）
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { grantPositionById, grantPositionOnConnection } = require('./rewardService');
const { CD_AFTER_APPROVED_MS } = require('./factionPolicyDefaults');

const PEER_SWITCH_LEVELS = new Set([1, 2]);

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
      silverBonus: Number(bonuses.silver ?? bonuses.silverBonus ?? 0) || 0,
      infantryBonus: Number(bonuses.infantry ?? bonuses.infantryBonus ?? 0) || 0,
      cavalryBonus: Number(bonuses.cavalry ?? bonuses.cavalryBonus ?? 0) || 0,
      archerBonus: Number(bonuses.archer ?? bonuses.archerBonus ?? 0) || 0,
    },
  };
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} q
 */
async function readPeerSwitchCooldown(q, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return { cooldownActive: false, nextEligibleAt: null, schemaOk: true };
  }
  try {
    await q.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [rows] = await q.query(
      'SELECT san_gong_peer_switch_at FROM player_events WHERE player_id = ?',
      [pid],
    );
    const raw = rows[0]?.san_gong_peer_switch_at;
    if (!raw) {
      return { cooldownActive: false, nextEligibleAt: null, schemaOk: true };
    }
    const eligibleAt = new Date(raw).getTime();
    const active = Number.isFinite(eligibleAt) && eligibleAt > Date.now();
    return {
      cooldownActive: active,
      nextEligibleAt: active ? new Date(eligibleAt).toISOString() : null,
      schemaOk: true,
    };
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_peer_switch_at/i.test(msg)) {
      return { cooldownActive: false, nextEligibleAt: null, schemaOk: false };
    }
    throw e;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function writePeerSwitchCooldown(connection, playerId) {
  const pid = String(playerId || '').trim();
  const next = new Date(Date.now() + CD_AFTER_APPROVED_MS);
  await connection.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  await connection.query(
    'UPDATE player_events SET san_gong_peer_switch_at = ? WHERE player_id = ?',
    [next, pid],
  );
  return next.toISOString();
}

/**
 * @param {object} opts
 * @param {'promote'|'peer'} opts.mode
 */
async function buildPositionEntriesForLevel(opts) {
  const {
    season,
    level,
    factionId,
    playerId,
    reputation,
    cooldownActive = false,
    mode = 'promote',
  } = opts;
  const aiIds = getAiOnlyPositionIds();
  const [posList] = await pool.query(
    `SELECT position_id, position_name, position_level, position_rank, rarity, icon, description, requirement, position_bonuses, permissions
     FROM config_positions
     WHERE season = ? AND position_level = ?
     ORDER BY position_rank ASC`,
    [season, level],
  );
  const rows = (posList || []).filter((r) => !aiIds.has(r.position_id));
  const out = [];

  for (const row of rows) {
    const base = formatPositionCardRow(row);
    const [holders] = await pool.query(
      `SELECT player_id, character_name FROM players WHERE faction_id = ? AND current_position_id = ?`,
      [factionId, row.position_id],
    );
    let occupiedByCharacterName = null;
    let isSelfOccupant = false;
    for (const h of holders || []) {
      if (h.player_id === playerId) {
        isSelfOccupant = true;
      } else {
        occupiedByCharacterName = h.character_name || String(h.player_id);
      }
    }
    const takenByOther = !!occupiedByCharacterName;
    const rep = Number(reputation) || 0;
    const needRep = base.requirementReputation;
    const reputationOk = needRep <= 0 || rep >= needRep;
    const baseOk = !takenByOther && !isSelfOccupant && reputationOk;
    const canPromote = mode === 'promote' && baseOk;
    const canSwitch = mode === 'peer' && baseOk && !cooldownActive;

    out.push({
      positionId: row.position_id,
      position: base,
      requirementReputation: needRep,
      occupiedByCharacterName,
      isSelfOccupant,
      takenByOther,
      reputationOk,
      canPromote,
      canSwitch,
    });
  }

  return out;
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
        sameLevelPositions: [],
        peerSwitchCooldown: { cooldownActive: false, nextEligibleAt: null },
        playerReputation: Number(p.reputation) || 0,
        playerPositionLevel: 8,
        notice: '未加入势力，无法晋升官职',
      },
    };
  }

  const plRaw = p.position_level;
  const pl = plRaw == null || Number.isNaN(Number(plRaw)) ? 8 : Number(plRaw);
  const targetLevel = pl - 1;
  const season = parseSeasonFromFactionId(p.faction_id);
  const fid = p.faction_id;
  const reputation = Number(p.reputation) || 0;

  const peerSwitchCooldown = await readPeerSwitchCooldown(pool, pid);

  let positions = [];
  let notice = null;

  if (targetLevel < 0) {
    notice = '已达最高品阶';
  } else {
    positions = await buildPositionEntriesForLevel({
      season,
      level: targetLevel,
      factionId: fid,
      playerId: pid,
      reputation,
      mode: 'promote',
    });
  }

  let sameLevelPositions = [];
  if (PEER_SWITCH_LEVELS.has(pl)) {
    sameLevelPositions = await buildPositionEntriesForLevel({
      season,
      level: pl,
      factionId: fid,
      playerId: pid,
      reputation,
      mode: 'peer',
      cooldownActive: peerSwitchCooldown.cooldownActive,
    });
  }

  return {
    ok: true,
    data: {
      targetLevel: targetLevel < 0 ? null : targetLevel,
      positions,
      sameLevelPositions,
      peerSwitchCooldown: {
        cooldownActive: peerSwitchCooldown.cooldownActive,
        nextEligibleAt: peerSwitchCooldown.nextEligibleAt,
      },
      playerReputation: reputation,
      playerPositionLevel: pl,
      currentPositionId: p.current_position_id,
      notice,
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

/**
 * @param {string} playerId
 * @param {string} positionId
 */
async function switchPeerPosition(playerId, positionId) {
  const pid = String(playerId || '').trim();
  const posId = String(positionId || '').trim();
  if (!pid || !posId) return { ok: false, status: 400, error: '参数无效' };

  const list = await getPromotionsForPlayer(pid);
  if (!list.ok) return list;

  const pl = list.data.playerPositionLevel;
  if (!PEER_SWITCH_LEVELS.has(pl)) {
    return { ok: false, status: 400, error: '仅一阶或二阶官职可同级切换' };
  }

  const entry = (list.data.sameLevelPositions || []).find((x) => x.positionId === posId);
  if (!entry) {
    return { ok: false, status: 400, error: '该官职不在当前可切换列表中' };
  }
  if (!entry.canSwitch) {
    if (list.data.peerSwitchCooldown?.cooldownActive) {
      return { ok: false, status: 409, error: '同级官职切换仍在冷却中' };
    }
    if (entry.isSelfOccupant) return { ok: false, status: 400, error: '您已担任该官职' };
    if (entry.takenByOther) {
      return {
        ok: false,
        status: 409,
        error: `该官职已由 ${entry.occupiedByCharacterName} 担任`,
      };
    }
    if (!entry.reputationOk) return { ok: false, status: 400, error: '声望不足' };
    return { ok: false, status: 400, error: '暂时无法切换' };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [pLock] = await connection.query(
      'SELECT faction_id, current_position_id, position_level FROM players WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!pLock[0]?.faction_id) {
      await connection.rollback();
      return { ok: false, status: 400, error: '未加入势力，无法切换官职' };
    }
    const plNow = Number(pLock[0].position_level);
    if (!PEER_SWITCH_LEVELS.has(plNow)) {
      await connection.rollback();
      return { ok: false, status: 400, error: '仅一阶或二阶官职可同级切换' };
    }
    if (String(pLock[0].current_position_id || '') === posId) {
      await connection.rollback();
      return { ok: false, status: 400, error: '您已担任该官职' };
    }

    const cd = await readPeerSwitchCooldown(connection, pid);
    if (cd.cooldownActive) {
      await connection.rollback();
      return { ok: false, status: 409, error: '同级官职切换仍在冷却中' };
    }
    if (!cd.schemaOk) {
      await connection.rollback();
      return { ok: false, status: 500, error: '缺少同级切换 CD 列，请执行数据库迁移' };
    }

    const [holders] = await connection.query(
      `SELECT player_id FROM players WHERE faction_id = ? AND current_position_id = ? AND player_id <> ?`,
      [pLock[0].faction_id, posId, pid],
    );
    if (holders.length > 0) {
      await connection.rollback();
      return { ok: false, status: 409, error: '该官职席已被他人占用' };
    }

    const grant = await grantPositionOnConnection(connection, pid, posId);
    if (!grant.ok) {
      await connection.rollback();
      return grant;
    }
    const nextEligibleAt = await writePeerSwitchCooldown(connection, pid);
    await connection.commit();

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
        peerSwitchCooldown: { cooldownActive: true, nextEligibleAt },
      },
    };
  } catch (e) {
    try {
      await connection.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    connection.release();
  }
}

module.exports = {
  getPromotionsForPlayer,
  promotePlayer,
  switchPeerPosition,
  PEER_SWITCH_LEVELS,
};
