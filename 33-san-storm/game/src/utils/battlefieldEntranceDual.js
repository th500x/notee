/**
 * 郡战场入口双面板（13-8）：匪寨 + 战场探索并排。
 * 探索锚点为格上 `battlefieldId`（`san_*_bf_*`），见 {@link resolveBattlefieldExploreInfo}。
 */

import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import { collectStrategicPoiFootprint } from '@shared/utils/strategicMarchPoi.js';
import { isJunBattlefieldEntryCell, isJunBattlefieldInfoCell } from '@shared/utils/junBattlefieldCell.js';

/**
 * 从匪寨 POI 推断郡 id（`san_1_bandit_1_yingchuan` → `san_1_jun_yingchuan`）。
 * @param {string|null|undefined} banditPoiId
 * @returns {string|null}
 */
export function junIdFromBanditPoiId(banditPoiId) {
  const m = String(banditPoiId || '')
    .trim()
    .match(/^san_(\d+)_bandit_\d+_(.+)$/i);
  if (!m) return null;
  return `san_${m[1]}_jun_${m[2]}`;
}

/**
 * 该匪寨是否为郡战场绑定（入口/信息区 footprint）。
 * @param {unknown[][]} cells
 * @param {string} banditPoiId
 * @param {number} mapColumns
 * @param {number} mapRows
 */
export function isBanditBattlefieldBoundPoi(cells, banditPoiId, mapColumns, mapRows) {
  const id = String(banditPoiId || '').trim();
  if (!id || !isBanditMapObjectId(id) || !cells?.length) return false;
  const fp = collectStrategicPoiFootprint(cells, id, mapColumns, mapRows);
  return fp?.kind === 'bandit_battlefield';
}

/**
 * 战场探索锚点：`location={battlefield}` 匹配 `san_*_bf_*`（slots `battlefieldId`）。
 * @param {object|null|undefined} hintCell
 * @returns {{ battlefieldId: string, displayName: string }|null}
 */
export function resolveBattlefieldExploreInfo(hintCell) {
  const id = String(
    hintCell?.battlefieldId ?? hintCell?.battlefield_id ?? ''
  ).trim();
  if (!/^san_\d+_bf_[a-z0-9_]+$/i.test(id)) return null;
  const name = String(
    hintCell?.battlefieldDisplayName ??
      hintCell?.battlefield_display_name ??
      hintCell?.cityName ??
      hintCell?.city_name ??
      '战场探索'
  ).trim();
  return { battlefieldId: id, displayName: name || '战场探索' };
}

/**
 * @param {object|null|undefined} cell
 */
export function isBattlefieldStandCellForDualAutoOpen(cell) {
  if (!cell) return false;
  return isJunBattlefieldEntryCell(cell) || isJunBattlefieldInfoCell(cell);
}
