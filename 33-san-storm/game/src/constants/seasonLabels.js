/**
 * 赛季展示名（卡池 Tab、Wiki 等与 config `season` 键对齐）。
 *
 * @see public/data/shared/factions.json · life-stages.json
 */

export const POOL_SEASON_LABELS = Object.freeze({
  san_1: '黄巾之乱',
  san_0: '楚汉争霸',
});

/** 卡池抽屉主赛季（ playable ） */
export const PLAYABLE_POOL_SEASON = 'san_1';

/** 招贤纳士扩池赛季键 */
export const RECRUIT_POOL_SEASON = 'san_0';

/**
 * @param {'character'|'troop'} poolType
 * @param {string} seasonKey 如 san_1 / san_0
 */
export function poolDrawerTabLabel(poolType, seasonKey) {
  const kind = poolType === 'troop' ? '部队卡池' : '将领卡池';
  const name = POOL_SEASON_LABELS[seasonKey] || seasonKey;
  return `${kind}-${name}`;
}
