/**
 * 战略大地图「进度条」一键定位：最近己方中/大城、郡内匪寨锚点格（首点最近、同郡再点按稳定序循环切换）等（世界格坐标 gy 与合并 `cells` 一致）。
 */

import { stackWorldGyFromLocalJunRow, stackLocalJunRowFromWorldGy } from '@shared/utils/strategicWorldMapStack.js';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';

export function readCityJunId(city) {
  if (!city || typeof city !== 'object') return '';
  return String(city.jun_id ?? city.junId ?? '').trim();
}

/**
 * @param {object} city - API 城行 snake/camel
 * @returns {{ gx: number, gy: number } | null} 世界格坐标
 */
export function cityDbPosToWorldStrategicCell(city) {
  const jid = readCityJunId(city);
  const lx = Number(city?.position_x ?? city?.positionX);
  const ly = Number(city?.position_y ?? city?.positionY);
  if (!jid || !Number.isFinite(lx) || !Number.isFinite(ly)) return null;
  const gx = Math.trunc(lx);
  const worldGy = stackWorldGyFromLocalJunRow(jid, Math.trunc(ly));
  return { gx, gy: worldGy };
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * @param {{ gx: number, gy: number }|null|undefined} ref
 * @param {Array<{ gx: number, gy: number }>} candidates
 * @returns {{ gx: number, gy: number } | null}
 */
export function pickNearestStrategicCell(ref, candidates) {
  if (!ref || !Number.isFinite(ref.gx) || !Number.isFinite(ref.gy) || !candidates?.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (!Number.isFinite(c.gx) || !Number.isFinite(c.gy)) continue;
    const d = manhattan(ref.gx, ref.gy, c.gx, c.gy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * @param {object[][]|null|undefined} cells - 合并格网世界行索引
 * @returns {Record<string, Array<{ gx: number, gy: number, banditPoiId: string }>>}
 */
export function collectBanditAnchorCellsByJunFromWorldGrid(cells) {
  /** @type {Record<string, Array<{ gx: number, gy: number, banditPoiId: string }>>} */
  const byJun = {};
  if (!cells?.length) return byJun;
  for (let wy = 0; wy < cells.length; wy++) {
    const row = cells[wy];
    if (!row) continue;
    const loc = stackLocalJunRowFromWorldGy(wy);
    const junId = loc?.junId;
    if (!junId) continue;
    for (let gx = 0; gx < row.length; gx++) {
      const aid = readStrategicCellAnchorId(row[gx]);
      if (!aid || !isBanditMapObjectId(aid)) continue;
      if (!byJun[junId]) byJun[junId] = [];
      byJun[junId].push({ gx, gy: wy, banditPoiId: aid });
    }
  }
  return byJun;
}

/**
 * 玩家所属势力已占 **中城 / 大城** 中，距参考格曼哈顿最近的一座（用于「探索」定位）。
 * @param {object[]} cities
 * @param {string|number|null|undefined} playerFactionId
 * @param {{ gx: number, gy: number }|null|undefined} refCell
 */
export function findNearestFactionMajorMediumCityStrategicCell(cities, playerFactionId, refCell) {
  if (!cities?.length || playerFactionId == null || String(playerFactionId).trim() === '') return null;
  const pf = String(playerFactionId).trim();
  const cands = [];
  for (const city of cities) {
    const ct = String(city?.city_type ?? city?.cityType ?? '').trim();
    if (ct !== 'city_major' && ct !== 'city_medium') continue;
    const cf = city?.faction_id ?? city?.factionId;
    if (cf == null || String(cf).trim() === '') continue;
    if (String(cf).trim() !== pf) continue;
    const pos = cityDbPosToWorldStrategicCell(city);
    if (pos) cands.push(pos);
  }
  return pickNearestStrategicCell(refCell, cands);
}

/**
 * @param {Record<string, Array<{ gx: number, gy: number }>>} byJun
 * @param {string} junId
 * @param {{ gx: number, gy: number }|null|undefined} refCell
 */
/**
 * 骨牌匪寨可能在合并格网占多格；定位滚屏只需每 **`banditPoiId`** 保留一格代表坐标。
 * @param {Array<{ gx: number, gy: number, banditPoiId: string }>|null|undefined} rawList
 * @returns {Array<{ gx: number, gy: number, banditPoiId: string }>}
 */
export function dedupeBanditAnchorCellsByPoiId(rawList) {
  if (!rawList?.length) return [];
  /** @type {Map<string, { gx: number, gy: number, banditPoiId: string }>} */
  const byId = new Map();
  for (const c of rawList) {
    const id = String(c?.banditPoiId ?? '').trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { gx: c.gx, gy: c.gy, banditPoiId: id });
  }
  return Array.from(byId.values());
}

/**
 * 本郡多寨时循环顺序：先按世界格 **gy、gx**，再按 **`banditPoiId`** 字符串，保证稳定。
 * @param {Array<{ gx: number, gy: number, banditPoiId: string }>} list
 */
export function sortBanditAnchorsStableByGridOrder(list) {
  return [...(list || [])].sort((a, b) => {
    const dy = a.gy - b.gy;
    if (dy !== 0) return dy;
    const dx = a.gx - b.gx;
    if (dx !== 0) return dx;
    return String(a.banditPoiId).localeCompare(String(b.banditPoiId), 'en');
  });
}

/**
 * 郡条「匪寨」定位：**首次**（或上次寨已从格网消失）→ 距 **`refCell`** 曼哈顿最近的一座；**同郡再次点击** → 在稳定排序的各寨间 **循环** 下一座。
 * @param {Record<string, Array<{ gx: number, gy: number, banditPoiId: string }>>} byJun
 * @param {string} junId
 * @param {{ gx: number, gy: number }|null|undefined} refCell
 * @param {string|null|undefined} lastBanditPoiId - 该郡上一次滚屏定位的 **`banditPoiId`**（由调用方 ref 维护）
 * @returns {{ gx: number, gy: number, banditPoiId: string } | null}
 */
export function pickBanditProgressLocateTarget(byJun, junId, refCell, lastBanditPoiId) {
  const j = String(junId || '').trim();
  const unique = sortBanditAnchorsStableByGridOrder(dedupeBanditAnchorCellsByPoiId(byJun?.[j]));
  if (!unique.length) return null;
  if (unique.length === 1) return unique[0];
  const last = lastBanditPoiId != null ? String(lastBanditPoiId).trim() : '';
  if (!last) {
    return pickNearestStrategicCell(refCell, unique) ?? unique[0];
  }
  const idx = unique.findIndex((u) => u.banditPoiId === last);
  if (idx < 0) {
    return pickNearestStrategicCell(refCell, unique) ?? unique[0];
  }
  return unique[(idx + 1) % unique.length];
}

export function pickNearestBanditStrategicCellInJun(byJun, junId, refCell) {
  const j = String(junId || '').trim();
  const list = dedupeBanditAnchorCellsByPoiId(byJun?.[j]);
  return pickNearestStrategicCell(refCell, list);
}
