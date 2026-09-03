/**
 * 道路开战门闸退让 / 战后败退：将玩家 `road_position_*` 落到本郡「最近己方城」锚格（31-6 §7 离路立点）。
 * 供 `road/roadMoveAlongService`（门闸退让 / 久未活跃退让）与路点修复共用。
 * 档案路点无法立足时的郡战场随机落点见 `applyRandomJunBattlefieldStand`（31-6）。
 */

const marchPoi = require('../../shared/utils/strategicMarchPoi.js');
const {
  playerRoadAnchorDistance,
  worldMapCellToPlayerRoad,
} = require('../../shared/utils/strategicGridCoordinates.js');
const {
  isJunBattlefieldCell,
  listJunBattlefieldEntryCells,
} = require('../../shared/utils/junBattlefieldCell.cjs');

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {object} grid - `loadRoadGrid` 结果
 * @param {object[]} countyCityRows
 * @param {string|null|undefined} cityId
 * @returns {{ x: number, y: number } | null}
 */
function resolveCityAnchorStandCell(grid, countyCityRows, cityId) {
  const cid = cityId != null ? String(cityId).trim() : '';
  if (!cid || !grid?.rawCells?.length) return null;
  const cityRow = Array.isArray(countyCityRows)
    ? countyCityRows.find((r) => String(r.city_id ?? r.cityId ?? '') === cid)
    : null;
  if (cityRow) {
    const fp = marchPoi.buildStrategicPoiFootprintFromDbCityRow(
      cityRow,
      grid.mapColumns,
      grid.mapRows,
      grid.rawCells,
    );
    if (fp && Number.isFinite(fp.anchorGx) && Number.isFinite(fp.anchorGy)) {
      return { x: Math.trunc(fp.anchorGx), y: Math.trunc(fp.anchorGy) };
    }
  }
  const fp2 = marchPoi.collectStrategicPoiFootprint(
    grid.rawCells,
    cid,
    grid.mapColumns,
    grid.mapRows,
  );
  if (fp2 && Number.isFinite(fp2.anchorGx) && Number.isFinite(fp2.anchorGy)) {
    return { x: Math.trunc(fp2.anchorGx), y: Math.trunc(fp2.anchorGy) };
  }
  return null;
}

/**
 * @param {object} playerRow - `faction_id`, `main_city_id`
 * @returns {{ x: number, y: number, retreatCityId?: string } | null}
 */
function resolveFactionPlayerRoadRetreatStandCell(grid, countyCityRows, playerRow, fromX, fromY, fromJunId) {
  const fx = toInt(fromX);
  const fy = toInt(fromY);
  if (fx == null || fy == null) return null;
  const fromJun = String(fromJunId || playerRow?.road_jun_id || '').trim();
  const fromLocal = fromJun ? { junId: fromJun, gx: fx, gy: fy } : null;
  const fac = playerRow?.faction_id != null ? String(playerRow.faction_id).trim() : '';
  let best = null;
  let bestD = Infinity;
  let bestCityId = null;
  if (fac && Array.isArray(countyCityRows) && fromLocal) {
    for (const row of countyCityRows) {
      const rowFac = row.faction_id != null ? String(row.faction_id).trim() : '';
      if (!rowFac || rowFac !== fac) continue;
      const cid = String(row.city_id ?? row.cityId ?? '').trim();
      if (!cid) continue;
      const stand = resolveCityAnchorStandCell(grid, countyCityRows, cid);
      if (!stand) continue;
      const rowJun = String(row.jun_id ?? row.junId ?? fromJun ?? '').trim();
      if (!rowJun) continue;
      const standLocal = { junId: rowJun, gx: stand.x, gy: stand.y };
      const d = playerRoadAnchorDistance(standLocal, fromLocal);
      if (bestCityId == null || d < bestD || (d === bestD && cid.localeCompare(bestCityId) < 0)) {
        bestD = d;
        best = stand;
        bestCityId = cid;
      }
    }
  }
  if (best) return { ...best, retreatCityId: bestCityId };
  const mainStand = resolveCityAnchorStandCell(grid, countyCityRows, playerRow?.main_city_id);
  if (mainStand) return { ...mainStand, retreatCityId: String(playerRow.main_city_id || '').trim() || undefined };
  return null;
}

