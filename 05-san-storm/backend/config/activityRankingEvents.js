/**
 * 活动排行榜 endTime（活动结束后冻结积分）
 * 由 shared/config/announcements.json 自动生成，勿手改。
 * @see game/src/data/texts/announcements.js
 */
const { announcements } = require('../../shared/config/announcementsShared.cjs');

/** @type {Record<string, { endTime: string }>} */
const map = {};
for (const a of announcements) {
  if (a?.id && a.ranking?.endTime) {
    map[a.id] = { endTime: a.ranking.endTime };
  }
}

module.exports = Object.freeze(map);
