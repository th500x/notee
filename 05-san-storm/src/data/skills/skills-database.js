/**
 * 武将技能数据库
 * 参考三国志11特技系统
 * 
 * 技能分类：
 * - 战斗类：影响战斗表现
 * - 统帅类：影响部队和士气
 * - 智谋类：影响计谋和策略
 * - 内政类：影响城市发展
 * - 特殊类：独特效果
 */

export const SKILLS_DATABASE = {
  // ========== 战斗类技能 ==========
  
  飞将: {
    id: 'skill_combat_0001',
    name: '飞将',
    type: 'combat',
    rarity: 'legendary',
    description: '骑兵移动力+1，无视地形影响',
    effects: {
      cavalryMovement: 1,
      ignoreTerrainPenalty: true,
    },
    holders: ['吕布'],
  },
  
  神速: {
    id: 'skill_combat_0002',
    name: '神速',
    type: 'combat',
    rarity: 'epic',
    description: '移动力+1，先制攻击',
    effects: {
      movement: 1,
      firstStrike: true,
    },
    holders: ['夏侯渊'],
  },
  
  无双: {
    id: 'skill_combat_0003',
    name: '无双',
    type: 'combat',
    rarity: 'legendary',
    description: '单挑必胜，战斗时攻击力+30%',
    effects: {
      duelWin: true,
      attackBonus: 0.3,
    },
    holders: ['吕布', '关羽', '张飞'],
  },
  
  突击: {
    id: 'skill_combat_0004',
    name: '突击',
    type: 'combat',
    rarity: 'common',
    description: '冲锋时攻击力+20%',
    effects: {
      chargeAttackBonus: 0.2,
    },
    holders: ['典韦', '许褚', '张飞', '赵云', '太史慈', '文丑', '颜良'],
  },
  
  破阵: {
    id: 'skill_combat_0005',
    name: '破阵',
    type: 'combat',
    rarity: 'rare',
    description: '对阵型额外+20%伤害',
    effects: {
      formationDamageBonus: 0.2,
    },
    holders: ['张辽', '徐晃', '皇甫嵩', '朱儁'],
  },
  
  威震: {
    id: 'skill_combat_0006',
    name: '威震',
    type: 'combat',
    rarity: 'epic',
    description: '战斗开始时，敌方士气-1.0',
    effects: {
      enemyMoraleDebuff: 1.0,
    },
    holders: ['张辽'],
  },
  
  万人敌: {
    id: 'skill_combat_0007',
    name: '万人敌',
    type: 'combat',
    rarity: 'legendary',
    description: '战斗时攻击力+20%，防御力+20%',
    effects: {
      attackBonus: 0.2,
      defenseBonus: 0.2,
    },
    holders: ['张飞', '关羽'],
  },

  龙胆: {
    id: 'skill_combat_0008',
    name: '龙胆',
    type: 'combat',
    rarity: 'legendary',
    description: '单挑时武力+2.0，战斗时防御力+20%',
    effects: {
      duelCombatBonus: 2.0,
      defenseBonus: 0.2,
    },
    holders: ['赵云'],
  },
  
  神射: {
    id: 'skill_combat_0009',
    name: '神射',
    type: 'combat',
    rarity: 'rare',
    description: '弓箭攻击范围+1，命中率+20%',
    effects: {
      rangeBonus: 1,
      accuracyBonus: 0.2,
    },
    holders: ['太史慈', '黄忠'],
  },
  
  铁壁: {
    id: 'skill_combat_0010',
    name: '铁壁',
    type: 'combat',
    rarity: 'epic',
    description: '防御力+30%，受到伤害-20%',
    effects: {
      defenseBonus: 0.3,
      damageReduction: 0.2,
    },
    holders: ['满宠', '曹仁'],
  },
  
  // ========== 统帅类技能 ==========
  
  激励: {
    id: 'skill_command_0001',
    name: '激励',
    type: 'command',
    rarity: 'common',
    description: '部队士气+1.0',
    effects: {
      moraleBonus: 1.0,
    },
    holders: ['刘备', '卢植', '皇甫嵩', '鲍信', '臧洪'],
  },
  
  坚守: {
    id: 'skill_command_0002',
    name: '坚守',
    type: 'command',
    rarity: 'common',
    description: '防守时防御力+20%',
    effects: {
      defenseBonus: 0.2,
      condition: 'defending',
    },
    holders: ['黄盖', '程普', '韩当', '皇甫嵩', '朱儁', '李典', '于禁'],
  },
  
  护卫: {
    id: 'skill_command_0003',
    name: '护卫',
    type: 'command',
    rarity: 'rare',
    description: '保护主将，受到攻击时反击伤害+30%',
    effects: {
      protectLeader: true,
      counterDamageBonus: 0.3,
    },
    holders: ['典韦', '许褚'],
  },
  
  // ========== 智谋类技能 ==========
  
  鬼才: {
    id: 'skill_intelligence_0001',
    name: '鬼才',
    type: 'intelligence',
    rarity: 'legendary',
    description: '计谋成功率+30%，计谋伤害+20%',
    effects: {
      strategySuccessBonus: 0.3,
      strategyDamageBonus: 0.2,
    },
    holders: ['郭嘉'],
  },
  
  深谋: {
    id: 'skill_intelligence_0002',
    name: '深谋',
    type: 'intelligence',
    rarity: 'epic',
    description: '计谋成功率+20%',
    effects: {
      strategySuccessBonus: 0.2,
    },
    holders: ['荀彧', '荀攸', '贾诩', '陈宫'],
  },
  
  洞察: {
    id: 'skill_intelligence_0003',
    name: '洞察',
    type: 'intelligence',
    rarity: 'epic',
    description: '看穿敌方计谋，免疫计谋伤害50%',
    effects: {
      strategyResistance: 0.5,
      seeEnemyStrategy: true,
    },
    holders: ['郭嘉', '司马懿'],
  },
  
  奇计: {
    id: 'skill_intelligence_0004',
    name: '奇计',
    type: 'intelligence',
    rarity: 'rare',
    description: '计谋消耗-20%，计谋冷却-1回合',
    effects: {
      strategyCostReduction: 0.2,
      strategyCooldownReduction: 1,
    },
    holders: ['郭嘉', '贾诩'],
  },
  
  计略: {
    id: 'skill_intelligence_0005',
    name: '计略',
    type: 'intelligence',
    rarity: 'common',
    description: '计谋成功率+10%',
    effects: {
      strategySuccessBonus: 0.1,
    },
    holders: ['陈宫', '桥瑁'],
  },
  
  火攻: {
    id: 'skill_intelligence_0006',
    name: '火攻',
    type: 'intelligence',
    rarity: 'epic',
    description: '火系计谋伤害+50%',
    effects: {
      fireDamageBonus: 0.5,
    },
    holders: ['周瑜', '黄盖'],
  },
  
  反计: {
    id: 'skill_intelligence_0007',
    name: '反计',
    type: 'intelligence',
    rarity: 'epic',
    description: '受到计谋攻击时，有30%概率反弹',
    effects: {
      strategyReflectChance: 0.3,
    },
    holders: ['周瑜'],
  },
  
  // ========== 内政类技能 ==========
  
  内政: {
    id: 'skill_politics_0001',
    name: '内政',
    type: 'politics',
    rarity: 'common',
    description: '城市发展速度+20%',
    effects: {
      cityDevelopmentBonus: 0.2,
    },
    holders: ['荀彧', '程昱', '陈宫', '卢植', '刘表', '陶谦', '孔融', '张鲁'],
  },
  
  屯田: {
    id: 'skill_politics_0002',
    name: '屯田',
    type: 'politics',
    rarity: 'epic',
    description: '粮食产量+30%',
    effects: {
      foodProductionBonus: 0.3,
    },
    holders: ['曹操', '邓艾'],
  },
  
  招募: {
    id: 'skill_politics_0003',
    name: '招募',
    type: 'politics',
    rarity: 'common',
    description: '招募武将成功率+20%',
    effects: {
      recruitSuccessBonus: 0.2,
    },
    holders: ['刘备', '袁绍', '陶谦'],
  },
  
  外交: {
    id: 'skill_politics_0004',
    name: '外交',
    type: 'politics',
    rarity: 'common',
    description: '外交成功率+20%',
    effects: {
      diplomacySuccessBonus: 0.2,
    },
    holders: ['孔融', '张邈'],
  },
  
  // ========== 特殊类技能 ==========
  
  仁德: {
    id: 'skill_special_0001',
    name: '仁德',
    type: 'special',
    rarity: 'legendary',
    description: '民心+2.0，招募成功率+30%',
    effects: {
      loyaltyBonus: 2.0,
      recruitSuccessBonus: 0.3,
    },
    holders: ['刘备'],
  },
  
  奸雄: {
    id: 'skill_special_0002',
    name: '奸雄',
    type: 'special',
    rarity: 'legendary',
    description: '全属性+1.0，计谋成功率+20%',
    effects: {
      allAttributesBonus: 1.0,
      strategySuccessBonus: 0.2,
    },
    holders: ['曹操'],
  },
  
  挟天子: {
    id: 'skill_special_0003',
    name: '挟天子',
    type: 'special',
    rarity: 'legendary',
    description: '威望+3.0，招募成功率+50%',
    effects: {
      prestigeBonus: 3.0,
      recruitSuccessBonus: 0.5,
    },
    holders: ['曹操'],
  },
  
  武圣: {
    id: 'skill_special_0004',
    name: '武圣',
    type: 'special',
    rarity: 'legendary',
    description: '武力+2.0，单挑必胜',
    effects: {
      combatBonus: 2.0,
      duelWin: true,
    },
    holders: ['关羽'],
  },
  
  义绝: {
    id: 'skill_special_0005',
    name: '义绝',
    type: 'special',
    rarity: 'legendary',
    description: '忠诚度永不下降，士气+2.0',
    effects: {
      loyaltyNeverDecrease: true,
      moraleBonus: 2.0,
    },
    holders: ['关羽'],
  },
  
  单骑: {
    id: 'skill_special_0006',
    name: '单骑',
    type: 'special',
    rarity: 'epic',
    description: '单独行动时，全属性+1.5',
    effects: {
      soloBonus: 1.5,
    },
    holders: ['关羽', '赵云'],
  },
  
  救主: {
    id: 'skill_special_0007',
    name: '救主',
    type: 'special',
    rarity: 'epic',
    description: '保护主将时，防御力+50%',
    effects: {
      protectLeaderDefenseBonus: 0.5,
    },
    holders: ['赵云'],
  },
  
  咆哮: {
    id: 'skill_special_0008',
    name: '咆哮',
    type: 'special',
    rarity: 'epic',
    description: '战斗开始时，敌方士气-1.5',
    effects: {
      enemyMoraleDebuff: 1.5,
    },
    holders: ['张飞'],
  },
  
  江东猛虎: {
    id: 'skill_special_0009',
    name: '江东猛虎',
    type: 'special',
    rarity: 'legendary',
    description: '在江东地区，全属性+1.5',
    effects: {
      regionalBonus: 1.5,
      region: '江东',
    },
    holders: ['孙坚'],
  },
  
  破虏: {
    id: 'skill_special_0010',
    name: '破虏',
    type: 'special',
    rarity: 'epic',
    description: '攻击时，无视敌方1.0防御力',
    effects: {
      armorPenetration: 1.0,
    },
    holders: ['孙坚'],
  },
  
  英姿: {
    id: 'skill_special_0011',
    name: '英姿',
    type: 'special',
    rarity: 'epic',
    description: '魅力+1.5，计谋成功率+20%',
    effects: {
      charismaBonus: 1.5,
      strategySuccessBonus: 0.2,
    },
    holders: ['周瑜'],
  },
  
  王佐: {
    id: 'skill_special_0012',
    name: '王佐',
    type: 'special',
    rarity: 'legendary',
    description: '智力+2.0，政治+2.0',
    effects: {
      intelligenceBonus: 2.0,
      politicsBonus: 2.0,
    },
    holders: ['荀彧'],
  },
  
  奇策: {
    id: 'skill_special_0013',
    name: '奇策',
    type: 'special',
    rarity: 'epic',
    description: '计谋成功率+25%，计谋消耗-30%',
    effects: {
      strategySuccessBonus: 0.25,
      strategyCostReduction: 0.3,
    },
    holders: ['荀攸'],
  },
  
  智囊: {
    id: 'skill_special_0014',
    name: '智囊',
    type: 'special',
    rarity: 'epic',
    description: '智力+1.5，计谋成功率+15%',
    effects: {
      intelligenceBonus: 1.5,
      strategySuccessBonus: 0.15,
    },
    holders: ['程昱', '陈宫'],
  },
  
  毒士: {
    id: 'skill_special_0015',
    name: '毒士',
    type: 'special',
    rarity: 'legendary',
    description: '离间计成功率+50%，计谋伤害+30%',
    effects: {
      dissensionSuccessBonus: 0.5,
      strategyDamageBonus: 0.3,
    },
    holders: ['贾诩'],
  },
  
  离间: {
    id: 'skill_special_0016',
    name: '离间',
    type: 'special',
    rarity: 'epic',
    description: '离间计成功率+30%',
    effects: {
      dissensionSuccessBonus: 0.3,
    },
    holders: ['贾诩', '陈宫'],
  },
  
  暴君: {
    id: 'skill_special_0017',
    name: '暴君',
    type: 'special',
    rarity: 'epic',
    description: '威压+2.0，民心-1.0',
    effects: {
      intimidationBonus: 2.0,
      loyaltyPenalty: 1.0,
    },
    holders: ['董卓'],
  },
  
  威压: {
    id: 'skill_special_0018',
    name: '威压',
    type: 'special',
    rarity: 'rare',
    description: '敌方士气-0.5',
    effects: {
      enemyMoraleDebuff: 0.5,
    },
    holders: ['董卓', '李傕', '郭汜'],
  },
  
  掠夺: {
    id: 'skill_special_0019',
    name: '掠夺',
    type: 'special',
    rarity: 'common',
    description: '战斗胜利后，额外获得30%金币',
    effects: {
      goldLootBonus: 0.3,
    },
    holders: ['董卓', '袁术', '韩遂', '张燕', '李傕', '郭汜'],
  },
  
  四世三公: {
    id: 'skill_special_0020',
    name: '四世三公',
    type: 'special',
    rarity: 'epic',
    description: '威望+2.0，招募成功率+40%',
    effects: {
      prestigeBonus: 2.0,
      recruitSuccessBonus: 0.4,
    },
    holders: ['袁绍', '袁术'],
  },
  
  名门: {
    id: 'skill_special_0021',
    name: '名门',
    type: 'special',
    rarity: 'rare',
    description: '威望+1.0，招募成功率+20%',
    effects: {
      prestigeBonus: 1.0,
      recruitSuccessBonus: 0.2,
    },
    holders: ['袁绍'],
  },
  
  太平道: {
    id: 'skill_special_0022',
    name: '太平道',
    type: 'special',
    rarity: 'epic',
    description: '治疗效果+50%，民心+1.5',
    effects: {
      healingBonus: 0.5,
      loyaltyBonus: 1.5,
    },
    holders: ['张角'],
  },
  
  妖术: {
    id: 'skill_special_0023',
    name: '妖术',
    type: 'special',
    rarity: 'rare',
    description: '计谋成功率+15%，治疗效果+30%',
    effects: {
      strategySuccessBonus: 0.15,
      healingBonus: 0.3,
    },
    holders: ['张角', '张宝', '张梁'],
  },
  
  治疗: {
    id: 'skill_special_0024',
    name: '治疗',
    type: 'special',
    rarity: 'common',
    description: '治疗效果+20%',
    effects: {
      healingBonus: 0.2,
    },
    holders: ['张角', '张宝', '张梁', '张鲁', '华佗'],
  },
};

