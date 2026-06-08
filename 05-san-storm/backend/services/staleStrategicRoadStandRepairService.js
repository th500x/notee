/**
 * 玩家档案拉取时：若 `road_position_*` 已落在「地图上不再存在的立足格」
 *（典型：下线前站在攻方大本营格，战事结束后营寨已清空），
 * 则写入本郡 **最近己方城锚格**（与 `roadBattleRetreatPlacement` / PVP 终局迁离同源）。
 *
 * PVP `wars_pvp.base_camp` 与 PVE `wars.attacker_base_camps` 在战事进行中均为合法立足点，
 * 须在叠图郡 alternate 修正之前识别，避免颍川/汝南同坐标误判改郡。
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
const { applyFactionPlayerRoadRetreat } = require('../utils/roadBattleRetreatPlacement');
const {
  playerRoadToWorldMapCell,
  worldMapCellKey,
  worldMapCellKeyFromPlayerRoadLocal,
} = require('../../shared/utils/strategicGridCoordinates.js');

const NOTICE_STALE_STAND =
  '此前战事已结束或地图目标已变更，原立足格已不可用，已为您移至本郡距此最近的己方城池。'.slice(0, 510);

/** 路点郡/坐标与叠图不一致：须写回正确 `road_jun_id` 并弹窗说明（禁止无提示改郡） */
const NOTICE_JUN_COORD_FIXED = (storedJun, altJun, rx, ry) =>
  `路点档案郡已修正：坐标 (${rx},${ry}) 实际落在「${altJun}」叠图行（原误记为「${storedJun}」），已更新 road_jun_id。若仍异常请从主城重新出征。`
    .slice(0, 510);

const NOTICE_STAND_UNREPAIRABLE = (junId, rx, ry, detail) =>
  `路点数据异常：在郡「${junId}」坐标 (${rx},${ry}) 无法立足且无法自动迁回己方城（${detail}）。请从主城重新出征或联系管理。`
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

  // 须在叠图郡 alternate 修正之前：PVE/PVP 本营占格非道路/静态 POI，但仍是合法立足点。
  if (await cellTouchesActiveAttackerBaseCamp(conn, junId, rx, ry)) return null;

  if (grid?.isSan1YuVerticalStack && Array.isArray(grid.stackJunIds) && grid.stackJunIds.length >= 2) {
    for (const tryJun of grid.stackJunIds) {
      const tj = String(tryJun || '').trim();
      if (!tj || tj === junId) continue;
      const ewAlt = playerRoadToWorldMapCell(tj, rx, ry);
      if (!isStandValidAtWorld(ewAlt)) continue;
      const notice = NOTICE_JUN_COORD_FIXED(junId, tj, rx, ry);
      console.error('[staleStrategicRoadStandRepair] jun/coord mismatch — fixing road_jun_id with notice:', {
        pid,
        storedJun: junId,
        altJun: tj,
        rx,
        ry,
      });
      await conn.query(
        `UPDATE players SET road_jun_id = ?, road_client_notice = ?, road_updated_at = NOW() WHERE player_id = ?`,
        [tj, notice, pid],
      );
      return { road_jun_id: tj, road_client_notice: notice };
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
  if (!r.ok) {
    const notice = NOTICE_STAND_UNREPAIRABLE(junId, rx, ry, r.error || '未知');
    console.error('[staleStrategicRoadStandRepair] retreat failed:', r.error, { pid, junId, rx, ry });
    await conn.query(
      `UPDATE players SET road_client_notice = ?, road_updated_at = NOW() WHERE player_id = ?`,
      [notice, pid],
    );
    return { road_client_notice: notice };
  }

  const [nr] = await conn.query(
    'SELECT road_position_x, road_position_y, road_client_notice FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  const row = nr[0];
  if (!row) return null;
  return {
    road_position_x: row.road_position_x != null ? Number(row.road_position_x) : null,
    road_position_y: row.road_position_y != null ? Number(row.road_position_y) : null,
    road_client_notice: row.road_client_notice != null ? String(row.road_client_notice) : null,
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

module.exports = {
  repairStaleStandIfNeededAfterProfileLoad,
};
