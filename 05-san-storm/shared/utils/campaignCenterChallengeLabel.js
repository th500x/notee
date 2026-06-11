/**
 * 战役中心卡牌上方「挑战次数」文案（与 16-1 §6.3、`dropdown_paren_inner` 补打口径一致）
 * @param {{ playCount?: number, maxPlayCount?: number, expired?: boolean, challengeEnded?: boolean }} progress
 * @returns {string}
 */
export function formatCampaignChallengeCountLabel(progress) {
  const pc = Number(progress?.playCount) || 0;
  const max = Number(progress?.maxPlayCount) || 3;
  if (progress?.expired && pc === 0 && !progress?.challengeEnded) {
    return '可补打 1 次';
  }
  return `挑战 ${pc}/${max}`;
}
