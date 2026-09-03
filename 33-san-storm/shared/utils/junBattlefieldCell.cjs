/**
 * 郡战场入口格（31-1 · merged.cells，无 jun_portals 表）
 * 须与 junBattlefieldCell.js 同步。
 */

const { JUN_BATTLEFIELD_OBJECT } = require('./junMapAuthoring.cjs');

function isJunBattlefieldCell(cell) {
  if (!cell || typeof cell !== 'object') return false;
  if (cell.object === JUN_BATTLEFIELD_OBJECT) return true;
  const id = cell.battlefieldId ?? cell.battlefield_id;
  return id != null && String(id).trim() !== '';
}

function isJunBattlefieldEntryCell(cell) {
  if (!isJunBattlefieldCell(cell)) return false;
  const zone = cell.battlefieldZone ?? cell.battlefield_zone;
  if (zone === 'info') return false;
  if (zone === 'entry') return true;
  return cell.object === JUN_BATTLEFIELD_OBJECT;
}

function isJunBattlefieldInfoCell(cell) {
  if (!cell || typeof cell !== 'object') return false;
  const zone = cell.battlefieldZone ?? cell.battlefield_zone;
  return zone === 'info';
}

function readBattlefieldBoundBanditPoiId(cell) {
  if (!cell || typeof cell !== 'object') return null;
  const raw = cell.banditPoiId ?? cell.bandit_poi_id;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

function readJunBattlefieldAtCell(cell, gx, gy) {
  if (!isJunBattlefieldCell(cell)) return null;
  const raw = cell.battlefieldId ?? cell.battlefield_id;
  const battlefieldId = raw != null ? String(raw).trim() : '';
  if (!battlefieldId) return null;
  return {
    battlefieldId,
    object:
      cell.object === JUN_BATTLEFIELD_OBJECT
        ? JUN_BATTLEFIELD_OBJECT
        : String(cell.object || JUN_BATTLEFIELD_OBJECT),
    gx: Math.trunc(Number(gx)),
    gy: Math.trunc(Number(gy)),
  };
}

function readJunBattlefieldAtGrid(cells, gx, gy) {
  const x = Math.trunc(Number(gx));
  const y = Math.trunc(Number(gy));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Array.isArray(cells)) return null;
  return readJunBattlefieldAtCell(cells[y]?.[x], x, y);
}

function listJunBattlefieldEntryCells(cells) {
  const out = [];
  if (!Array.isArray(cells)) return out;
  for (let gy = 0; gy < cells.length; gy += 1) {
    const row = cells[gy];
    if (!Array.isArray(row)) continue;
    for (let gx = 0; gx < row.length; gx += 1) {
      const cell = row[gx];
      if (!isJunBattlefieldEntryCell(cell)) continue;
      const hit = readJunBattlefieldAtCell(cell, gx, gy);
      if (hit) {
        out.push({
          gx: hit.gx,
          gy: hit.gy,
          battlefieldId: hit.battlefieldId,
          banditPoiId: readBattlefieldBoundBanditPoiId(cell),
        });
      }
    }
  }
  return out;
}

module.exports = {
  JUN_BATTLEFIELD_OBJECT,
  isJunBattlefieldCell,
  isJunBattlefieldEntryCell,
  isJunBattlefieldInfoCell,
  readBattlefieldBoundBanditPoiId,
  readJunBattlefieldAtCell,
  readJunBattlefieldAtGrid,
  listJunBattlefieldEntryCells,
};
