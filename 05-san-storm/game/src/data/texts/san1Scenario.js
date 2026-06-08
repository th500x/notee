/**
 * S1「黄巾之乱」剧本介绍文案（Wiki San1Page + 可复用于 Game 入口说明）
 *
 * @see wiki/src/pages/San1Page.jsx
 * @see docs/00-base/06-1-FRONTEND_SITES_OVERVIEW.md §3.1
 */

/** @type {{ pageTitle: string, pageSubtitle: string, footerTagline: string }} */
export const san1ScenarioPage = {
  pageTitle: '黄巾之乱剧本',
  pageSubtitle: 'S1 赛季 - 东汉末年，群雄并起',
  footerTagline: '真三風雲，书写半生！',
};

/**
 * @type {Array<{
 *   title: string,
 *   content: string,
 *   color: string,
 *   borderColor: string,
 * }>}
 */
export const san1ScenarioCards = [
  {
    title: '七大势力',
    content:
      '七大势力，搅动东汉之末世\n祸起黄巾，敢掀起黄天蔽日？\n诸侯即可匡扶汉室\n亦可称王逐鹿中原',
    color: 'from-green-400 to-green-500',
    borderColor: 'border-green-400',
  },
  {
    title: '丰富内容',
    content:
      '聚焦东汉核心七州燃烽火\n州内首府，城池，关隘，据点\n官职私领，终有一城归属主公\n上百位黄巾之乱真实武将\n上千条游戏随机组合事件\n预设精彩战役，体验历史',
    color: 'from-yellow-400 to-yellow-500',
    borderColor: 'border-yellow-400',
  },
  {
    title: '游戏特色',
    content:
      '胜负并不取决于数值比拼\n机缘结合肝度，独挡一方\n高阶官职，挑动风云\n合纵连横，多方外交\n抽卡全免，百分体验\n赛季战令，氪金独苗',
    color: 'from-blue-400 to-blue-500',
    borderColor: 'border-blue-400',
  },
  {
    title: '核心系统',
    content:
      '武将唯一，将尽其用\n特色部队，驰骋疆场\n多线程动态调整势力强度\n每日生成漫画不虚每一天\n真三风云，书写半生！\n叱咤华夏，就在当下！',
    color: 'from-cyan-400 to-cyan-500',
    borderColor: 'border-cyan-400',
  },
  {
    title: '赛季玩法',
    content:
      '赛季末进行豪华终局评定\n赛季保留物品：\n称号/成就/宝物\n1+n套全装装备卡\n所有金色部队卡\n最多10个橙色部队卡',
    color: 'from-pink-400 to-pink-500',
    borderColor: 'border-pink-400',
  },
];
