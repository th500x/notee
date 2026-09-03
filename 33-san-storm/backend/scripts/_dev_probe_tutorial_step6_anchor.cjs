/**
 * 本地诊断：教程 6/6 @ 阳翟 探索锚点 + 抽池
 */
const fs = require('fs');
const path = require('path');
const { readStrategicCellAnchorId } = require('../../shared/utils/strategicCellAnchorId.js');
const {
  buildStrategicPoiFootprintFromDbCityRow,
  findPoiFootprintKeysContainingCell,
  isAllowedPlayerCityPoiCityType,
} = require('../../shared/utils/strategicMarchPoi.js');
const {
  isStackedWorldMap,
  playerRoadToWorldMapCell,
} = require('../../shared/utils/strategicGridCoordinates.js');

const root = path.join(__dirname, '../..');
const merged = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/worldmap/san_1_jun_yingchuan_merged.json'), 'utf8'),
);
const citiesSeed = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/shared/cities_seed.json'), 'utf8'),
);
const cities = citiesSeed.cities.map((c) => ({
  city_id: c.cityId,
  city_type: c.cityType,
  jun_id: c.junId,
  position_x: c.positionX,
  position_y: c.positionY,
}));
const cells = merged.cells;
const cols = merged.mapColumns || 32;
const rows = merged.mapRows || cells.length;

function exploreAnchorIdFromMergedGridCells(cells, gx, worldGy, mapColumns, mapRows) {
  const wgx = Math.trunc(gx);
  const wgy = Math.trunc(worldGy);
  const direct = cells[wgy]?.[wgx];
  const directId = direct ? readStrategicCellAnchorId(direct) : '';
  if (directId) return String(directId).trim();
  const fpKeys = findPoiFootprintKeysContainingCell(cells, wgx, wgy, mapColumns, mapRows);
  if (!fpKeys?.size) return null;
  for (const fk of fpKeys) {
    const [fx, fy] = fk.split(',').map(Number);
    const c = cells[fy]?.[fx];
    const id = c ? readStrategicCellAnchorId(c) : '';
    if (id) return String(id).trim();
  }
  return null;
}

function resolveAnchor(player, gridCtx) {
  const world = playerRoadToWorldMapCell(player.roadJunId, player.roadPositionX, player.roadPositionY);
  if (!world) return null;
  let fromCells = exploreAnchorIdFromMergedGridCells(
    gridCtx.cells,
    world.gx,
    world.worldGy,
    gridCtx.mapColumns,
    gridCtx.mapRows,
  );
  if (fromCells) return fromCells;
  const rowsList = gridCtx.countyCityRows || cities;
  const k0 = `${world.gx},${world.worldGy}`;
  for (const row of rowsList) {
    const ct = row.city_type;
    if (!isAllowedPlayerCityPoiCityType(ct)) continue;
    const fp = buildStrategicPoiFootprintFromDbCityRow(row, gridCtx.mapColumns, gridCtx.mapRows, gridCtx.cells);
    if (fp?.keys?.has(k0)) {
      const id = row.city_id;
      if (id) return String(id).trim();
    }
  }
  return null;
}

const grid = {
  cells,
  mapColumns: cols,
  mapRows: rows,
  countyCityRows: cities.filter((c) => c.jun_id === 'san_1_jun_yingchuan'),
};

const player = { roadJunId: 'san_1_jun_yingchuan', roadPositionX: 14, roadPositionY: 1 };
const w = playerRoadToWorldMapCell(player.roadJunId, 14, 1);
console.log('world cell:', w);
console.log('anchor:', resolveAnchor(player, grid));
console.log('cell cityId:', readStrategicCellAnchorId(cells[w.worldGy][w.gx]));

// check 2x2 footprint keys for yangdi
const fpKeys = findPoiFootprintKeysContainingCell(cells, w.gx, w.worldGy, cols, rows);
console.log('footprint keys count:', fpKeys?.size);

const yangdi = cities.find((c) => c.city_id === 'san_1_city_yangdi');
console.log('yangdi DB pos:', yangdi.position_x, yangdi.position_y, yangdi.city_type);