// 按类型分类
export const SKILLS_BY_TYPE = {
  combat: Object.values(SKILLS_DATABASE).filter(s => s.type === 'combat'),
  command: Object.values(SKILLS_DATABASE).filter(s => s.type === 'command'),
  intelligence: Object.values(SKILLS_DATABASE).filter(s => s.type === 'intelligence'),
  politics: Object.values(SKILLS_DATABASE).filter(s => s.type === 'politics'),
  special: Object.values(SKILLS_DATABASE).filter(s => s.type === 'special'),
};

// 按稀有度分类
export const SKILLS_BY_RARITY = {
  legendary: Object.values(SKILLS_DATABASE).filter(s => s.rarity === 'legendary'),
  epic: Object.values(SKILLS_DATABASE).filter(s => s.rarity === 'epic'),
  rare: Object.values(SKILLS_DATABASE).filter(s => s.rarity === 'rare'),
  common: Object.values(SKILLS_DATABASE).filter(s => s.rarity === 'common'),
};

// 查询函数
export function getSkillByName(name) {
  return SKILLS_DATABASE[name];
}

export function getSkillsByHolder(characterName) {
  return Object.values(SKILLS_DATABASE).filter(skill => 
    skill.holders.includes(characterName)
  );
}

export function getSkillsByType(type) {
  return SKILLS_BY_TYPE[type] || [];
}

export function getSkillsByRarity(rarity) {
  return SKILLS_BY_RARITY[rarity] || [];
}
