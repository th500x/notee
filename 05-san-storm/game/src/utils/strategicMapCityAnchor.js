/**
 * 战略大地图：根据 `city_id` 在合并格网中查找城市锚点格，供「自身标记」等与格心像素对齐。
 */

import { strategicMapObjectIs2x2 } from '@/utils/campaignMapVisualAssets';

const GAP_PX = 1;

/**
 * @param {object[][]|null|undefined} cells
 * @param {string|null|undefined} mainCityId - `players.main_city_id` / `cities.city_id`
 * @returns {{ anchorR: number, anchorC: number, footprint: '2x2' | '1x1' } | null}
 */
export function findStrategicCityAnchorForMainCity(cells, mainCityId) {
  const id = String(mainCityId || '').trim();
  if (!id || !cells?.length) return null;

  for (let ri = 0; ri < cells.length; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (!cell?.cityId || String(cell.cityId) !== id) continue;
      if (strategicMapObjectIs2x2(cell?.object)) {
        return { anchorR: ri, anchorC: ci, footprint: '2x2' };
      }
    }
  }

  for (let ri = 0; ri < cells.length; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (cell?.cityId && String(cell.cityId) === id) {
        return { anchorR: ri, anchorC: ci, footprint: '1x1' };
      }
    }
  }

  return null;
}

/**
 * 城市块中心在 `.ws-map-shell` 内的像素坐标（与 `.ws-map-grid` gap:1px、2×2 占地 `2*tile+1` 一致）。
 * @param {{ anchorR: number, anchorC: number, footprint: '2x2' | '1x1' }} anchor
 * @param {number} tilePx
 * @returns {{ cx: number, cy: number }}
 */
export function strategicCityBlockCenterPx(anchor, tilePx) {
  const t = Number(tilePx) || 0;
  const stride = t + GAP_PX;
  const span = anchor.footprint === '2x2' ? 2 * t + GAP_PX : t;
  const { anchorC, anchorR } = anchor;
  return {
    cx: anchorC * stride + span / 2,
    cy: anchorR * stride + span / 2,
  };
}