/** 守方门闸不达标：写入 `road_client_notice` 的文案 */
function buildRoadGateFailRetreatNotice(gateError) {
  const detail = String(gateError || '兵力或粮草不足')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 220);
  const body = `您未达到道路开战要求（${detail}），已被自动移回本郡最近的己方城池。请补强编队或粮草后再进入道路。`;
  return body.slice(0, 510);
}

/** 改版/数据不一致：迁至本郡战场入口 */
function buildStaleStandBattlefieldNotice(junId, gx, gy) {
  return `路点数据异常：原立足格已不可用，已将您移至本郡郡战场入口 (${gx},${gy})（郡「${junId}」）。`.slice(0, 510);
}

/** 本郡无战场入口时改落其它郡（须可见提示，禁止静默改郡） */
function buildStaleStandBattlefieldCrossJunNotice(fromJun, toJun, gx, gy) {
  return `路点数据异常：原郡「${fromJun}」无可用战场入口，已将您移至「${toJun}」郡战场入口 (${gx},${gy})。`.slice(
    0,
    510,
  );
}

/**
 * 从单郡 `rawCells` 收集战场入口候选（郡内坐标）。
 * @param {string} junId
 * @param {object[][]|null|undefined} cells
 * @param {Set<string>} seen
 * @param {Array<{ junId: string, x: number, y: number, battlefieldId?: string }>} out
 */
function pushBattlefieldCandidatesFromLocalCells(junId, cells, seen, out) {
  const j = String(junId || '').trim();
  if (!j || !Array.isArray(cells)) return;
  for (const e of listJunBattlefieldEntryCells(cells)) {
    const k = `${j}:${e.gx},${e.gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ junId: j, x: e.gx, y: e.gy, battlefieldId: e.battlefieldId });
  }
}

/**
 * 收集「随机战场立足」候选：优先当前 `road_jun_id` 的磁盘 merged；否则叠放/邻郡战场。
 * @param {{ loadRoadGrid: Function, season: string, junId: string, grid: object|null }} p
 * @returns {Promise<Array<{ junId: string, x: number, y: number, battlefieldId?: string }>>}
 */
async function collectJunBattlefieldStandCandidates(p) {
  const loadRoadGrid = p.loadRoadGrid;
  const season = String(p.season || 'san_1').trim();
  const junId = String(p.junId || '').trim();
  const grid = p.grid;
  const seen = new Set();
  const preferred = [];
  const fallback = [];

  if (typeof loadRoadGrid === 'function' && junId) {
    const localGrid = await loadRoadGrid(season, junId);
    pushBattlefieldCandidatesFromLocalCells(junId, localGrid?.rawCells, seen, preferred);
  }
  if (preferred.length) return preferred;

  if (grid?.rawCells?.length) {
    const rows = Number(grid.mapRows) || grid.rawCells.length;
    const cols = Number(grid.mapColumns) || grid.rawCells[0]?.length || 0;
    for (let wy = 0; wy < rows; wy += 1) {
      const row = grid.rawCells[wy];
      if (!row) continue;
      for (let wx = 0; wx < cols; wx += 1) {
        if (!isJunBattlefieldCell(row[wx])) continue;
        const loc = worldMapCellToPlayerRoad(wx, wy);
        if (!loc?.junId) continue;
        const k = `${loc.junId}:${loc.gx},${loc.gy}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const item = {
          junId: loc.junId,
          x: loc.gx,
          y: loc.gy,
          battlefieldId:
            String(row[wx].battlefieldId || row[wx].battlefield_id || '').trim() || undefined,
        };
        if (loc.junId === junId) preferred.push(item);
        else fallback.push(item);
      }
    }
  }
  if (preferred.length) return preferred;

  const tryJuns =
    Array.isArray(grid?.stackJunIds) && grid.stackJunIds.length
      ? grid.stackJunIds
      : ['san_1_jun_yingchuan'];
  if (typeof loadRoadGrid === 'function') {
    for (const jRaw of tryJuns) {
      const j = String(jRaw || '').trim();
      if (!j || j === junId) continue;
      const g = await loadRoadGrid(season, j);
      pushBattlefieldCandidatesFromLocalCells(j, g?.rawCells, seen, fallback);
    }
    // 叠图未含邻郡时仍尝试颍川磁盘（改版后汝南无战场的常见兜底）
    if (!fallback.length && !tryJuns.includes('san_1_jun_yingchuan')) {
      const g = await loadRoadGrid(season, 'san_1_jun_yingchuan');
      pushBattlefieldCandidatesFromLocalCells('san_1_jun_yingchuan', g?.rawCells, seen, fallback);
    }
  }
  return fallback;
}

