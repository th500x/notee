/**
 * PVP 战事终局：将仍站在「目标城占格 / 攻方大本营占格」上的玩家 `road_position_*`
 * 写回本郡距其当前格 **最近的己方城池锚格**（与 `roadBattleRetreatPlacement` 同源语义）。
 *
 * @see docs/10-core-system/17-3-WAR_SYSTEM.md · 终局与地图态
 */

const { loadRoadGrid } = require('../utils/roadGrid');
const { applyFactionPlayerRoadRetreat } = require('../utils/roadBattleRetreatPlacement');
const gridCoords = require('../../shared/utils/strategicGridCoordinates.js');

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

/**
 * 目标城 2×2 footprint 在叠放世界格上的键集合 `"gx,wy"`（与 `players.road_position_*` 一致）。
 */
async function buildCityFootprintWorldKeys(cityRow, grid) {
  const keys = new Set();
  if (!cityRow || !grid?.mapColumns || !grid?.mapRows) return keys;
  const junId = String(cityRow.jun_id ?? cityRow.junId ?? '').trim();
  const mapColumns = Number(grid.mapColumns);
  const mapRows = Number(grid.mapRows);
  const px = Number(cityRow.position_x);
  const py = Number(cityRow.position_y);
  if (!junId || !Number.isFinite(px) || !Number.isFinite(py)) return keys;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const lx = Math.trunc(px + dx);
      const ly = Math.trunc(py + dy);
      const k = gridCoords.worldMapCellKeyFromPlayerRoadLocal(junId, lx, ly);
      if (k) keys.add(k);
    }
  }
  return keys;
}

/**
 * @param {object|null|undefined} baseCamp - `wars_pvp.base_camp` 快照（须含 `worldCellKeys` 或可推导的 `cells`+`junId`）
 */
async function buildBaseCampWorldFootprintKeys(baseCamp) {
  const keys = new Set();
  if (!baseCamp) return keys;
  const wk = baseCamp.worldCellKeys;
  if (Array.isArray(wk)) {
    for (const k of wk) {
      const s = String(k || '').trim();
      if (s) keys.add(s);
    }
  }
  if (keys.size) return keys;
  const junId = String(baseCamp.junId || '').trim();
  if (!junId || !Array.isArray(baseCamp.cells)) return keys;
  for (const cellKey of baseCamp.cells) {
    const parts = String(cellKey)
      .split(',')
      .map((x) => Number(String(x).trim()));
    const lx = parts[0];
    const ly = parts[1];
    if (!Number.isFinite(lx) || !Number.isFinite(ly)) continue;
    const k = gridCoords.worldMapCellKeyFromPlayerRoadLocal(junId, lx, ly);
    if (k) keys.add(k);
  }
  return keys;
}

/**
 * @param {*} conn
 * @param {{ factionId: string, roadJunId: string, footprintWorldKeys: Set<string>, grid: object, countyCityRows: object[], noticeText: string }} p
 */
async function relocateFactionPlayersStandingOnFootprint(conn, p) {
  const fid = String(p.factionId || '').trim();
  const j = String(p.roadJunId || '').trim();
  const grid = p.grid;
  const countyCityRows = p.countyCityRows || [];
  const footprintWorldKeys = p.footprintWorldKeys;
  const noticeText = String(p.noticeText || '').trim().slice(0, 510);
  if (!fid || !j || !footprintWorldKeys?.size || !grid?.rawCells?.length) {
    return { moved: [] };
  }
  const [rows] = await conn.query(
    `SELECT player_id, road_position_x, road_position_y
     FROM players
     WHERE faction_id = ?
       AND road_jun_id = ?
       AND road_position_x IS NOT NULL
       AND road_position_y IS NOT NULL`,
    [fid, j],
  );
  const moved = [];
  for (const pl of rows || []) {
    const lx = Math.trunc(Number(pl.road_position_x));
    const ly = Math.trunc(Number(pl.road_position_y));
    const k = gridCoords.worldMapCellKeyFromPlayerRoadLocal(j, lx, ly);
    if (!footprintWorldKeys.has(k)) continue;
    const r = await applyFactionPlayerRoadRetreat(conn, {
      junId: j,
      grid,
      countyCityRows,
      playerId: pl.player_id,
      fromX: pl.road_position_x,
      fromY: pl.road_position_y,
      noticeText,
    });
    if (r.ok) moved.push(pl.player_id);
  }
  return { moved };
}

