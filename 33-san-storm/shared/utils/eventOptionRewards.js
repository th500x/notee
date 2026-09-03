/**
 * 事件选项奖励串归一化：基础奖 vs 鸿运额外。
 * 须与 eventOptionRewards.cjs 同步。
 *
 * 部分战场部队链曾把基础奖误写在 bonusRewards 且 rewards 为空；
 * 按 14-1：bonus 仅鸿运发放。若 rewards 空而 bonus 有值，将 bonus 提升为基础奖，避免「吉」结算空白且不重复发放。
 */

/**
 * @param {{ rewards?: string|null, bonusRewards?: string|null }|null|undefined} option
 * @returns {{ rewards: string, bonusRewards: string, promotedBonusToBase: boolean }}
 */
export function resolveEventOptionRewardStrings(option) {
  const rewards = option?.rewards != null ? String(option.rewards).trim() : '';
  const bonusRewards = option?.bonusRewards != null ? String(option.bonusRewards).trim() : '';
  if (rewards) {
    return { rewards, bonusRewards, promotedBonusToBase: false };
  }
  if (bonusRewards) {
    return { rewards: bonusRewards, bonusRewards: '', promotedBonusToBase: true };
  }
  return { rewards: '', bonusRewards: '', promotedBonusToBase: false };
}
