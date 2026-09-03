/**
 * 活动榜 / 大司空日榜 · 四项积分权重
 * 活动榜 scoreWeights 从 shared/config/announcements.json 读取；大司空用 DEFAULT。
 * @see shared/utils/rankingScoreWeights.cjs
 */

const {
  DEFAULT_SCORE_WEIGHTS,
  normalizeSqlWeights,
} = require('../../shared/utils/rankingScoreWeights.cjs');
const { findAnnouncementById } = require('../../shared/config/announcementsShared.cjs');

/**
 * @param {string} [eventId]
 * @returns {{ battle: number, events: number, reputation: number, contribution: number }}
 */
function getScoreWeightsForEvent(eventId) {
  const ann = eventId ? findAnnouncementById(eventId) : null;
  return normalizeSqlWeights(ann?.ranking?.scoreWeights || DEFAULT_SCORE_WEIGHTS);
}

/** 大司空日榜 SQL 权重（与 DEFAULT 一致） */
const DASIKONG_DAILY_SQL_WEIGHTS = normalizeSqlWeights(DEFAULT_SCORE_WEIGHTS);

module.exports = {
  DEFAULT_SCORE_WEIGHTS,
  DASIKONG_DAILY_SQL_WEIGHTS,
  normalizeSqlWeights,
  getScoreWeightsForEvent,
};
