/**
 * 个人中心 →「团队」页可编辑内容
 *
 * 说明：
 * - wikiBaseUrl：百科站点根地址。本地开发默认指向 wiki 开发服；生产环境可在 game/.env 中设置
 *   VITE_WIKI_BASE_URL（须以 / 结尾或下面拼接时会自动处理）
 * - introSegments：正文，支持纯文字与百科链接（新窗口打开）
 * - groups：可点击的分组；点击后在同侧边栏内进入第二屏，展示 members 名单
 */

/** @type {string} */
export const wikiBaseUrl = (() => {
  const raw = import.meta.env.VITE_WIKI_BASE_URL || 'https://notee.vip/05-san-storm/wiki/';
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
    value: '策划：Notee.vip\n文档：Notee.vip\n测试：Notee.vip + 三棋伙伴\n编程：Kiro AI + Cursor\n美术：ComfyUI + SDXL 1.0\n音效：TBD\n鸣谢：极影字体'
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
      { name: '东岸', score: '815,260' },
      { name: '星如雨', score: '754,114' },
      { name: '南阳凤', score: '706,465' },
      { name: '金角王', score: '590,721' },
      { name: '星空梦', score: '544,795' },
      { name: '南帝', score: '506,328' },
      { name: '青山', score: '441,310' },
      { name: '诸葛亮', score: '302,504' },
      { name: '风雨', score: '156,773' },
    ],
  },
];
