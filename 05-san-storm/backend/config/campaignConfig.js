/**
 * 战役系统配置常量
 * @see docs/02-chapter-tactical/16-1-CAMPAIGN_SYSTEM.md
 */

/**
 * 战役「解锁后 7 个游戏日内可挑战」窗口开关。
 * false：isCampaignExpired 恒为未过期；syncUnlockFields 不写入 expiresAfterGameDay。
 * 正式版上线前应改为 true，并确认 syncUnlockFields 内恢复 expiresAfterGameDay 逻辑。
 */
const CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED = true;

/**
 * 单战役挑战次数上限（与 playCount 比较）。
 * 产品约定：3 次/战役。
 */
const CAMPAIGN_MAX_CHALLENGE_PLAYS = 3;

module.exports = {
  CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED,
  CAMPAIGN_MAX_CHALLENGE_PLAYS,
};