/**
 * 档案路点无法立足且无法迁回己方城时：随机落至郡战场入口（优先本郡）。
 * @param {*} conn
 * @param {{
 *   season?: string,
 *   junId: string,
 *   grid: object|null,
 *   playerId: string,
 *   loadRoadGrid: Function,
 * }} p
 * @returns {Promise<{ ok: true, junId: string, x: number, y: number, notice: string } | { ok: false, error: string }>}
 */
async function applyRandomJunBattlefieldStand(conn, p) {
  const pid = String(p.playerId || '').trim();
  const fromJun = String(p.junId || '').trim();
  if (!pid || !fromJun || typeof p.loadRoadGrid !== 'function') {
    return { ok: false, error: '战场落点参数不完整' };
  }
  const candidates = await collectJunBattlefieldStandCandidates({
    loadRoadGrid: p.loadRoadGrid,
    season: p.season || 'san_1',
    junId: fromJun,
    grid: p.grid,
  });
  if (!candidates.length) return { ok: false, error: '无可用郡战场入口格' };

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const toJun = String(pick.junId || '').trim();
  const x = toInt(pick.x);
  const y = toInt(pick.y);
  if (!toJun || x == null || y == null) return { ok: false, error: '战场落点坐标无效' };

  const notice =
    toJun === fromJun
      ? buildStaleStandBattlefieldNotice(toJun, x, y)
      : buildStaleStandBattlefieldCrossJunNotice(fromJun, toJun, x, y);

  await conn.query(
    `UPDATE players
        SET road_jun_id = ?, road_position_x = ?, road_position_y = ?, road_updated_at = NOW(),
            road_client_notice = ?
      WHERE player_id = ?`,
    [toJun, x, y, notice, pid],
  );
  return { ok: true, junId: toJun, x, y, notice };
}

/**
 * 将玩家移到最近己方城锚格并写入 `road_client_notice`（须在事务内已对 `players` 行加锁或本函数内 FOR UPDATE）。
 * @param {*} conn
 * @param {{ junId: string, grid: object, countyCityRows: object[], playerId: string, fromX: number, fromY: number, noticeText: string }} p
 * @returns {Promise<{ ok: true, retreatX: number, retreatY: number, retreatCityId?: string } | { ok: false, error: string }>}
 */
async function applyFactionPlayerRoadRetreat(conn, p) {
  const pid = String(p.playerId || '').trim();
  const junId = String(p.junId || '').trim();
  const grid = p.grid;
  const countyCityRows = p.countyCityRows;
  const fromX = toInt(p.fromX);
  const fromY = toInt(p.fromY);
  const noticeText = String(p.noticeText || '').trim().slice(0, 510);
  if (!pid || !junId || !grid?.rawCells?.length || fromX == null || fromY == null) {
    return { ok: false, error: '退让参数不完整' };
  }
  const [rows] = await conn.query(
    `SELECT player_id, faction_id, main_city_id FROM players WHERE player_id = ? FOR UPDATE`,
    [pid],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: '玩家不存在' };
  const stand = resolveFactionPlayerRoadRetreatStandCell(grid, countyCityRows, row, fromX, fromY, junId);
  if (!stand) return { ok: false, error: '无可用己方城锚格' };
  const { retreatCityId, ...pos } = stand;
  await conn.query(
    `UPDATE players
        SET road_jun_id = ?, road_position_x = ?, road_position_y = ?, road_updated_at = NOW(),
            road_client_notice = ?
      WHERE player_id = ?`,
    [junId, pos.x, pos.y, noticeText || null, pid],
  );
  return {
    ok: true,
    retreatX: pos.x,
    retreatY: pos.y,
    retreatCityId: retreatCityId || undefined,
  };
}

module.exports = {
  toInt,
  resolveCityAnchorStandCell,
  resolveFactionPlayerRoadRetreatStandCell,
  buildRoadGateFailRetreatNotice,
  buildStaleStandBattlefieldNotice,
  buildStaleStandBattlefieldCrossJunNotice,
  collectJunBattlefieldStandCandidates,
  applyRandomJunBattlefieldStand,
  applyFactionPlayerRoadRetreat,
};
