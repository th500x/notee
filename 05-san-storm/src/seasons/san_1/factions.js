/**
 * S1 赛季势力配置 - 黄巾之乱
 * 历史时期：公�?84-189�?
 * 
 * 势力系统说明�?
 * - 玩家加入势力后，等于加入一个联�?
 * - 同势力玩家可以互相协作、共享资�?
 * - 不同势力之间存在对抗关系
 */

export const S1_FACTIONS = [
  // ==================== 1. 刘备势力 ====================
  {
    id: 'san_1_faction_1001',
    name: '刘备',
    fullName: '刘皇叔势�?,
    color: '#FF6B6B',  // 红色
    icon: '🐉',
    
    // 势力信息
    leader: 'char_legend_0005',  // 刘备
    capital: 'city_youzhou_0001',  // 涿郡
    region: '幽州',
    
    // 势力特�?
    traits: {
      primary: '仁德',
      secondary: '义气',
      description: '以仁德治天下，以义气聚英�?,
    },
    
    // 势力加成
    bonuses: {
      recruitment: 0.2,      // 招募成功�?20%
      loyalty: 0.3,          // 武将忠诚�?30%
      morale: 0.15,          // 部队士气+15%
      charismaEffect: 0.25,  // 魅力效果+25%
    },
    
    // 势力武将列表
    characters: [
      'char_legend_0005',  // 刘备（传说）
      'char_legend_0002',  // 关羽（传说）
      'char_legend_0003',  // 张飞（传说）
      'char_legend_0004',  // 赵云（传说）
    ],
    
    // 势力描述
    description: '汉室宗亲刘备，以仁德闻名天下。桃园结义，聚关羽、张飞等忠义之士。虽势力弱小，但得人心者得天下�?,
    
    // 势力目标
    objectives: [
      '匡扶汉室',
      '招贤纳士',
      '以德服人',
      '建立蜀�?,
    ],
    
    // 势力关系
    relations: {
      allies: ['san_1_faction_6001'],      // 汉室（盟友）
      neutral: ['san_1_faction_3001', 'san_1_faction_2001'],  // 孙坚、曹操（中立）
      enemies: ['san_1_faction_5001', 'san_1_faction_7001'],  // 董卓、黄巾（敌对）
    },
    
    // 势力等级
    tier: 'A',  // S/A/B/C/D
    difficulty: 'medium',  // easy/medium/hard
    
    // 开放条�?
    unlockConditions: {
      level: 1,
      cost: 0,
      special: null,
    },
  },

  // ==================== 2. 孙坚势力 ====================
  {
    id: 'san_1_faction_3001',
    name: '孙坚',
    fullName: '江东猛虎势力',
    color: '#4ECDC4',  // 青色
    icon: '🐯',
    
    leader: 'char_legend_0007',  // 孙坚
    capital: 'city_yangzhou_0001',  // 长沙
    region: '扬州',
    
    traits: {
      primary: '破虏',
      secondary: '勇猛',
      description: '江东猛虎，所向披�?,
    },
    
    bonuses: {
      combat: 0.2,           // 战斗�?20%
      navyPower: 0.3,        // 水军战力+30%
      lootBonus: 0.25,       // 战利�?25%
      courageEffect: 0.2,    // 勇气效果+20%
    },
    
    characters: [
      'char_legend_0007',  // 孙坚（传说）
      'char_epic_0013',    // 周瑜（史诗）
      'char_epic_0014',    // 太史慈（史诗�?
      'char_epic_0015',    // 黄盖（史诗）
      'char_epic_0016',    // 程普（史诗）
      'char_epic_0017',    // 韩当（史诗）
    ],
    
    description: '江东猛虎孙坚，勇冠三军。讨伐董卓，威震天下。江东子弟多才俊，卧虎藏龙�?,
    
    objectives: [
      '称霸江东',
      '建立水军',
      '北伐中原',
      '开创基�?,
    ],
    
    relations: {
      allies: ['san_1_faction_6001'],      // 汉室（盟友）
      neutral: ['san_1_faction_1001', 'san_1_faction_2001', 'san_1_faction_4001'],  // 刘备、曹操、袁绍（中立）
      enemies: ['san_1_faction_5001', 'san_1_faction_7001'],  // 董卓、黄巾（敌对）
    },
    
    tier: 'A',
    difficulty: 'medium',
    
    unlockConditions: {
      level: 1,
      cost: 0,
      special: null,
    },
  },

  // ==================== 3. 曹操势力 ====================
  {
    id: 'san_1_faction_2001',
    name: '曹操',
    fullName: '魏武帝势�?,
    color: '#5D5FEF',  // 紫色
    icon: '⚔️',
    
    leader: 'char_legend_0006',  // 曹操
    capital: 'city_yanzhou_0001',  // 陈留
    region: '兖州',
    
    traits: {
      primary: '奸雄',
      secondary: '挟天�?,
      description: '治世之能臣，乱世之奸�?,
    },
    
    bonuses: {
      intelligence: 0.2,     // 智力效果+20%
      politics: 0.25,        // 政治效果+25%
      strategySuccess: 0.2,  // 计谋成功�?20%
      resourceProduction: 0.3,  // 资源产出+30%
    },
    
    characters: [
      'char_legend_0006',  // 曹操（传说）
      'char_epic_0001',    // 典韦（史诗）
      'char_epic_0002',    // 许褚（史诗）
      'char_epic_0003',    // 夏侯惇（史诗�?
      'char_epic_0004',    // 夏侯渊（史诗�?
      'char_epic_0005',    // 张辽（史诗）
      'char_epic_0006',    // 徐晃（史诗）
      'char_epic_0007',    // 张郃（史诗）
      'char_epic_0008',    // 荀彧（史诗�?
      'char_epic_0009',    // 荀攸（史诗�?
      'char_epic_0010',    // 郭嘉（史诗）
      'char_epic_0011',    // 程昱（史诗）
      'char_rare_0017',    // 吕虔（稀有）
      'char_rare_0018',    // 李典（稀有）
      'char_rare_0019',    // 乐进（稀有）
      'char_rare_0020',    // 于禁（稀有）
      'char_common_0009',  // 鲍信（普通）
      'char_common_0011',  // 张邈（普通）
      'char_common_0012',  // 张超（普通）
      'char_common_0019',  // 鲍忠（普通）
    ],
    
    description: '曹操雄才大略，文武兼备。麾下猛将如云，谋士如雨。挟天子以令诸侯，终成一代霸主�?,
    
    objectives: [
      '挟天子以令诸�?,
      '统一北方',
      '招揽人才',
      '建立魏国',
    ],
    
    relations: {
      allies: ['san_1_faction_6001'],      // 汉室（盟友）
      neutral: ['san_1_faction_1001', 'san_1_faction_3001', 'san_1_faction_4001'],  // 刘备、孙坚、袁绍（中立）
      enemies: ['san_1_faction_5001', 'san_1_faction_7001'],  // 董卓、黄巾（敌对）
    },
    
    tier: 'S',  // 最强势�?
    difficulty: 'easy',
    
    unlockConditions: {
      level: 1,
      cost: 0,
      special: null,
    },
  },

  // ==================== 4. 汉室势力 ====================
  {
    id: 'san_1_faction_6001',
    name: '汉室',
    fullName: '东汉朝廷',
    color: '#FFD700',  // 金色
    icon: '👑',
    
    leader: 'char_common_0004',  // 何进
    capital: 'city_sizhou_0001',  // 洛阳
    region: '司州',
    
    traits: {
      primary: '正统',
      secondary: '名望',
      description: '天下正统，万民归�?,
    },
    
    bonuses: {
      legitimacy: 0.5,       // 正统�?50%
      recruitment: 0.3,      // 招募成功�?30%
      taxIncome: 0.25,       // 税收+25%
      diplomaticPower: 0.3,  // 外交能力+30%
    },
    
    characters: [
      'char_common_0004',  // 何进（普通）
      'char_common_0005',  // 卢植（普通）
      'char_common_0006',  // 皇甫嵩（普通）
      'char_common_0007',  // 朱儁（普通）
    ],
    
    description: '东汉朝廷，名存实亡。外戚宦官专权，朝纲败坏。虽有正统之名，却无实际之权�?,
    
    objectives: [
      '维护朝廷',
      '平定叛乱',
      '重振汉室',
      '清除奸佞',
    ],
    
    relations: {
      allies: ['san_1_faction_1001', 'san_1_faction_3001', 'san_1_faction_2001', 'san_1_faction_4001'],  // 刘备、孙坚、曹操、袁绍（盟友）
      neutral: [],
      enemies: ['san_1_faction_5001', 'san_1_faction_7001'],  // 董卓、黄巾（敌对）
    },
    
    tier: 'C',  // 势力较弱
    difficulty: 'hard',
    
    unlockConditions: {
      level: 10,
      cost: 5000,
      special: '需要完�?忠君报国"成就',
    },
  },

  // ==================== 5. 董卓势力 ====================
  {
    id: 'san_1_faction_5001',
    name: '董卓',
    fullName: '西凉军阀',
    color: '#8B4513',  // 棕色
    icon: '🔥',
    
    leader: 'char_legend_0008',  // 董卓
    capital: 'city_liangzhou_0001',  // 长安
    region: '凉州',
    
    traits: {
      primary: '暴君',
      secondary: '威压',
      description: '西凉猛虎，暴虐无�?,
    },
    
    bonuses: {
      cavalryPower: 0.3,     // 骑兵战力+30%
      plunderBonus: 0.5,     // 掠夺收益+50%
      fearEffect: 0.4,       // 恐惧效果+40%
      troopMaintenance: -0.2,  // 部队维护�?20%
    },
    
    characters: [
      'char_legend_0008',  // 董卓（史诗，但作为势力首领）
      'char_legend_0001',  // 吕布（传说）
      'char_epic_0012',    // 贾诩（史诗）
      'char_rare_0011',    // 华雄（稀有）
      'char_rare_0012',    // 李傕（稀有）
      'char_rare_0013',    // 郭汜（稀有）
      'char_rare_0014',    // 张济（稀有）
      'char_rare_0015',    // 樊稠（稀有）
      'char_rare_0016',    // 胡轸（稀有）
    ],
    
    description: '西凉军阀董卓，挟持天子，祸乱朝纲。麾下猛将吕布，天下无敌。暴虐无道，人神共愤�?,
    
    objectives: [
      '控制朝廷',
      '镇压诸侯',
      '掠夺财富',
      '称霸天下',
    ],
    
    relations: {
      allies: [],
      neutral: [],
      enemies: ['san_1_faction_1001', 'san_1_faction_3001', 'san_1_faction_2001', 'san_1_faction_6001', 'san_1_faction_4001'],  // 所有势力（敌对）
    },
    
    tier: 'S',  // 强大但孤�?
    difficulty: 'hard',
    
    unlockConditions: {
      level: 15,
      cost: 10000,
      special: '需要完�?乱世枭雄"成就',
    },
  },

  // ==================== 6. 袁绍势力 ====================
  {
    id: 'san_1_faction_4001',
    name: '袁绍',
    fullName: '四世三公',
    color: '#9B59B6',  // 紫罗兰色
    icon: '🏛�?,
    
    leader: 'char_legend_0009',  // 袁绍
    capital: 'city_jizhou_0001',  // 邺城
    region: '冀�?,
    
    traits: {
      primary: '名门',
      secondary: '四世三公',
      description: '四世三公，门生故吏遍天下',
    },
    
    bonuses: {
      recruitment: 0.35,     // 招募成功�?35%（最高）
      startingResources: 0.5,  // 初始资源+50%
      diplomaticPower: 0.25,  // 外交能力+25%
      prestigeGain: 0.3,     // 声望获取+30%
    },
    
    characters: [
      'char_legend_0009',  // 袁绍（史诗，但作为势力首领）
      'char_epic_0019',    // 文丑（史诗）
      'char_epic_0020',    // 颜良（史诗）
      'char_common_0010',  // 桥瑁（普通）
      'char_common_0013',  // 臧洪（普通）
      'char_common_0014',  // 孔伷（普通）
      'char_common_0015',  // 刘岱（普通）
      'char_common_0016',  // 王匡（普通）
      'char_common_0018',  // 桥蕤（普通）
    ],
    
    description: '袁绍出身名门，四世三公。门生故吏遍天下，势力庞大。然而优柔寡断，终成憾事�?,
    
    objectives: [
      '统一河北',
      '号令诸侯',
      '讨伐董卓',
      '争夺天下',
    ],
    
    relations: {
      allies: ['san_1_faction_6001'],      // 汉室（盟友）
      neutral: ['san_1_faction_1001', 'san_1_faction_3001', 'san_1_faction_2001'],  // 刘备、孙坚、曹操（中立）
      enemies: ['san_1_faction_5001', 'san_1_faction_7001'],  // 董卓、黄巾（敌对）
    },
    
    tier: 'A',
    difficulty: 'easy',
    
    unlockConditions: {
      level: 5,
      cost: 2000,
      special: null,
    },
  },

  // ==================== 7. 黄巾势力 ====================
  {
    id: 'san_1_faction_7001',
    name: '黄巾',
    fullName: '太平�?,
    color: '#F1C40F',  // 黄色
    icon: '�?,
    
    leader: 'char_common_0001',  // 张角
    capital: 'city_jizhou_0002',  // 巨鹿
    region: '冀�?,
    
    traits: {
      primary: '太平�?,
      secondary: '苍天已死',
      description: '苍天已死，黄天当立，岁在甲子，天下大�?,
    },
    
    bonuses: {
      troopRecruitment: 0.5,  // 部队招募速度+50%
      troopCost: -0.3,        // 部队成本-30%
      morale: 0.2,            // 士气+20%
      healingPower: 0.3,      // 治疗效果+30%
    },
    
    characters: [
      'char_common_0001',  // 张角（普通）
      'char_common_0002',  // 张宝（普通）
      'char_common_0003',  // 张梁（普通）
      'char_rare_0007',    // 张燕（稀有）
    ],
    
    description: '太平道首领张角，自称"天公将军"。以"苍天已死，黄天当�?为口号，发动黄巾起义，席卷天下�?,
    
    objectives: [
      '推翻汉室',
      '建立太平世道',
      '传播太平�?,
      '解放百姓',
    ],
    
    relations: {
      allies: [],
      neutral: [],
      enemies: ['san_1_faction_1001', 'san_1_faction_3001', 'san_1_faction_2001', 'san_1_faction_6001', 'san_1_faction_5001', 'san_1_faction_4001'],  // 所有势力（敌对）
    },
    
    tier: 'B',
    difficulty: 'hard',
    
    unlockConditions: {
      level: 20,
      cost: 15000,
      special: '需要完�?黄天当立"成就',
    },
  },
];

