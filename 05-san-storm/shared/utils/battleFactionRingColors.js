/**
 * 战场部队阵营描边（与战斗 UI 一致）
 *
 * @see docs/00/90-assets/91-1-MAP_SYSTEM.md §「阵营色系（战场标识）」主色列
 *
 * 说明：`99-3-PROMPT_TROOP_ICON_TASTYRICE.md` 中为 SD 立绘「浅蓝/绿/黄盔甲」等自然语言；
 * 游戏内边框等工程色值以本表为准。
 */

/** 主色 #RRGGBB → rgba 描边（略透明以便叠在格子上） */
const A = 0.95;

function hexToRgba(hex, a = A) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** player / enemy / teammate / ally1 / ally2 — 与 91-1 factionColors.primary 对齐 */
export const FACTION_RING_PRIMARY_HEX = {
  player: '#3B82F6',
  enemy: '#EF4444',
  teammate: '#A855F7',
  team: '#A855F7',
  ally1: '#10B981',
  ally2: '#F59E0B',
};

export function getBattleFactionRingRgba(faction) {
  const hex = FACTION_RING_PRIMARY_HEX[faction] || FACTION_RING_PRIMARY_HEX.enemy;
  return hexToRgba(hex);
}
