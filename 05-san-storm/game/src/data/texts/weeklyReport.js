/**
 * 项目周报页：标题、卡片入口文案、周报条目、测试奖励与里程碑（与 WeeklyReportPage 对应）
 */

/** 首页「功能导航」中的周报卡片（位于 [黄巾之乱] 之后） */
export const weeklyReportCard = {
  emoji: '📋',
  title: '[项目周报]',
  description: '真三风云 · 开发进度追踪',
};

export const weeklyReportPageTitle = '项目周报';

export const weeklyReportPageSubtitle = '真三风云 - 开发进度追踪';

/**
 * @typedef {{ week: string, date: string, content: string, color: string, borderColor: string }} WeeklyReportEntry
 * @type {WeeklyReportEntry[]}
 */
export const weeklyReports = [
  {
    week: 'W01',
    date: '2月2日-2月8日',
    content: `建立新文件夹
官方网站上线
四大模块上线
• 势力系统（7个）
• 官职设定（35个）
• 将领系统（180个）
• 部队系统（74个）`,
    color: 'from-blue-400 to-blue-500',
    borderColor: 'border-blue-400',
  },
  {
    week: 'W02',
    date: '2月9日-2月15日',
    content: `将领系统加入生涯/特性/技能/羁绊/传记/字号
四大模块数据优化中
M1完成，进入M2阶段
• M2验证模块-1（部队编组系统）
• M2验证模块-2（用户注册系统）
• M2验证模块-3（战役地图展示）
• 用户管理模块`,
    color: 'from-green-400 to-green-500',
    borderColor: 'border-green-400',
  },
  {
    week: 'W03',
    date: '2月16日-2月22日',
    content: `完善核心文档
测试美术资源
• 基础模型: SD1.5 → SDXL1.0
• 美术模型: TastyRice → GuFengXL
• 部队系统卡面更新
• 上线初版项目周报`,
    color: 'from-purple-400 to-purple-500',
    borderColor: 'border-purple-400',
  },
  {
    week: 'W04',
    date: '2月23日-3月1日',
    content: `制作美术资源
主要瓦片完成
部队图标完成（70+）
制作第一张战役地图`,
    color: 'from-yellow-400 to-yellow-500',
    borderColor: 'border-yellow-400',
  },
  {
    week: 'W05(归乡中)',
    date: '3月2日-3月8日',
    content: `完善核心文档v2
网站架构改版
剧本介绍上线
项目周报改版`,
    color: 'from-pink-400 to-pink-500',
    borderColor: 'border-pink-400',
  },
  {
    week: 'W06(归乡中)',
    date: '3月9日-3月15日',
    content: `完成数据库文档
完成架构文档
完成创建角色流程
网站迁移数据库`,
    color: 'from-pink-400 to-pink-500',
    borderColor: 'border-pink-400',
  },
  {
    week: 'W07',
    date: '3月16日-3月22日',
    content: `制作玩家头像资源
装备/称号/成就系统初步完成
新手指引流程初步上线
游戏主/编组页面上线`,
    color: 'from-blue-400 to-blue-500',
    borderColor: 'border-blue-400',
  },
  
  {
    week: 'W08',
    date: '3月23日-3月29日',
    content: `M1测试上线，实装M1更新公告中的所有内容`,
    color: 'from-blue-400 to-blue-500',
    borderColor: 'border-blue-400',
  },  

  {
    week: 'W09',
    date: '3月30日-4月5日',
    content: `架构优化，auth.js/players.js/arrisonLineup.jsx/LineupTab.jsx/SmallMapBattle.jsx/LargeMapBattle.jsx`,
    color: 'from-blue-400 to-blue-500',
    borderColor: 'border-blue-400',
  },  

  
];

/** 底部：[测试奖励] */
export const weeklyReportTestRewardP1 = {
  title: '[测试赛季]',
  conditionsHeading: '测试奖池：',
  conditions: [
    '1. [M1/M2：300RMB]',
    '2. [M3/M4：500RMB]',
    '3. [M5：1000RMB]'
  ],
  poolNote: '*奖励内容见游戏内活动公告'
};

/** 底部：[里程碑概览] — variant 用于配色 */
export const weeklyReportMilestones = {
  title: '[里程碑概览]',
  rows: [
    { text: '1. [M1 - 最小可玩版本]（DONE）', variant: 'done' },
    { text: '2. [M2 - 黄巾/汉室对抗，完整官职系统，AI君主系统，区域小地图（至少四个城），开启讨伐系统（大规模PVE）/战事系统（大规模PVP）]（IN PROGRESS）', variant: 'progress' },
    { text: '3. [M3 - 实装所有的基础功能，AI全系统]（TBD）', variant: 'tbd' },
    { text: '4. [M4 - 实装大地图/所有战役地图/自动生成全类型随机地图，全功能测试]（TBD）', variant: 'tbd' },
    { text: '5. [M5 - 实装全部立绘/音乐音效，全数值微调，最终测试]（TBD）', variant: 'mvp' }
  ]
};
