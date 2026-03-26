/**
 * 游戏公告数据
 * 
 * @description 按时间倒序排列，游戏内始终显示最新一条公告
 * 命名规则：san_1_info_XXXX（递增编号）
 * 
 * 字段说明：
 * - id: 公告编号（san_1_info_XXXX）
 * - date: 发布日期
 * - title: 公告标题（简短）
 * - content: 公告正文（支持多行，用 \n 换行）
 * - ranking: 排行榜绑定（可选，null/不填 = 纯公告，有值 = 开启活动排行榜）
 *   - title: 排行榜标题
 *   - description: 活动简介
 *   - startTime: 活动开始时间（ISO 8601）
 *   - endTime: 活动结束时间（ISO 8601）
 *   - displayCount: 排行榜显示前几名
 *   - refreshInterval: 排行榜刷新间隔（毫秒，默认 300000 = 5分钟）
 *   - scoreWeights: 四项积分权重 { battleScore, events, repContrib, silverFood }
 *   - rewards: 奖池配置（可选，null = 无奖池）
 *     - rankRange: [起始名次, 结束名次]
 *     - prizes: 奖品内容 { silver, food, contribution, badge, ... }
 */

const announcements = [
  // === 示例：带排行榜的活动公告 ===
   {
     id: 'san_1_info_0001',
     date: '2026-03-26',
     title: '黄巾之乱',
     content: '测试基础功能！M1阶段占比完整游戏内容大概3%\n活动时间：3月26日 - 4月2日',
     ranking: {
       title: '测试赛季 · M1',
       description: '新手指引/事件系统/基础战斗系统/战报系统/纪念图册！',
       startTime: '2026-03-26T14:00:00',
       endTime: '2026-04-02T13:59:59',
       displayCount: 10,
       refreshInterval: 300000,
       scoreWeights: { battleScore: 1, events: 120, repContrib: 60, silverFood: 3 },
       rewards: [
         { rankRange: [1, 4],  prizes: '35R或实物等价铜麻将牌' },
         { rankRange: [5, 10],  prizes: '10RMB' },
         { rankRange: [11, 30], prizes: '5RMB' },
       ]
     }
   },

  // === 纯公告（无排行榜） ===
  {
    id: 'san_1_info_0000',
    date: '2026-03-19',
    title: '开服公告',
    content: '欢迎来到《真三风云》赛季一！游戏目前处于内测阶段，如遇问题请及时反馈。祝各位主公旗开得胜！',
  },
];

/** 获取最新一条公告 */
export function getLatestAnnouncement() {
  return announcements.length > 0 ? announcements[0] : null;
}

/** 获取全部公告（倒序） */
export function getAllAnnouncements() {
  return announcements;
}

export default announcements;
