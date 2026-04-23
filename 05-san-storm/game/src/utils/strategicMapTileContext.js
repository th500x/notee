/**
 * 战略大地图：2×2 城/关/据点锚点左上；匪寨为 **2×1 / 1×2** 骨牌（锚点格含 `bandit_horiz` / `bandit_vert`）。
 * 非锚点格需解析「被哪一格的 POI 覆盖」以统一 tooltip / 底板色 / 标签。
 */

import {
  strategicMapObjectIs2x2,
  strategicMapBanditDominoFootprintKind,
} from '@/utils/campaignMapVisualAssets';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import {
  STRATEGIC_BANDIT_DOMINO_OBJECT_H,
  STRATEGIC_BANDIT_DOMINO_OBJECT_V,
} from '@shared/utils/strategicBanditPlaceholderPhase1.js';

/** 与瓦片内跨格对象图同挂，供滚动居中 / tooltip 锚点取几何中心 */
export const STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR = '.ws-strategic-footprint-visual';

/**
 * @typedef {'city_2x2'|'bandit_2x1'|'bandit_1x2'} StrategicFootprintKind
 */

/**
 * @param {object[][]|null|undefined} cells
 * @param {number} ri - 行（gy）
 * @param {number} ci - 列（gx）
 * @returns {{ anchorR: number, anchorC: number, anchorCell: object, footprintKind: StrategicFootprintKind } | null}
 */
export function resolveStrategicTileCityCover(cells, ri, ci) {
  if (!cells?.length) return null;
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  if (ri < 0 || ci < 0 || ri >= rows || ci >= cols) return null;

  const candidates2x2 = [
    [ri, ci],
    [ri, ci - 1],
    [ri - 1, ci],
    [ri - 1, ci - 1],
  ];
  for (const [r, c] of candidates2x2) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
    const ac = cells[r][c];
    if (!readStrategicCellAnchorId(ac) || !strategicMapObjectIs2x2(ac.object)) continue;
    if (ri >= r && ri <= r + 1 && ci >= c && ci <= c + 1) {
      return { anchorR: r, anchorC: c, anchorCell: ac, footprintKind: 'city_2x2' };
    }
  }

  const cell = cells[ri][ci];
  const banditOnSelf = strategicMapBanditDominoFootprintKind(cell?.object);
  const cellCid = readStrategicCellAnchorId(cell);
  if (cellCid && isBanditMapObjectId(cellCid) && banditOnSelf) {
    return {
      anchorR: ri,
      anchorC: ci,
      anchorCell: cell,
      footprintKind: banditOnSelf,
    };
  }

  if (ci > 0) {
    const left = cells[ri][ci - 1];
    const leftCid = readStrategicCellAnchorId(left);
    if (
      left?.object === STRATEGIC_BANDIT_DOMINO_OBJECT_H &&
      isBanditMapObjectId(leftCid) &&
      cellCid &&
      cellCid === leftCid
    ) {
      return {
        anchorR: ri,
        anchorC: ci - 1,
        anchorCell: left,
        footprintKind: 'bandit_2x1',
      };
    }
  }
  if (ri > 0) {
    const up = cells[ri - 1][ci];
    const upCid = readStrategicCellAnchorId(up);
    if (
      up?.object === STRATEGIC_BANDIT_DOMINO_OBJECT_V &&
      isBanditMapObjectId(upCid) &&
      cellCid &&
      cellCid === upCid
    ) {
      return {
        anchorR: ri - 1,
        anchorC: ci,
        anchorCell: up,
        footprintKind: 'bandit_1x2',
      };
    }
  }
  return null;
}
