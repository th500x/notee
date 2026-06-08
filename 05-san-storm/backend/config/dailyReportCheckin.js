/**
 * 真三日报 · 28 日签到常量（32-6 §3）
 * 日后逐日奖励改 CSV/JSON 时扩展 resolveCheckinRewardSilver。
 */

const CHECKIN_CYCLE_MAX = 28;
const DEFAULT_CHECKIN_SILVER = 50;

/** 占位视频路径（素材到位后替换） */
const INTRO_VIDEO_URL = null;

/**
 * @param {number} cycleDay 1..CHECKIN_CYCLE_MAX
 * @returns {{ silver: number, food: number }}
 */
function resolveCheckinReward(cycleDay) {
  void cycleDay;
  return { silver: DEFAULT_CHECKIN_SILVER, food: 0 };
}

module.exports = {
  CHECKIN_CYCLE_MAX,
  DEFAULT_CHECKIN_SILVER,
  INTRO_VIDEO_URL,
  resolveCheckinReward,
};
