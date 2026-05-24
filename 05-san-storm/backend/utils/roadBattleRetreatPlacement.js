/**
 * 道路开战门闸退让 / 战后败退：将玩家 `road_position_*` 落到本郡「最近己方城」锚格（与 §9.4 离路立点一致）。
 * 供 `roadEncounterService.moveAlongRoad`、`resolveEncounter` 共用。
 */

const marchPoi = require('../../shared/utils/strategicMarchPoi.js');
const { playerRoadAnchorDistance } = require('../../shared/utils/strategicGridCoordinates.js');

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
      const rowJun = String(row.jun_id ?? row.junId ?? '').trim();
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

/** 道路对战战败后：一次性客户端提示 */
function buildRoadBattleDefeatRetreatNotice() {
  return '道路对战失利，已为您移回本郡距离交战格最近的己方城池。请重整兵力与粮草后再来。'.slice(0, 510);
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
  buildRoadBattleDefeatRetreatNotice,
  applyFactionPlayerRoadRetreat,
};
