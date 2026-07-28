/**
 * 战略大地图：2×2 城/关/据点锚点左上；匪寨为 **2×1 / 1×2** 骨牌（锚点格含 `bandit_horiz` / `bandit_vert`）。
 * 非锚点格需解析「被哪一格的 POI 覆盖」以统一 tooltip / 底板色 / 标签。
 */

import { strategicMapBanditDominoFootprintKind } from '@/utils/campaignMapVisualAssets';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import {
  STRATEGIC_BANDIT_DOMINO_OBJECT_H,
  STRATEGIC_BANDIT_DOMINO_OBJECT_V,
} from '@shared/utils/strategicBanditPlaceholderPhase1.js';
import { playerRoadToWorldMapCell } from '@shared/utils/strategicGridCoordinates.js';
import { SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER } from '@shared/utils/strategicWorldMapStack.js';
import { collectStrategicPvpCampFootprintFromBaseCamp } from '@shared/utils/strategicMarchPoi.js';
import { isStrategic2x2FootprintAnchor } from '@shared/utils/strategicRoadOverlay.js';

/** 与瓦片内跨格对象图同挂，供滚动居中 / tooltip 锚点取几何中心 */
export const STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR = '.ws-strategic-footprint-visual';

/**
 * @typedef {'city_2x2'|'bandit_2x1'|'bandit_1x2'|'pvp_camp_1x1'|'pvp_camp_2x1'|'pvp_camp_1x2'} StrategicFootprintKind
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
    /** 仅 NW 锚点：与道路禁区 `isStrategic2x2FootprintAnchor` 同源（工坊四格都写 object） */
    if (!isStrategic2x2FootprintAnchor(cells, c, r)) continue;
    const ac = cells[r][c];
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

/**
 * PVP 攻方大本营 footprint → 瓦片 cover。
 * 现行：**道路 1×1**（`pvp_camp_1x1` / `pvp_camp_single`）；旧档 2×1 / 1×2 仍可解析。
 * `base_camp.cells` 为 **郡内** `gx,gy`，换为叠放 **世界格** 再匹配 `(ci,ri)`。
 *
 * @param {number} ri - 世界行（与 `cells` 下标一致）
 * @param {number} ci - 世界列
 * @param {Array<{ junId?: string, anchorOx?: number, anchorOy?: number, orientation?: string, cells?: string[], npcAlive?: number, npcTotal?: number }>|null|undefined} pvpBaseCamps
 * @param {object[][]|null|undefined} [cellsForDims] - 传入时与 `collectStrategicPvpCampFootprintFromBaseCamp` 共用 footprint（锚点优先于 `cells` 列表），避免 cells 与锚点漂移导致漏判
 * @returns {{ anchorR: number, anchorC: number, anchorCell: object, footprintKind: 'pvp_camp_1x1'|'pvp_camp_2x1'|'pvp_camp_1x2', pvpWarId: string, attackerFactionId?: string|null } | null}
 */
function pvpCampVisualFromFootprintSize(width, height) {
  if (width === 1 && height === 1) {
    return { footprintKind: 'pvp_camp_1x1', object: 'pvp_camp_single' };
  }
  const vertical = width === 1 && height === 2;
  return {
    footprintKind: vertical ? 'pvp_camp_1x2' : 'pvp_camp_2x1',
    object: vertical ? 'pvp_camp_vert' : 'pvp_camp_horiz',
  };
}

function pvpCampVisualFromOrientation(orientRaw) {
  const orient = String(orientRaw || 'single').toLowerCase();
  if (orient === 'single' || orient === '1x1') {
    return { footprintKind: 'pvp_camp_1x1', object: 'pvp_camp_single' };
  }
  const vertical = orient === 'vertical';
  return {
    footprintKind: vertical ? 'pvp_camp_1x2' : 'pvp_camp_2x1',
    object: vertical ? 'pvp_camp_vert' : 'pvp_camp_horiz',
  };
}

export function resolveStrategicTilePvpCampCover(ri, ci, pvpBaseCamps, cellsForDims = null) {
  if (!pvpBaseCamps?.length) return null;
  const here = `${ci},${ri}`;
  const rows = cellsForDims?.length ?? 0;
  const cols = cellsForDims?.[0]?.length ?? 0;

  for (const c of pvpBaseCamps) {
    if (!c?.cells?.length) continue;

    if (rows > 0 && cols > 0) {
      const fp = collectStrategicPvpCampFootprintFromBaseCamp(c, cols, rows);
      if (fp?.keys?.has(here)) {
        const { footprintKind, object } = pvpCampVisualFromFootprintSize(fp.width, fp.height);
        const pvpWarId = String(c.pvpWarId || '').trim();
        const anchorCell = {
          object,
          cityName: '',
          pvpWarId,
        };
        const attackerFactionId = c.attackerFactionId ?? c.attacker_faction_id ?? null;
        return {
          anchorR: fp.anchorGy,
          anchorC: fp.anchorGx,
          anchorCell,
          footprintKind,
          pvpWarId,
          attackerFactionId: attackerFactionId != null ? String(attackerFactionId).trim() : null,
        };
      }
    }

    const jid = String(c.junId || c.jun_id || '').trim();
    const junCandidates = jid ? [jid] : [...SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER];
    let matchedJun = '';
    let hit = false;
    outerJun: for (const jtry of junCandidates) {
      const jj = String(jtry || '').trim();
      if (!jj) continue;
      for (const k of c.cells) {
        const parts = String(k)
          .split(',')
          .map((s) => Number(String(s).trim()));
        const lx = parts[0];
        const ly = parts[1];
        if (!Number.isFinite(lx) || !Number.isFinite(ly)) continue;
        const wCell = playerRoadToWorldMapCell(jj, lx, ly);
        if (wCell && `${wCell.gx},${wCell.worldGy}` === here) {
          hit = true;
          matchedJun = jj;
          break outerJun;
        }
      }
    }
    if (!hit) continue;
    const anchorJun = jid || matchedJun;
    const anchorLx = Number(c.anchorOx) || 0;
    const anchorLy = Number(c.anchorOy) || 0;
    const anchorWorld = playerRoadToWorldMapCell(anchorJun, anchorLx, anchorLy);
    const anchorWy = anchorWorld?.worldGy ?? anchorLy;
    const { footprintKind, object } = pvpCampVisualFromOrientation(c.orientation);
    const pvpWarId = String(c.pvpWarId || '').trim();
    const anchorCell = {
      object,
      cityName: '',
      pvpWarId,
    };
    const attackerFactionId = c.attackerFactionId ?? c.attacker_faction_id ?? null;
    return {
      anchorR: anchorWy,
      anchorC: anchorLx,
      anchorCell,
      footprintKind,
      pvpWarId,
      attackerFactionId: attackerFactionId != null ? String(attackerFactionId).trim() : null,
    };
  }
  return null;
}
