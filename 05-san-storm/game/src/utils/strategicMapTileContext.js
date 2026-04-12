/**
 * 战略大地图：2×2 对象锚点左上，非锚点格需解析「被哪一格的城市覆盖」以统一 tooltip / 底板色 / 标签。
 */

import { strategicMapObjectIs2x2 } from '@/utils/campaignMapVisualAssets';

/**
 * @param {object[][]|null|undefined} cells
 * @param {number} ri - 行（gy）
 * @param {number} ci - 列（gx）
 * @returns {{ anchorR: number, anchorC: number, anchorCell: object } | null}
 */
export function resolveStrategicTileCityCover(cells, ri, ci) {
  if (!cells?.length) return null;
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const candidates = [
    [ri, ci],
    [ri, ci - 1],
    [ri - 1, ci],
    [ri - 1, ci - 1],
  ];
  for (const [r, c] of candidates) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
    const ac = cells[r][c];
    if (!ac?.cityId || !strategicMapObjectIs2x2(ac.object)) continue;
    if (ri >= r && ri <= r + 1 && ci >= c && ci <= c + 1) {
      return { anchorR: r, anchorC: c, anchorCell: ac };
    }
  }
  return null;
}
