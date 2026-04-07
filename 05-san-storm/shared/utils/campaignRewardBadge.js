/**
 * 战役 CSV `completion_reward_badge` → 卡牌背面「通关奖励」行展示文案。
 * - **纯数字**（如 `1`）：赛季徽章槽位序号 →「徽章 1」「徽章 2」…（与 `item_type=season_badge` 道具池、策划表对照）
 * - **其它非空字符串**：原样展示（预留自定义短文案）
 * @param {string|number|null|undefined} raw
 * @returns {string|null}
 */
export function formatCompletionRewardBadge(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return `徽章 ${s}`;
  return s;
}