/**
 * 根据ID获取势力信息
 */
export function getFactionById(factionId) {
  return S1_FACTIONS.find(f => f.id === factionId);
}

/**
 * 根据名称获取势力信息
 */
export function getFactionByName(name) {
  return S1_FACTIONS.find(f => f.name === name);
}

/**
 * 获取玩家可选择的势力列表（根据等级和条件）
 */
export function getAvailableFactions(playerLevel, playerAchievements = []) {
  return S1_FACTIONS.filter(faction => {
    // 检查等级要�?
    if (playerLevel < faction.unlockConditions.level) {
      return false;
    }
    
    // 检查特殊条件（成就�?
    if (faction.unlockConditions.special) {
      const requiredAchievement = faction.unlockConditions.special.match(/"(.+?)"/)?.[1];
      if (requiredAchievement && !playerAchievements.includes(requiredAchievement)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * 获取势力关系
 */
export function getFactionRelation(factionId1, factionId2) {
  const faction = getFactionById(factionId1);
  if (!faction) return 'neutral';
  
  if (faction.relations.allies.includes(factionId2)) return 'ally';
  if (faction.relations.enemies.includes(factionId2)) return 'enemy';
  return 'neutral';
}

/**
 * 获取势力统计信息
 */
export function getFactionStats() {
  return {
    total: S1_FACTIONS.length,
    byTier: {
      S: S1_FACTIONS.filter(f => f.tier === 'S').length,
      A: S1_FACTIONS.filter(f => f.tier === 'A').length,
      B: S1_FACTIONS.filter(f => f.tier === 'B').length,
      C: S1_FACTIONS.filter(f => f.tier === 'C').length,
    },
    byDifficulty: {
      easy: S1_FACTIONS.filter(f => f.difficulty === 'easy').length,
      medium: S1_FACTIONS.filter(f => f.difficulty === 'medium').length,
      hard: S1_FACTIONS.filter(f => f.difficulty === 'hard').length,
    },
  };
}

export default S1_FACTIONS;
