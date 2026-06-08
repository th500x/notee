/**
 * PVE 中立城攻城 · 攻方大本营（复用 PVP 选位/NPC 逻辑，写入 `wars.attacker_base_camps`）。
 *
 * 结构：`{ [attackerFactionId]: baseCampJson }`，与 `wars_pvp.base_camp` 单对象形一致。
 *
 * @module services/pveWarBaseCampService
 */

const { pool } = require('../database/connection');
const cityService = require('./cityService');

function parseAttackerBaseCamps(raw) {
  if (!raw) return {};
  let obj = raw;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return {};
    }
  }
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
}

function parseFactionKills(raw) {
  if (!raw) return {};
  let obj = raw;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return {};
    }
  }
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
}

/**
 * 为 PVE 战事中某攻方势力确保大本营已落位（幂等）。
 *
 * @param {string} warId
 * @param {string} attackerFactionId
 * @returns {Promise<object>} baseCamp
 */
async function ensurePveAttackerBaseCamp(warId, attackerFactionId) {
  const wid = String(warId || '').trim();
  const fid = String(attackerFactionId || '').trim();
  if (!wid || !fid) {
    throw new Error('[pveWarBaseCamp] 缺 warId 或 attackerFactionId');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT war_id, target_city_id, status, attacker_base_camps
         FROM wars WHERE war_id = ? FOR UPDATE`,
      [wid],
    );
    if (!rows.length) throw new Error('[pveWarBaseCamp] 战事不存在');
    if (rows[0].status !== 'active') {
      throw new Error('[pveWarBaseCamp] 仅 active 战事可落大本营');
    }

    const camps = parseAttackerBaseCamps(rows[0].attacker_base_camps);
    const existing = camps[fid];
    if (existing && Array.isArray(existing.cells) && existing.cells.length) {
      await conn.commit();
      return existing;
    }

    const city = await cityService.getCityInfo(rows[0].target_city_id);
    if (!city) throw new Error('[pveWarBaseCamp] 目标城不存在');

    const pvpWarService = require('./pvpWarService');
    const baseCamp = await pvpWarService.createBaseCampJsonForCity(city, `${wid}:${fid}`, {
      excludePveWarId: wid,
    });
    camps[fid] = {
      ...baseCamp,
      attackerFactionId: fid,
      pveWarId: wid,
      targetCityId: rows[0].target_city_id,
    };

    await conn.query('UPDATE wars SET attacker_base_camps = ? WHERE war_id = ?', [
      JSON.stringify(camps),
      wid,
    ]);
    await conn.commit();
    console.log(`[pveWarBaseCamp] placed warId=${wid} faction=${fid} cells=${baseCamp.cells?.length || 0}`);
    return camps[fid];
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 补建：对 `faction_kills`（或 `battles.pve_siege` 参与势力）中尚无大本营的键落营。
 */
async function listAttackerFactionIdsForPveWar(warId, factionKillsRaw) {
  const ids = new Set();
  const fk = parseFactionKills(factionKillsRaw);
  for (const fid of Object.keys(fk)) {
    const f = String(fid || '').trim();
    if (f) ids.add(f);
  }
  if (ids.size) return [...ids];
  const wid = String(warId || '').trim();
  if (!wid) return [];
  const [rows] = await pool.query(
    `SELECT DISTINCT p.faction_id AS factionId
       FROM battles b
       INNER JOIN players p ON p.player_id = b.player_id
      WHERE b.war_id = ? AND b.battle_type = 'pve_siege'
        AND p.faction_id IS NOT NULL AND TRIM(p.faction_id) <> ''`,
    [wid],
  );
  for (const r of rows || []) {
    const f = String(r.factionId || '').trim();
    if (f) ids.add(f);
  }
  return [...ids];
}

async function backfillPveCampsForWarRow(warRow) {
  const wid = warRow?.war_id || warRow?.warId;
  if (!wid) return 0;
  const camps = parseAttackerBaseCamps(warRow.attacker_base_camps);
  const factionIds = await listAttackerFactionIdsForPveWar(
    wid,
    warRow.faction_kills || warRow.factionKillsRaw,
  );
  let placed = 0;
  for (const fid of factionIds) {
    const bc = camps[fid];
    if (bc && Array.isArray(bc.cells) && bc.cells.length) continue;
    try {
      await ensurePveAttackerBaseCamp(wid, fid);
      placed += 1;
    } catch (e) {
      console.warn(`[pveWarBaseCamp] backfill skip warId=${wid} faction=${fid}: ${e.message}`);
    }
  }
  return placed;
}

/**
 * 存量 active PVE 战事补建大本营（启动 / 定时 tick / 地图 API 共用）。
 * @param {{ season?: string }} [opts]
 * @returns {Promise<{ wars: number, placed: number }>}
 */
async function backfillAllActivePveBaseCamps(opts = {}) {
  const season = opts.season != null ? String(opts.season).trim() : '';
  let rows;
  if (season) {
    [rows] = await pool.query(
      `SELECT w.war_id, w.faction_kills, w.attacker_base_camps
         FROM wars w
         INNER JOIN cities c ON c.city_id = w.target_city_id
        WHERE w.status = 'active' AND w.war_type = 'siege' AND c.season = ?
        LIMIT 200`,
      [season],
    );
  } else {
    [rows] = await pool.query(
      `SELECT war_id, faction_kills, attacker_base_camps
         FROM wars WHERE status = 'active' AND war_type = 'siege'
        LIMIT 200`,
    );
  }
  let placed = 0;
  for (const row of rows || []) {
    placed += await backfillPveCampsForWarRow(row);
  }
  return { wars: (rows || []).length, placed };
}

/**
 * 大地图渲染：展平为与 PVP `listWars` 大本营切片同形（`pvpWarId` 字段填 PVE `warId` 供行军/footprint）。
 *
 * @param {{ season?: string }} [opts]
 * @returns {Promise<Array<object>>}
 */
async function listActivePveBaseCampsForMap(opts = {}) {
  const season = String(opts.season || 'san_1').trim() || 'san_1';
  await backfillAllActivePveBaseCamps({ season });
  const [rows] = await pool.query(
    `SELECT w.war_id, w.target_city_id, w.target_city_name, w.faction_kills, w.attacker_base_camps,
            c.season, c.jun_id
       FROM wars w
       INNER JOIN cities c ON c.city_id = w.target_city_id
      WHERE w.status = 'active' AND w.war_type = 'siege' AND c.season = ?
      LIMIT 200`,
    [season],
  );

  const out = [];
  for (const row of rows || []) {
    const camps = parseAttackerBaseCamps(row.attacker_base_camps);
    for (const [fid, bc] of Object.entries(camps)) {
      if (!bc || !Array.isArray(bc.cells) || !bc.cells.length) continue;
      out.push({
        ...bc,
        kind: 'pve',
        pvpWarId: row.war_id,
        pveWarId: row.war_id,
        warId: row.war_id,
        attackerFactionId: fid,
        targetCityId: row.target_city_id,
        targetCityName: row.target_city_name || null,
        defenderFactionId: null,
        status: 'active',
        npcAlive: bc.npcAlive ?? bc.npcTotal ?? 0,
        npcTotal: bc.npcTotal ?? 0,
      });
    }
  }
  return out;
}

/**
 * 按 warId + 玩家势力解析 PVE 大本营（行军终点校验）。
 */
async function resolvePveBaseCampForMarch(warId, playerFactionId) {
  const wid = String(warId || '').trim();
  const fid = String(playerFactionId || '').trim();
  if (!wid || !fid) return null;
  const [rows] = await pool.query(
    `SELECT war_id, target_city_id, status, attacker_base_camps, faction_kills
       FROM wars WHERE war_id = ? AND status = 'active' LIMIT 1`,
    [wid],
  );
  if (!rows.length) return null;
  let camps = parseAttackerBaseCamps(rows[0].attacker_base_camps);
  let bc = camps[fid];
  if (!bc?.cells?.length) {
    try {
      bc = await ensurePveAttackerBaseCamp(wid, fid);
    } catch {
      return null;
    }
  }
  return {
    baseCamp: bc,
    attackerFactionId: fid,
    targetCityId: rows[0].target_city_id,
  };
}

module.exports = {
  parseAttackerBaseCamps,
  ensurePveAttackerBaseCamp,
  backfillPveCampsForWarRow,
  backfillAllActivePveBaseCamps,
  listActivePveBaseCampsForMap,
  resolvePveBaseCampForMarch,
};