const NOTICE_CITY_CAPTURED =
  '目标城已易主，您仍立于该城占格之上，已为您移至本郡距此最近的己方城池。'.slice(0, 510);
const NOTICE_BASE_CAMP_LOST =
  '攻方大本营已失守，您仍立于本营占格之上，已为您移至本郡距此最近的己方城池。'.slice(0, 510);

/**
 * 攻占成功后：原守方势力、且 `road_position` 落在目标城 footprint 上的玩家迁离。
 * @param {*} conn
 * @param {object} war - `formatPvpWarRow` 结果（须含 `defenderFactionId` / `season`）
 * @param {string} targetCityId
 */
async function relocateDefendersOffPvpTargetCity(conn, war, targetCityId) {
  const cid = String(targetCityId || '').trim();
  const season = String(war.season || 'san_1').trim();
  if (!cid || !war.defenderFactionId) return { moved: [] };
  const [cRows] = await conn.query(
    'SELECT city_id, city_name, position_x, position_y, jun_id, faction_id, city_type, season FROM cities WHERE city_id = ? LIMIT 1',
    [cid],
  );
  const cityRow = cRows?.[0];
  if (!cityRow?.jun_id) return { moved: [] };
  const junId = String(cityRow.jun_id).trim();
  const grid = await loadRoadGrid(season, junId);
  if (grid.source === 'none' || !grid.rawCells?.length) return { moved: [] };
  const countyCityRows = await fetchCitiesInJun(conn, season, junId);
  const footprintWorldKeys = await buildCityFootprintWorldKeys(cityRow, grid);
  return relocateFactionPlayersStandingOnFootprint(conn, {
    factionId: war.defenderFactionId,
    roadJunId: junId,
    footprintWorldKeys,
    grid,
    countyCityRows,
    noticeText: NOTICE_CITY_CAPTURED,
  });
}

/**
 * 大本营 NPC 全灭后：攻方势力、且立于本营 footprint 上的玩家迁离。
 * @param {*} conn
 * @param {object} war - `formatPvpWarRow` 结果（须含 `attackerFactionId` / `season`）
 * @param {object} baseCampSnapshot - 终局前 `base_camp` 深拷贝（须能解析 world 占格）
 */
async function relocateAttackersOffPvpBaseCamp(conn, war, baseCampSnapshot) {
  const season = String(war.season || 'san_1').trim();
  const junId = String(baseCampSnapshot?.junId || '').trim();
  if (!junId || !war.attackerFactionId) return { moved: [] };
  const grid = await loadRoadGrid(season, junId);
  if (grid.source === 'none' || !grid.rawCells?.length) return { moved: [] };
  const countyCityRows = await fetchCitiesInJun(conn, season, junId);
  const footprintWorldKeys = await buildBaseCampWorldFootprintKeys(baseCampSnapshot);
  return relocateFactionPlayersStandingOnFootprint(conn, {
    factionId: war.attackerFactionId,
    roadJunId: junId,
    footprintWorldKeys,
    grid,
    countyCityRows,
    noticeText: NOTICE_BASE_CAMP_LOST,
  });
}

module.exports = {
  relocateDefendersOffPvpTargetCity,
  relocateAttackersOffPvpBaseCamp,
  buildCityFootprintWorldKeys,
  buildBaseCampWorldFootprintKeys,
};
