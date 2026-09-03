/**
 * 个人中心 ·「机制」「团队」共用文案
 *
 * 说明：
 * - wikiBaseUrl：百科站点根地址。本地开发默认指向 wiki 开发服；生产环境可在 game/.env 中设置
 *   VITE_WIKI_BASE_URL（须以 / 结尾或下面拼接时会自动处理）
 * - introSegments / groups：「团队」页正文与分组名单
 * - mechanicsBlocks：「机制」页多块核心介绍（占位文案可在本文件替换）
 */

/** @type {string} */
export const wikiBaseUrl = (() => {
  const raw = import.meta.env.VITE_WIKI_BASE_URL || 'https://notee.vip/33-san-storm/wiki/';
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

/**
 * 正文片段（按数组顺序拼接显示；相邻文字与链接之间请在 text 里自行加空格）
 * @typedef {{ type: 'text', value: string }} TeamTextSegment
 * @typedef {{ type: 'link', label: string, path?: string, url?: string }} TeamLinkSegment
 *   path  - 相对百科根的路径，如 ''（首页）、'san_1'、'san_1/characters'
 *   url   - 若填写则优先于 path（任意完整 URL，新窗口打开）
 */

/** @type {(TeamTextSegment | TeamLinkSegment)[]} */
export const introSegments = [
  {
    type: 'text',
    value: '策划：Notee.vip\n文档：Notee.vip\n测试：Notee.vip + 三棋伙伴\n编程：Kiro AI + Cursor\n美术：ComfyUI + SDXL 1.0\n音效：TBD\n鸣谢：极影字体 + 南帝'
  },
  { type: 'text', value: '' },
  {
    type: 'link',
    label: '真三百科',
    path: ''
  }
];

/**
 * 分组：玩家点击 title 后进入第二页，展示 members
 * @type {{ id: string, title: string, description?: string, members: { name: string, score: string }[] }[]}
 */
export const groups = [
  {
    id: 'm1-thanks',
    title: 'M1测试_鸣谢名单',
    description: '排名不分先后',
    members: [
      { name: '若晞丶', score: '1,006,409' },
      { name: '东岸', score: '840,329' },
      { name: '星如雨', score: '782,733' },
      { name: '南阳凤', score: '706,465' },
      { name: '金角王', score: '633,110' },
      { name: '星空梦', score: '596,184' },
      { name: '南帝', score: '537,840' },
      { name: '青山', score: '441,310' },
      { name: '诸葛亮', score: '309,004' },
      { name: '风雨', score: '162,094' },
    ],
  },
];

/**
 * 「机制」页：分块核心介绍（占位，后续可替换为正式文案或接入百科链接）
 * @type {{ id: string, title: string, body: string }[]}
 */
export const mechanicsBlocks = [
  {
    id: '1',
    title: '《稀有度设定》',
    body: '五档设定：普通/稀有/史诗/传奇/核心，由此匹配平衡性和事件/战斗奖励等',
  },
  {
    id: '2',
    title: '《势力系统》',
    body: '势力独有加成和独有的AI处理模式\n第1赛季专属特点一：黄巾势力无法和其他势力联盟，最多只能中立（默认只能和汉室敌对）\n特点二：汉室以外的势力如果和汉室敌对，每日俸禄-20%\n匡扶汉室还是怀有异心，任君决断！',
  },
  {
    id: '3',
    title: '《官职设定》',
    body: '当升级官职时可以重新随机角色属性（并且匹配当前官职稀有度），8-5阶官职不限人数，4阶以上官职势力唯一，高阶官职拥有特殊权限。每个势力最高官职的四位玩家进入赛季名人堂',
  },
  {
    id: '4',
    title: '《将领系统》',
    body: '玩家可抽取的将领唯一，每个池子各稀有度持有上限为：普通10张/稀有20张/史诗20张/传奇10张',
  },
  {
    id: '5',
    title: '《部队系统》',
    body: '部队战斗消耗粮草，各稀有度持有上限为：普通20张/稀有40张/史诗40张/传奇20张，同类核心2张。核心部队卡为活动奖励。随身军营可携带部队卡20张，多余可放入主城驻军所',
  },
  {
    id: '6',
    title: '《装备系统》',
    body: '玩家/将领可装备槽位为：官职卡（仅玩家）、部队卡、称号卡、成就卡、宝物卡、装备卡\n后四种可以提供特殊加成，装备卡本身是由武器x1，防具x1，辅助x2组成（玩家可自由搭配）\n低级同类型装备可三合一进阶升级，物尽其用',
  },
  {
    id: '7',
    title: '《赛季继承》',
    body: '本游戏机制和普通的策略游戏相差巨大，赛季结算物品细则如下\n继承所有成就卡/称号卡/宝物卡/核心部队卡，传说部队卡10张\n继承装备卡1张（随赛季递增，进入新一个赛季上限+1，最大上限10张），其余全部新赛季重置',
  },  
];
