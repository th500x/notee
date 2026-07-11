/**
 * 项目周报页：标题、卡片入口文案、测试奖励与里程碑概览
 * 逐周历史已归档至 docs/00/00-base/05-1-MILESTONES.md §7
 */

/** 首页「功能导航」中的周报卡片（位于 [黄巾之乱] 之后） */
export const weeklyReportCard = {
  emoji: '📋',
  title: '[项目周报]',
  description: '真三风云 · 开发进度追踪',
};

export const weeklyReportPageTitle = '项目周报';

export const weeklyReportPageSubtitle = '真三风云 - 开发进度追踪';

/** @deprecated 逐周条目已迁入 05-1-MILESTONES.md；保留空数组供页面兼容 */
export const weeklyReports = [];

/** 底部：[测试奖励] */
export const weeklyReportTestRewardP1 = {
  title: '[测试赛季]',
  conditionsHeading: '测试奖池：',
  conditions: [
    '1. [M1/M2：300RMB]',
    '2. [M3/M4：500RMB]',
    '3. [M5：1000RMB]',
  ],
  poolNote: '*奖励内容见游戏内活动公告',
};

/** 底部：[里程碑概览] — variant 用于配色 */
export const weeklyReportMilestones = {
  title: '[里程碑概览]',
  rows: [
    { text: '1. [M1 - 最小可玩版本]（DONE）', variant: 'done' },
    {
      text: '2. [M2 - 黄巾/汉室对抗，完整官职系统，AI君主系统，区域小地图（至少四个城），开启讨伐系统（大规模PVE）/战事系统（大规模PVP）]（DONE · 2026-06-09 上线）',
      variant: 'done',
    },
    { text: '3. [M3 - 实装所有的基础功能，AI全系统]（TBD）', variant: 'tbd' },
    { text: '4. [M4 - 实装大地图/所有战役地图/自动生成全类型随机地图，全功能测试]（TBD）', variant: 'tbd' },
    { text: '5. [M5 - 实装全部立绘/音乐音效，全数值微调，最终测试]（TBD）', variant: 'mvp' },
  ],
};
