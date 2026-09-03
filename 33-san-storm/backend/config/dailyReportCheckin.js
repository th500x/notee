/**
 * 真三日报 · 面板常量（32-6 §3 · §8）
 * 签到奖励见 dailyReportCheckinRewardsLoader + checkin-rewards-template.csv
 */

const { CHECKIN_CYCLE_MAX } = require('../../shared/utils/dailyReportCheckinRewards.cjs');

/** 占位视频路径（素材到位后替换） */
const INTRO_VIDEO_URL = null;

module.exports = {
  CHECKIN_CYCLE_MAX,
  INTRO_VIDEO_URL,
};
