/**
 * 战役象限丙玩家部署区：与 docs/tools/campaign/CAMPAIGN_MAP.md §8 一致。
 * 锚点为象限东南角格，向西 columns 列、向北 rows 行（矩形向西北延伸）。
 */

import { QUAD_W, QUAD_H } from '@shared/utils/campaignMapGenerator';

/** Quad C 原点（全局列、行） */
const C_OX = 8;
const C_OY = 10;

/** @returns {{ cols: number, rows: number }} */
export function parseDeployDimensionsFromPreset(preset) {
  const spec = preset?.quad_C_units_spec || '';
  const m = /deploy\s*:\s*(\d+)\s*x\s*(\d+)/i.exec(spec);
  if (!m) return { cols: 4, rows: 6 };
  return {
    cols: Math.min(QUAD_W, Math.max(1, parseInt(m[1], 10) || 4)),
    rows: Math.min(QUAD_H, Math.max(1, parseInt(m[2], 10) || 6)),
  };
}

/**
 * 全局格坐标下的玩家部署矩形（含边界）
 * @returns {{ colMin: number, colMax: number, rowMin: number, rowMax: number, cols: number, rows: number }}
 */
export function getPlayerDeployRectGlobal(preset) {
  const { cols, rows } = parseDeployDimensionsFromPreset(preset);
  const colMax = C_OX + QUAD_W - 1;
  const rowMax = C_OY + QUAD_H - 1;
  const colMin = colMax - cols + 1;
  const rowMin = rowMax - rows + 1;
  return { colMin, colMax, rowMin, rowMax, cols, rows };
}

export function isCellInDeployRect(col, row, rect) {
  return (
    col >= rect.colMin &&
    col <= rect.colMax &&
    row >= rect.rowMin &&
    row <= rect.rowMax
  );
}

/** 与战役生成器一致：不可部署在河/湖/占用对象格 */
export function isCampaignCellDeployableForPlayer(cell) {
  if (!cell) return false;
  const t = cell.terrain;
  if (t === 'river' || t === 'lake') return false;
  if (cell.object) return false;
  return true;
}

/**
 * 自北向南、自西向东枚举可部署格（先最前排，部署靠近前线）
 * @param {Array<Array<object>>} cells
 */
export function listPassableDeployCellsInRect(cells, rect) {
  const out = [];
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      const c = cells[row]?.[col];
      if (isCampaignCellDeployableForPlayer(c)) out.push({ col, row });
    }
  }
  return out;
}
