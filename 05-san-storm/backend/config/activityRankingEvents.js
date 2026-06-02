/**
 * 活动排行榜：与前端 announcements.js 中对应公告的 ranking 时间保持一致。
 * 用于在活动结束后冻结积分（不再随 player_statistics 继续增长）。
 * @see game/src/data/texts/announcements.js
 * @see backend/config/rankingScoreWeights.js（scoreWeights 单源）
 */
const { SCORE_WEIGHTS_BY_EVENT } = require('./rankingScoreWeights');

module.exports = {
  san_1_info_0001: {
    /** 与 announcements 中 ranking.endTime 一致（本地日期的 ISO 无时区串，按运行时区解析） */
    endTime: '2026-04-02T13:59:59',
    scoreWeights: SCORE_WEIGHTS_BY_EVENT.san_1_info_0001,
  },
};
