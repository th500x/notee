/**
 * 游戏公告 + 活动榜配置（前后端单源）
 *
 * 维护：只改本文件；前端 `game/src/data/texts/announcements.js` re-export；
 * 后端 `activityRankingEvents.js` / `rankingScoreWeights.js` 从此读取 endTime、scoreWeights。
 *
 * 新一期活动须用新 id（san_1_info_XXXX）；temp_event_ranking 按 event_id 隔离快照。
 */

/** @type {Array<{ id: string, date: string, title: string, content: string, ranking?: object }>} */
const announcements = [
  {
    id: 'san_1_info_0002',
    date: '2026-06-10',
    title: '黄巾之乱',
    content: 'M2阶段占比完整游戏内容大概20%\n活动时间：6月10日 - 6月24日',
    ranking: {
      title: '测试赛季 · M2（结束后和M1一起发奖）',
      startTime: '2026-06-10T14:00:00',
      endTime: '2026-06-24T13:59:59',
      displayCount: 10,
      refreshInterval: 300000,
      scoreWeights: { battleScore: 0.2, events: 120, reputation: 60, contribution: 60 },
      rewards: [
        { rankRange: [1, 4], prizes: '35R或实物等价铜麻将牌' },
        { rankRange: [5, 10], prizes: '10RMB' },
        { rankRange: [11, 30], prizes: '5RMB' },
      ],
    },
  },
  {
    id: 'san_1_info_0001',
    date: '2026-03-26',
    title: '黄巾之乱',
    content: 'M1阶段占比完整游戏内容大概5%\n活动时间：3月26日 - 4月2日',
    ranking: {
      title: '测试赛季 · M1',
      startTime: '2026-03-26T14:00:00',
      endTime: '2026-04-02T13:59:59',
      displayCount: 10,
      refreshInterval: 300000,
      scoreWeights: { battleScore: 0.2, events: 120, reputation: 60, contribution: 60 },
      rewards: [
        { rankRange: [1, 4], prizes: '35R或实物等价铜麻将牌' },
        { rankRange: [5, 10], prizes: '10RMB' },
        { rankRange: [11, 30], prizes: '5RMB' },
      ],
    },
  },
  {
    id: 'san_1_info_0000',
    date: '2026-03-20',
    title: '开服公告',
    content:
      '欢迎来到《真三风云》赛季一！游戏目前处于内测阶段，如遇问题请及时反馈。祝各位主公旗开得胜！',
  },
];

function getLatestAnnouncement() {
  return announcements.length > 0 ? announcements[0] : null;
}

function getAllAnnouncements() {
  return announcements;
}

/** @param {string} eventId */
function findAnnouncementById(eventId) {
  return announcements.find((a) => a.id === eventId) || null;
}

module.exports = {
  announcements,
  default: announcements,
  getLatestAnnouncement,
  getAllAnnouncements,
  findAnnouncementById,
};
