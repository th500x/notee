/**
 * S1 赛季配置 - 黄巾之乱
 * 历史时期：公元184年
 */

export const S1_CONFIG = {
  // 基础信息
  id: 's1',
  name: '黄巾之乱',
  subtitle: '苍天已死，黄天当立',
  version: '0.1.0',
  
  // 时间设置
  timeline: {
    historicalYear: 184,
    historicalPeriod: '东汉末年',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    duration: 183,  // 天数
  },
  
  // 地图配置
  map: {
    id: 'map_s1_china_184',
    name: '东汉末年',
    size: { width: 2000, height: 1500 },
    regions: 13,  // 十三州
    cities: 89,   // 城市数量
    terrainTypes: ['平原', '山地', '水域', '森林', '丘陵'],
  },
  
  // 武将配置
  characters: {
    total: 150,
    legendary: 10,  // 传说武将（刘备、曹操、孙坚等）
    epic: 30,       // 史诗武将（关羽、张飞、赵云等）
    rare: 50,       // 稀有武将
    common: 60,     // 普通武将
  },
  
  // 兵种配置
  troops: {
    types: ['步兵', '弓兵', '骑兵', '枪兵'],
    maxTier: 3,  // 最高3阶
    specialUnits: [],  // S1暂无特殊兵种
  },
  
  // 势力配置（详细配置见 factions.js）
  factions: {
    enabled: true,
    total: 7,
    list: [
      'san_1_faction_1001',  // 刘备
      'san_1_faction_2001',  // 曹操
      'san_1_faction_3001',  // 孙坚
      'san_1_faction_4001',  // 袁绍
      'san_1_faction_5001',  // 董卓
      'san_1_faction_6001',  // 汉室
      'san_1_faction_7001',  // 黄巾
    ],
    defaultFactions: [
      'san_1_faction_1001',  // 刘备（默认可选）
      'san_1_faction_2001',  // 曹操（默认可选）
      'san_1_faction_6001',  // 汉室（默认可选）
    ],
    allianceSystem: true,  // 启用联盟系统
    diplomacySystem: true,  // 启用外交系统
  },
  
  // 赛季特色功能
  features: {
    yellowTurbanRebellion: true,  // 黄巾起义事件线
    imperialCourt: true,          // 朝廷系统
    warlordRise: false,           // 诸侯崛起（S2开启）
    coalitionWar: false,          // 讨董联盟（S2开启）
    threeKingdoms: false,         // 三国鼎立（S3开启）
  },
  
  // 新手引导
  tutorial: {
    enabled: true,
    startLocation: '涿郡',
    initialLevel: 1,
    initialGold: 1000,
    initialFood: 5000,
    initialTroops: 100,
    tutorialEvents: ['tutorial_001', 'tutorial_002', 'tutorial_003'],
  },
  
  // 资源路径
  assets: {
    basePath: '/seasons/san_1',
    map: '/seasons/san_1/map.png',
    miniMap: '/seasons/san_1/minimap.png',
    characters: '/seasons/san_1/characters',
    troops: '/seasons/san_1/troops',
    ui: '/seasons/san_1/ui',
    audio: '/seasons/san_1/audio',
  },
  
  // 赛季奖励
  rewards: {
    rankRewards: true,
    seasonPass: true,
    exclusiveItems: [
      'S1专属称号：讨贼义士',
      'S1纪念武器：黄巾破军剑',
      'S1专属头像框',
    ],
    rankTiers: [
      { rank: 1, rewards: { gems: 5000, gold: 50000 } },
      { rank: 10, rewards: { gems: 3000, gold: 30000 } },
      { rank: 100, rewards: { gems: 1000, gold: 10000 } },
      { rank: 1000, rewards: { gems: 500, gold: 5000 } },
    ],
  },
  
  // 赛季目标
  objectives: [
    { id: 'obj_001', name: '讨伐黄巾', description: '击败10支黄巾军', rewards: { exp: 5000 } },
    { id: 'obj_002', name: '占领城池', description: '占领3座城市', rewards: { gold: 10000 } },
    { id: 'obj_003', name: '招募武将', description: '招募5名武将', rewards: { gems: 500 } },
    { id: 'obj_004', name: '升级部队', description: '将部队升至2阶', rewards: { exp: 3000 } },
  ],
  
  // 赛季活动
  events: {
    weeklyEvents: true,
    specialEvents: [
      { 
        id: 'event_yellow_turban_raid',
        name: '黄巾来袭',
        schedule: 'weekly',
        description: '每周黄巾军大规模进攻',
      },
      {
        id: 'event_imperial_summon',
        name: '朝廷征召',
        schedule: 'monthly',
        description: '每月朝廷征召讨贼',
      },
    ],
  },
  
  // 平衡性配置
  balance: {
    expMultiplier: 1.0,
    goldMultiplier: 1.0,
    troopCostMultiplier: 1.0,
    battleDifficultyMultiplier: 1.0,
  },
  
  // 数据继承规则
  inheritance: {
    gold: 0.3,        // 30%金币继承
    gems: 1.0,        // 100%宝石继承
    items: 'selective',  // 选择性继承（仅限可转移物品）
    characters: 'gacha_only',  // 仅抽卡武将继承
    achievements: 1.0,  // 100%成就继承
    level: 0,         // 等级不继承
    troops: 0,        // 部队不继承
    cities: 0,        // 城市不继承
  },
};

export default S1_CONFIG;
