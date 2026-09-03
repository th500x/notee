/**
 * AI 君主 · 每日大司空任命（S1 定稿常量）
 * @see docs/01-jun-exploration/40-ai/41-1-AI_KING_SYSTEM.md §每日大司空任命
 */

/** temp_event_ranking.event_id（与活动榜隔离） */
const EVENT_ID = 'san_1_king_dasikong_daily';

const DASIKONG_POSITION_ID = 'san_1_position_dasikong';

const {
  DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL,
  DASIKONG_REROLL_RARITY,
} = require('../../shared/utils/positionRerollRarity.cjs');

const { DASIKONG_DAILY_SQL_WEIGHTS } = require('./rankingScoreWeights');

/** 与 announcements.js scoreWeights / 41-1 定稿一致 */
const SCORE_WEIGHTS = DASIKONG_DAILY_SQL_WEIGHTS;

const MAIL_EXPIRE_HOURS = 24;

const SYS_SENDER_ID = 'sys1';

module.exports = {
  EVENT_ID,
  DASIKONG_POSITION_ID,
  DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL,
  DASIKONG_REROLL_RARITY,
  SCORE_WEIGHTS,
  MAIL_EXPIRE_HOURS,
  SYS_SENDER_ID,
};
