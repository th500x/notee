/**
 * 玩家档案拉取时：若 `road_position_*` 已落在「地图上不再存在的立足格」
 *（典型：下线前站在攻方大本营格，战事结束后营寨已清空），
 * 则写入本郡 **最近己方城锚格**（与 `roadBattleRetreatPlacement` / PVP 终局迁离同源）。
 *
 * PVP `wars_pvp.base_camp` 与 PVE `wars.attacker_base_camps` 在战事进行中均为合法立足点，
 * 须在叠图郡 alternate **早失败**之前识别，避免颍川/汝南同坐标误判改郡。
 *
 * 与 `pvpWarPlayerRelocationService.relocateAttackersOffPvpBaseCamp` 互补：后者在终局事务内迁离在线/同进程玩家；
 * 本模块兜底 **已离线** 或 **迁离逻辑未命中**（例如占格键世界行 Y 与库不一致）的残留坐标。
 */

const {
  loadRoadGrid,
  loadRoadGridSan1YuVerticalStack,
  isSan1YuStackRoadJunId,
} = require('../utils/roadGrid');
const marchPoi = require('../../shared/utils/strategicMarchPoi.js');
const {
  applyFactionPlayerRoadRetreat,
  applyRandomJunBattlefieldStand,
} = require('../utils/roadBattleRetreatPlacement');
const {
  playerRoadToWorldMapCell,
  worldMapCellKey,
  worldMapCellKeyFromPlayerRoadLocal,
} = require('../../shared/utils/strategicGridCoordinates.js');
const { readJunBattlefieldAtGrid } = require('../../shared/utils/junBattlefieldCell.cjs');

const NOTICE_STALE_STAND =
  '此前战事已结束或地图目标已变更，原立足格已不可用，已为您移至本郡距此最近的己方城池。'.slice(0, 510);

/**
 * 路点郡/坐标与叠图不一致：只弹窗 + 日志，**禁止**只改 `road_jun_id` 不改 x/y
 *（`san-storm-road-stand-no-silent-repair` / 31-6）。
 */
const NOTICE_JUN_COORD_MISMATCH = (storedJun, altJun, rx, ry) =>
  `路点数据异常：档案郡为「${storedJun}」，但坐标 (${rx},${ry}) 仅在叠图「${altJun}」合法。服务端未改郡/坐标，请从主城重新出征。`
    .slice(0, 510);

const NOTICE_STAND_UNREPAIRABLE = (junId, rx, ry, detail) =>
  `路点数据异常：在郡「${junId}」坐标 (${rx},${ry}) 无法立足，且无法迁回己方城或郡战场入口（${detail}）。请从主城重新出征或联系管理。`
    .slice(0, 510);

async function fetchCitiesInJun(conn, season, junId) {
  const j = String(junId || '').trim();
  const s = String(season || 'san_1').trim();
  if (!j) return [];
  const [rows] = await conn.query(
    `SELECT city_id, city_name, position_x, position_y, jun_id, faction_id, city_type, season
     FROM cities WHERE jun_id = ? AND season = ?`,
    [j, s],
  );
  return rows || [];
}

async function fetchCitiesForRoadGrid(conn, season, junId, grid) {
  if (grid?.isSan1YuVerticalStack && Array.isArray(grid.stackJunIds) && grid.stackJunIds.length >= 2) {
    const s = String(season || 'san_1').trim();
    const [rows] = await conn.query(
      `SELECT city_id, city_name, position_x, position_y, jun_id, faction_id, city_type, season
       FROM cities WHERE season = ? AND jun_id IN (?, ?)`,
      [s, grid.stackJunIds[0], grid.stackJunIds[1]],
    );
    return rows || [];
  }
  return fetchCitiesInJun(conn, season, junId);
}

async function loadRoadGridForJun(season, junId) {
  const s = String(season || 'san_1').trim();
  const j = String(junId || '').trim();
  if (isSan1YuStackRoadJunId(j)) {
    const stacked = await loadRoadGridSan1YuVerticalStack(s);
    if (stacked && stacked.source !== 'none' && stacked.rawCells?.length) return stacked;
  }
  return loadRoadGrid(s, j);
}

function parseBaseCampJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function localCellMatchesBaseCampJson(bc, roadJunId, selfLocal, selfWorld) {
  if (!bc || typeof bc !== 'object') return false;
  if (Array.isArray(bc.worldCellKeys)) {
    for (const wk of bc.worldCellKeys) {
      const s = String(wk || '').trim().replace(/\s/g, '');
      if (s && s === selfWorld) return true;
    }
  }
  const bj = String(bc.junId || '').trim();
  if (bj === roadJunId && Array.isArray(bc.cells)) {
    for (const ck of bc.cells) {
      const s = String(ck || '').trim().replace(/\s/g, '');
      if (s && s === selfLocal) return true;
    }
  }
  return false;
}

/**
 * 当前格是否落在 **pending/active** PVP `base_camp` 或 active PVE `attacker_base_camps` 攻方本营占格上。
 */
async function cellTouchesActiveAttackerBaseCamp(conn, roadJunId, lx, ly) {
  const j = String(roadJunId || '').trim();
  const tx = Math.trunc(Number(lx));
  const ty = Math.trunc(Number(ly));
  if (!j || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;

  const selfLocal = `${tx},${ty}`;
  const selfWorld = worldMapCellKeyFromPlayerRoadLocal(j, tx, ty);

  const [pvpRows] = await conn.query(
    `SELECT base_camp FROM wars_pvp WHERE status IN ('pending','active') AND base_camp IS NOT NULL`,
  );
  for (const r of pvpRows || []) {
    if (localCellMatchesBaseCampJson(parseBaseCampJson(r.base_camp), j, selfLocal, selfWorld)) {
      return true;
    }
  }

  const [pveRows] = await conn.query(
    `SELECT attacker_base_camps FROM wars
       WHERE status = 'active' AND war_type = 'siege' AND attacker_base_camps IS NOT NULL`,
  );
  for (const r of pveRows || []) {
    const camps = parseBaseCampJson(r.attacker_base_camps);
    if (!camps || typeof camps !== 'object' || Array.isArray(camps)) continue;
    for (const bc of Object.values(camps)) {
      if (localCellMatchesBaseCampJson(bc, j, selfLocal, selfWorld)) return true;
    }
  }
  return false;
}

/**
 * 在 **已 FOR UPDATE 锁定** 的 `players` 行上评估；若需修复则在本连接内 UPDATE 并返回应合并回档案对象的字段。
 * @param {*} conn
 * @param {object} pl - `players` 行（至少含 player_id, road_jun_id, road_position_x/y, faction_id）
 * @returns {Promise<{ road_jun_id?: string, road_position_x: number|null, road_position_y: number|null, road_client_notice: string|null }|null>}
 */
async function evaluateAndRepairLockedPlayer(conn, pl) {
  const pid = String(pl.player_id || '').trim();
  const junId = String(pl.road_jun_id || '').trim();
  if (!pid || !junId) return null;

  const rx = Number(pl.road_position_x);
  const ry = Number(pl.road_position_y);
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;

  const season = 'san_1';
  const grid = await loadRoadGridForJun(season, junId);
  if (grid.source === 'none' || !grid.rawCells?.length) return null;

  const pass = marchPoi.buildRoadPassableKeySetForMarch(
    grid.roadCellsRaw,
    grid.rawCells,
    grid.mapColumns,
    grid.mapRows,
  );
  const countyRows = await fetchCitiesForRoadGrid(conn, season, junId, grid);

  const isStandValidAtWorld = (ew) => {
    if (!ew) return false;
    const kk = worldMapCellKey(ew.gx, ew.worldGy);
    if (pass.has(kk)) return true;
    if (readJunBattlefieldAtGrid(grid.rawCells, ew.gx, ew.worldGy)) return true;
    if (
      marchPoi.resolvePoiFootprintAtCellFromDb(
        countyRows,
        ew.gx,
        ew.worldGy,
        grid.mapColumns,
        grid.mapRows,
        grid.rawCells,
      )
    ) {
      return true;
    }
    const fpKeys = marchPoi.findPoiFootprintKeysContainingCell(
      grid.rawCells,
      ew.gx,
      ew.worldGy,
      grid.mapColumns,
      grid.mapRows,
    );
    return !!fpKeys?.size;
  };

  const evalWorld = playerRoadToWorldMapCell(junId, rx, ry);
  if (!evalWorld) return null;
  if (isStandValidAtWorld(evalWorld)) return null;

  // 须在叠图郡 alternate 早失败之前：PVE/PVP 本营占格非道路/静态 POI，但仍是合法立足点。
  if (await cellTouchesActiveAttackerBaseCamp(conn, junId, rx, ry)) return null;

  // 同 x/y 在叠图另一郡合法 ≠ 可静默改郡：早失败 + 可见 notice，不 UPDATE road_jun_id。
  if (grid?.isSan1YuVerticalStack && Array.isArray(grid.stackJunIds) && grid.stackJunIds.length >= 2) {
    for (const tryJun of grid.stackJunIds) {
      const tj = String(tryJun || '').trim();
      if (!tj || tj === junId) continue;
      const ewAlt = playerRoadToWorldMapCell(tj, rx, ry);
      if (!isStandValidAtWorld(ewAlt)) continue;
      const notice = NOTICE_JUN_COORD_MISMATCH(junId, tj, rx, ry);
      console.error('[staleStrategicRoadStandRepair] jun/coord mismatch — refuse silent jun flip:', {
        pid,
        storedJun: junId,
        altJun: tj,
        rx,
        ry,
      });
      await conn.query(
        `UPDATE players SET road_client_notice = ?, road_updated_at = NOW() WHERE player_id = ?`,
        [notice, pid],
      );
      return { road_client_notice: notice };
    }
  }

  const r = await applyFactionPlayerRoadRetreat(conn, {
    junId,
    grid,
    countyCityRows: countyRows,
    playerId: pid,
    fromX: rx,
    fromY: ry,
    noticeText: NOTICE_STALE_STAND,
  });
  if (r.ok) {
    const [nrOk] = await conn.query(
      'SELECT road_jun_id, road_position_x, road_position_y, road_client_notice FROM players WHERE player_id = ? LIMIT 1',
      [pid],
    );
    const rowOk = nrOk[0];
    if (!rowOk) return null;
    return {
      road_jun_id: rowOk.road_jun_id != null ? String(rowOk.road_jun_id) : undefined,
      road_position_x: rowOk.road_position_x != null ? Number(rowOk.road_position_x) : null,
      road_position_y: rowOk.road_position_y != null ? Number(rowOk.road_position_y) : null,
      road_client_notice: rowOk.road_client_notice != null ? String(rowOk.road_client_notice) : null,
    };
  }

  /** 无己方城可退：改落本郡（或可玩邻郡）随机战场入口 — 改版/设计失误兜底（31-6） */
  const bf = await applyRandomJunBattlefieldStand(conn, {
    season,
    junId,
    grid,
    playerId: pid,
    loadRoadGrid,
  });
  if (!bf.ok) {
    const detail = `${r.error || '无己方城'}; ${bf.error || '无战场'}`;
    const notice = NOTICE_STAND_UNREPAIRABLE(junId, rx, ry, detail);
    console.error('[staleStrategicRoadStandRepair] retreat+battlefield failed:', detail, {
      pid,
      junId,
      rx,
      ry,
    });
    await conn.query(
      `UPDATE players SET road_client_notice = ?, road_updated_at = NOW() WHERE player_id = ?`,
      [notice, pid],
    );
    return { road_client_notice: notice };
  }

  console.error('[staleStrategicRoadStandRepair] relocated to jun battlefield:', {
    pid,
    fromJun: junId,
    from: { rx, ry },
    toJun: bf.junId,
    to: { x: bf.x, y: bf.y },
  });

  return {
    road_jun_id: bf.junId,
    road_position_x: bf.x,
    road_position_y: bf.y,
    road_client_notice: bf.notice,
  };
}

/**
 * `GET …/profile` 入口：单事务内锁玩家行、必要时写回路与 `road_client_notice`。
 * @param {*} pool - mysql2 pool
 * @param {string} playerId
 * @returns {Promise<object|null>} 若有修复则返回应 `Object.assign` 到内存 `player` 的补丁，否则 `null`
 */
async function repairStaleStandIfNeededAfterProfileLoad(pool, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return null;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM players WHERE player_id = ? FOR UPDATE', [pid]);
    const pl = rows[0];
    if (!pl) {
      await conn.rollback();
      return null;
    }
    const patch = await evaluateAndRepairLockedPlayer(conn, pl);
    await conn.commit();
    return patch;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('[staleStrategicRoadStandRepair] transaction failed:', err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
}

/** 软修复是否已改郡/坐标（仅写 notice 不算，须继续 force） */
function softPatchChangedStand(soft) {
  if (!soft || typeof soft !== 'object') return false;
  return soft.road_position_x != null || soft.road_position_y != null || soft.road_jun_id != null;
}

/**
 * 锁内：当前路点是否已落在郡战场入口（前后端均认的立足格）。
 * `repair-stand` 仅在此情况下跳过 force，避免「已在战场又随机迁一次」写第二条 notice。
 * 勿用「服务端自认道路/POI 合法」代替——前端报 UNRESOLVED 时可能与服务端口径不一致。
 */
async function isLockedPlayerOnJunBattlefield(_conn, pl) {
  const junId = String(pl?.road_jun_id || '').trim();
  const rx = Number(pl?.road_position_x);
  const ry = Number(pl?.road_position_y);
  if (!junId || !Number.isFinite(rx) || !Number.isFinite(ry)) return false;

  const grid = await loadRoadGridForJun('san_1', junId);
  if (grid.source === 'none' || !grid.rawCells?.length) return false;
  const ew = playerRoadToWorldMapCell(junId, rx, ry);
  if (!ew) return false;
  return !!readJunBattlefieldAtGrid(grid.rawCells, ew.gx, ew.worldGy);
}

/**
 * 前端已判定「离路且未命中城/寨/大本营/战场」时调用：先走常规修复；
 * 若未改坐标，则强制随机战场入口（本接口以「前端仍无法立足」为准，禁止用服务端宽口径 alreadyValid 顶掉迁格）。
 * 仅当**已在战场入口**时跳过 force，避免二次 notice。
 * @param {*} pool
 * @param {string} playerId
 */
async function repairOrForceBattlefieldForUnresolvedStand(pool, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, error: '缺少 playerId' };

  const soft = await repairStaleStandIfNeededAfterProfileLoad(pool, pid);
  if (softPatchChangedStand(soft)) {
    return { ok: true, forced: false, patch: soft };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM players WHERE player_id = ? FOR UPDATE', [pid]);
    const pl = rows[0];
    if (!pl) {
      await conn.rollback();
      return { ok: false, error: '玩家不存在' };
    }

    const soft2 = await evaluateAndRepairLockedPlayer(conn, pl);
    if (softPatchChangedStand(soft2)) {
      await conn.commit();
      return { ok: true, forced: false, patch: soft2 };
    }

    /** 已在战场：不改坐标、不重写 notice（防叠窗）；否则前端既调本接口就必须迁走 */
    if (await isLockedPlayerOnJunBattlefield(conn, pl)) {
      await conn.commit();
      return { ok: true, forced: false, patch: null, alreadyValid: true };
    }

    const junId = String(pl.road_jun_id || '').trim() || 'san_1_jun_yingchuan';
    const season = 'san_1';
    const grid = await loadRoadGridForJun(season, junId);
    const bf = await applyRandomJunBattlefieldStand(conn, {
      season,
      junId,
      grid: grid?.source === 'none' ? null : grid,
      playerId: pid,
      loadRoadGrid,
    });
    if (!bf.ok) {
      await conn.rollback();
      console.error('[staleStrategicRoadStandRepair] force battlefield failed:', bf.error, { pid, junId });
      return { ok: false, error: bf.error || '无可用郡战场入口格' };
    }
    await conn.commit();
    console.error('[staleStrategicRoadStandRepair] force relocated to jun battlefield:', {
      pid,
      toJun: bf.junId,
      to: { x: bf.x, y: bf.y },
    });
    return {
      ok: true,
      forced: true,
      patch: {
        road_jun_id: bf.junId,
        road_position_x: bf.x,
        road_position_y: bf.y,
        road_client_notice: bf.notice,
      },
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('[staleStrategicRoadStandRepair] force transaction failed:', err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  repairStaleStandIfNeededAfterProfileLoad,
  repairOrForceBattlefieldForUnresolvedStand,
};
