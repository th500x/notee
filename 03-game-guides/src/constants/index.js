/** 站点与内容常量 */

export const SITE = {
  id: '03-game-guides',
  name: '游戏攻略',
  nameEn: 'Game Guides',
  tagline: '复杂游戏的攻略与资讯汇总 · 无广告',
  homeUrl: '/',
}

/** 游戏目录（与 content/games/ 对齐；章节可由 frontmatter 覆盖展示名） */
export const GAMES = [
  {
    id: '01-acs',
    title: '了不起的修仙模拟器',
    titleEn: 'Amazing Cultivation Simulator',
    platform: 'Steam PC 一代终版',
    blurb:
      '沙盒修仙门派模拟。基础 → 进阶 → 终局（极品宝物、流派顶配、飞升之后）。',
    status: 'endgame-draft',
    chapters: [
      { section: 'basics', slug: 'gameplay', title: '玩法与机制', order: 1 },
      { section: 'basics', slug: 'mods', title: 'MOD 入门', order: 2 },
      { section: 'basics', slug: 'schools', title: '主流派', order: 3 },
      { section: 'basics', slug: 'seeds', title: '种子地图', order: 4 },
      { section: 'advanced', slug: 'schools-path', title: '进阶 · 流派养成', order: 11 },
      { section: 'advanced', slug: 'sect-dev', title: '进阶 · 门派发展', order: 12 },
      { section: 'advanced', slug: 'world', title: '进阶 · 世界互动', order: 13 },
      { section: 'endgame', slug: 'treasures', title: '终局 · 极品宝物', order: 21 },
      { section: 'endgame', slug: 'peak-builds', title: '终局 · 流派顶配', order: 22 },
      { section: 'endgame', slug: 'after-ascension', title: '终局 · 飞升之后', order: 23 },
    ],
  },
]

export const LOG_PREFIX = '[03-game-guides]'
