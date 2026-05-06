/**
 * 战术地图上主动技能（阶段3/4/5）每 **skillId** 的初始剩余次数。
 * 与 `31-1-MAP_SYSTEM.md` §1.1、**`23-SKILL_SYSTEM.md`**「使用次数规则」一致：
 * **小型 8×10 → 1 次，中型 10×16 → 2 次，大型 16×20 → 3 次**。无冷却，仅扣次数，可连续回合施放直至用尽。
 *
 * `rows` / `cols` 须与 `mapResult.terrain` 的 **高 × 宽** 一致（即 `getMapTerrainDimensions` 的 `h`、`w`，
 * 与 `initBattlePhase3HealRuntime(battleTroops, th, tw)` 传入顺序一致）。
 *
 * 非上述标准尺寸时按 **面积** `rows*cols` 分档：≤80 →1，≤160 →2，其余 →3（与 80/160/320 三档对齐）。
 *
 * @param {number} rows 地图行数（高）
 * @param {number} cols 地图列数（宽）
 * @returns {number} 本场战斗中每个主动技能 id 的可用次数
 */
export function getActiveSkillChargesForMapDimensions(rows, cols) {
  const r = Math.max(1, Math.floor(Number(rows)) || 10);
  const c = Math.max(1, Math.floor(Number(cols)) || 8);
  const area = r * c;
  if (area <= 80) return 1;
  if (area <= 160) return 2;
  return 3;
}
