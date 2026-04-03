/**
 * 解析「逻辑 id : 正整数」 token（ASCII 冒号）。
 * 用于战役 CSV：`quad_*_terrain_tiles` / `quad_*_object_tiles` 分号项、
 * `quad_*_units_spec` 部队列表逗号项；与事件奖励 `parseRewardString`、
 * `rewardService` 中 `san_1_troop_x001:2` 同形。
 *
 * @param {string} token 单段，如 `siege:2`、`san_1_troop_1001`、`hill`
 * @returns {{ id: string, count: number } | null} 空串返回 null
 */
export function parseIdColonCount(token) {
  const s = String(token ?? '').trim();
  if (!s) return null;
  const i = s.indexOf(':');
  if (i === -1) return { id: s, count: 1 };
  const id = s.slice(0, i).trim();
  const n = parseInt(s.slice(i + 1), 10);
  const count = Number.isFinite(n) && n > 0 ? n : 1;
  return { id, count };
}
