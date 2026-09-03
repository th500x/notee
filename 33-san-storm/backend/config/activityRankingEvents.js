/**
 * 活动排行榜时间窗（startTime / endTime）
 * 由 shared/config/announcements.json 自动生成，勿手改。
 * @see game/src/data/texts/announcements.js
 */
const { announcements } = require('../../shared/config/announcementsShared.cjs');

/** @type {Record<string, { startTime: string|null, endTime: string }>} */
const map = {};
for (const a of announcements) {
  if (a?.id && a.ranking?.endTime) {
    map[a.id] = {
      startTime: a.ranking.startTime || null,
      endTime: a.ranking.endTime,
    };
  }
}

module.exports = Object.freeze(map);
