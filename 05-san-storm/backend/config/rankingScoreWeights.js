/**
 * 活动榜 event_id 覆盖 + 大司空日榜 SQL 权重（常量见 shared/utils/rankingScoreWeights.cjs）
 * @see game/src/data/texts/announcements.js
 */

const {
  DEFAULT_SCORE_WEIGHTS,
  normalizeSqlWeights,
} = require('../../shared/utils/rankingScoreWeights.cjs');

/** 按活动 event_id 覆盖（缺省用 DEFAULT） */
const SCORE_WEIGHTS_BY_EVENT = Object.freeze({
  san_1_info_0001: DEFAULT_SCORE_WEIGHTS,
});

/**
 * @param {string} [eventId]
 * @returns {{ battle: number, events: number, reputation: number, contribution: number }}
 */
function getScoreWeightsForEvent(eventId) {
  const raw = eventId ? SCORE_WEIGHTS_BY_EVENT[eventId] : null;
  return normalizeSqlWeights(raw || DEFAULT_SCORE_WEIGHTS);
}

/** 大司空日榜 SQL 权重（与 DEFAULT 一致） */
const DASIKONG_DAILY_SQL_WEIGHTS = normalizeSqlWeights(DEFAULT_SCORE_WEIGHTS);

module.exports = {
  DEFAULT_SCORE_WEIGHTS,
  SCORE_WEIGHTS_BY_EVENT,
  DASIKONG_DAILY_SQL_WEIGHTS,
  normalizeSqlWeights,
  getScoreWeightsForEvent,
};
