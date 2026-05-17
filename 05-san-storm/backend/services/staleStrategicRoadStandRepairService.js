/**
 * 玩家档案拉取时：若 `road_position_*` 已落在「地图上不再存在的立足格」
 *（典型：下线前站在攻方大本营格，战事结束后 `base_camp` 已清空），
 * 则写入本郡 **最近己方城锚格**（与 `roadBattleRetreatPlacement` / PVP 终局迁离同源）。
 *
 * 与 `pvpWarPlayerRelocationService.relocateAttackersOffPvpBaseCamp` 互补：后者在终局事务内迁离在线/同进程玩家；
 * 本模块兜底 **已离线** 或 **迁离逻辑未命中**（例如占格键世界行 Y 与库不一致）的残留坐标。
 */

const { loadRoadGrid } = require('../utils/roadGrid');
const marchPoi = require('../../shared/utils/strategicMarchPoi.js');
const { applyFactionPlayerRoadRetreat } = require('../utils/roadBattleRetreatPlacement');

const NOTICE_STALE_STAND =
  '此前战事已结束或地图目标已变更，原立足格已不可用，已为您移至本郡距此最近的己方城池。'.slice(0, 510);

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

function parseBaseCampJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * 当前格是否落在 **pending/active** 且仍带 `base_camp` 的 PVP 攻方本营占格上（与前端叠放世界行一致）。
 */
async function cellTouchesActivePvpBaseCamp(conn, roadJunId, lx, ly) {
  const j = String(roadJunId || '').trim();
  const tx = Math.trunc(Number(lx));
  const ty = Math.trunc(Number(ly));
  if (!j || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;

  const { stackWorldGyFromLocalJunRow } = await import('../../shared/utils/strategicWorldMapStack.js');
  const selfLocal = `${tx},${ty}`;
  const selfWorld = `${tx},${stackWorldGyFromLocalJunRow(j, ty)}`;

  const [rows] = await conn.query(
    `SELECT base_camp FROM wars_pvp WHERE status IN ('pending','active') AND base_camp IS NOT NULL`,
  );
  for (const r of rows || []) {
    const bc = parseBaseCampJson(r.base_camp);
    if (!bc) continue;
    if (Array.isArray(bc.worldCellKeys)) {
      for (const wk of bc.worldCellKeys) {
        const s = String(wk || '').trim().replace(/\s/g, '');
        if (s && s === selfWorld) return true;
      }
    }
    const bj = String(bc.junId || '').trim();
    if (bj === j && Array.isArray(bc.cells)) {
      for (const ck of bc.cells) {
        const s = String(ck || '').trim().replace(/\s/g, '');
        if (s && s === selfLocal) return true;
      }
    }
  }
  return false;
}

/**
 * 在 **已 FOR UPDATE 锁定** 的 `players` 行上评估；若需修复则在本连接内 UPDATE 并返回应合并回档案对象的字段。
 * @param {*} conn
 * @param {object} pl - `players` 行（至少含 player_id, road_jun_id, road_position_x/y, faction_id）
 * @returns {Promise<{ road_position_x: number|null, road_position_y: number|null, road_client_notice: string|null }|null>}
 */
async function evaluateAndRepairLockedPlayer(conn, pl) {
  const pid = String(pl.player_id || '').trim();
  const junId = String(pl.road_jun_id || '').trim();
  if (!pid || !junId) return null;

  const rx = Number(pl.road_position_x);
  const ry = Number(pl.road_position_y);
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;

  const season = 'san_1';
  const grid = await loadRoadGrid(season, junId);
  if (grid.source === 'none' || !grid.rawCells?.length) return null;

  const pass = marchPoi.buildRoadPassableKeySetForMarch(
    grid.roadCellsRaw,
    grid.rawCells,
    grid.mapColumns,
    grid.mapRows,
  );
  const k = `${Math.trunc(rx)},${Math.trunc(ry)}`;
  if (pass.has(k)) return null;

  const countyRows = await fetchCitiesInJun(conn, season, junId);
  if (
    marchPoi.resolvePoiFootprintAtCellFromDb(
      countyRows,
      Math.trunc(rx),
      Math.trunc(ry),
      grid.mapColumns,
      grid.mapRows,
      grid.rawCells,
    )
  ) {
    return null;
  }

  const fpKeys = marchPoi.findPoiFootprintKeysContainingCell(
    grid.rawCells,
    Math.trunc(rx),
    Math.trunc(ry),
    grid.mapColumns,
    grid.mapRows,
  );
  if (fpKeys?.size) return null;

  if (await cellTouchesActivePvpBaseCamp(conn, junId, rx, ry)) return null;

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
    console.warn('[staleStrategicRoadStandRepair] retreat failed:', r.error, { pid, junId, rx, ry });
    return null;
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
