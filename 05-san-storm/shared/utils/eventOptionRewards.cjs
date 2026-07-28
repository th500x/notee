/**
 * 事件选项奖励串归一化：基础奖 vs 鸿运额外。
 * 须与 eventOptionRewards.js 同步。
 */

function resolveEventOptionRewardStrings(option) {
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

module.exports = {
  resolveEventOptionRewardStrings,
};
