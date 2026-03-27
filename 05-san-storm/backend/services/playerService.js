/**
 * 玩家业务逻辑服务
 * 
 * @description 处理玩家角色创建、属性随机等业务逻辑
 */

const Player = require('../models/Player');
const { pool } = require('../database/connection');

class PlayerService {
  /**
   * 生成随机属性方案（3个方案：每种类型1个）
   * @param {string} rarity - 稀有度 (common, rare, epic, legendary, core)
   * @returns {Promise<Array<Object>>} 返回3个方案（3种类型各1个）
   */
  static async generateAttributeOptions(rarity = 'common') {
    // 从数据库加载技能数据（筛选san_1赛季的技能）
    const [skillsData] = await pool.query(`
      SELECT 
        skill_id as id,
        skill_name as name,
        skill_type as type,
        rarity,
        character_type as characterType
      FROM config_skills
      WHERE season = 'san_1'
    `);
    
    // 根据稀有度确定属性范围（与将领方案一致）
    const ranges = {
      common: { 
        military: { min: 44, max: 48 },
        strategist: { min: 44, max: 48 },
        balanced: { min: 48, max: 52 }, // +4点
        singleMax: 7.9 
      },
      rare: { 
        military: { min: 48, max: 52 },
        strategist: { min: 48, max: 52 },
        balanced: { min: 52, max: 56 }, // +4点
        singleMax: 8.4 
      },
      epic: { 
        military: { min: 52, max: 56 },
        strategist: { min: 52, max: 56 },
        balanced: { min: 56, max: 60 }, // +4点
        singleMax: 9.4 
      },
      legendary: { 
        military: { min: 56, max: 60 },
        strategist: { min: 56, max: 60 },
        balanced: { min: 60, max: 64 }, // +4点
        singleMax: 10.0 
      },
      core: { 
        military: { min: 56, max: 60 },
        strategist: { min: 56, max: 60 },
        balanced: { min: 60, max: 64 }, // +4点
        singleMax: 10.0 
      }
    };

    const rarityRanges = ranges[rarity] || ranges.common;
    const options = [];

    // 生成3个方案：每种类型1个
    options.push(this._generateSingleOption('Military', rarityRanges.military, rarityRanges.singleMax, rarity, skillsData));
    options.push(this._generateSingleOption('Strategist', rarityRanges.strategist, rarityRanges.singleMax, rarity, skillsData));
    options.push(this._generateSingleOption('Balanced', rarityRanges.balanced, rarityRanges.singleMax, rarity, skillsData));

    return options;
  }

  /**
   * 生成单个属性方案（采用将领方案的分组分配逻辑）
   * @private
   */
  static _generateSingleOption(type, range, singleMax, rarity, skillsData) {
    const { min, max } = range;
    const minAttr = 3.5; // 最小属性值（与CSV脚本一致）

    // 生成总点数（使用浮点数）
    const targetTotal = min + Math.random() * (max - min);

    // 直接生成属性（不需要重试，因为算法保证总和正确）
    let attributes;
    if (type === 'Military') {
      attributes = this._generateMilitaryAttributes(targetTotal, singleMax, minAttr);
    } else if (type === 'Strategist') {
      attributes = this._generateStrategistAttributes(targetTotal, singleMax, minAttr);
    } else {
      attributes = this._generateBalancedAttributes(targetTotal, singleMax, minAttr);
    }

    // 计算总点数
    const totalPoints = Object.values(attributes).reduce((sum, val) => sum + val, 0);

    // 转换为整数版本（×10）用于存储
    const attributesInt = {
      combat: Math.round(attributes.combat * 10),
      command: Math.round(attributes.command * 10),
      intelligence: Math.round(attributes.intelligence * 10),
      politics: Math.round(attributes.politics * 10),
      charm: Math.round(attributes.charm * 10),
      courage: Math.round(attributes.courage * 10),
      luck: Math.round(attributes.luck * 10)
    };

    // 生成技能（根据类型，传入skillsData）
    const skills = this._generateSkills(type, rarity, skillsData);

    return {
      type,
      totalPoints: totalPoints.toFixed(1),
      attributes: {
        combat: attributes.combat.toFixed(1),
        command: attributes.command.toFixed(1),
        intelligence: attributes.intelligence.toFixed(1),
        politics: attributes.politics.toFixed(1),
        charm: attributes.charm.toFixed(1),
        courage: attributes.courage.toFixed(1),
        luck: attributes.luck.toFixed(1)
      },
      attributesInt, // 整数版本（×10）用于存储
      skills
    };
  }

  /**
   * 生成武官型属性（Military）- v3.3规则
   * @private
   * 
   * 规则：
   * - 核心属性：运气 12%-16%
   * - 主要属性组：勇统武 46%-50%，差值≤3.5
   * - 次要属性组：智政魅（剩余）
   * - 任一主要≥1.0×任一次要
   */
  static _generateMilitaryAttributes(targetTotal, singleMax, minAttr) {
    const maxDiff = 3.5; // 主要属性组最大差值
    let attempts = 0;
    let isValid = false;
    let attributes = null;
    
    while (!isValid && attempts < 50) {
      attempts++;
      
      // 1. 计算核心属性（运气）
      const luckRatio = 0.12 + Math.random() * 0.04; // 12%-16%
      const luckPoints = targetTotal * luckRatio;
      let luck = luckPoints;
      
      // 2. 计算主要属性组点数（勇统武）
      const primaryRatio = 0.46 + Math.random() * 0.04; // 46%-50%
      const primaryTotal = targetTotal * primaryRatio;
      
      // 3. 计算次要属性组点数（智政魅）
      const secondaryTotal = targetTotal - luckPoints - primaryTotal;
      
      // 4. 在主要属性组内随机分配（3项）
      const priWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const priSum = priWeights.reduce((a, b) => a + b, 0);
      let courage = (priWeights[0] / priSum) * primaryTotal;
      let command = (priWeights[1] / priSum) * primaryTotal;
      let combat = (priWeights[2] / priSum) * primaryTotal;
      
      // 5. 在次要属性组内随机分配（3项）
      const secWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const secSum = secWeights.reduce((a, b) => a + b, 0);
      let intelligence = (secWeights[0] / secSum) * secondaryTotal;
      let politics = (secWeights[1] / secSum) * secondaryTotal;
      let charm = (secWeights[2] / secSum) * secondaryTotal;
      
      // 应用限制
      luck = Math.max(minAttr, Math.min(singleMax, luck));
      courage = Math.max(minAttr, Math.min(singleMax, courage));
      command = Math.max(minAttr, Math.min(singleMax, command));
      combat = Math.max(minAttr, Math.min(singleMax, combat));
      intelligence = Math.max(minAttr, Math.min(singleMax, intelligence));
      politics = Math.max(minAttr, Math.min(singleMax, politics));
      charm = Math.max(minAttr, Math.min(singleMax, charm));
      
      // 重新调整主要属性组以保持比例
      const actualPrimaryTotal = courage + command + combat;
      const actualSecondaryTotal = intelligence + politics + charm;
      
      // 按比例调整到目标总和
      const primaryAdjust = primaryTotal / actualPrimaryTotal;
      const secondaryAdjust = secondaryTotal / actualSecondaryTotal;
      
      const roundedAttrs = {
        luck: parseFloat(Math.min(singleMax, Math.max(minAttr, luck)).toFixed(1)),
        courage: parseFloat(Math.min(singleMax, Math.max(minAttr, courage * primaryAdjust)).toFixed(1)),
        command: parseFloat(Math.min(singleMax, Math.max(minAttr, command * primaryAdjust)).toFixed(1)),
        combat: parseFloat(Math.min(singleMax, Math.max(minAttr, combat * primaryAdjust)).toFixed(1)),
        intelligence: parseFloat(Math.min(singleMax, Math.max(minAttr, intelligence * secondaryAdjust)).toFixed(1)),
        politics: parseFloat(Math.min(singleMax, Math.max(minAttr, politics * secondaryAdjust)).toFixed(1)),
        charm: parseFloat(Math.min(singleMax, Math.max(minAttr, charm * secondaryAdjust)).toFixed(1))
      };
      
      // 验证主要3项属性差值
      const primaryValues = [roundedAttrs.courage, roundedAttrs.command, roundedAttrs.combat];
      const primaryMax = Math.max(...primaryValues);
      const primaryMin = Math.min(...primaryValues);
      const primaryDiff = primaryMax - primaryMin;
      
      // 验证次要3项属性差值
      const secondaryValues = [roundedAttrs.intelligence, roundedAttrs.politics, roundedAttrs.charm];
      const secondaryMax = Math.max(...secondaryValues);
      const secondaryMin = Math.min(...secondaryValues);
      const secondaryDiff = secondaryMax - secondaryMin;
      
      // 验证主要属性 ≥ 1.0 × 次要属性
      const primaryMinValue = Math.min(...primaryValues);
      const secondaryMaxValue = Math.max(...secondaryValues);
      const ratio = primaryMinValue / secondaryMaxValue;
      
      if (primaryDiff <= maxDiff && secondaryDiff <= maxDiff && ratio >= 1.0) {
        isValid = true;
        attributes = roundedAttrs;
      }
    }
    
    // 如果50次都没成功，返回最后一次的结果
    return attributes || {
      luck: parseFloat((targetTotal * 0.14).toFixed(1)),
      courage: parseFloat((targetTotal * 0.14).toFixed(1)),
      command: parseFloat((targetTotal * 0.14).toFixed(1)),
      combat: parseFloat((targetTotal * 0.14).toFixed(1)),
      intelligence: parseFloat((targetTotal * 0.14).toFixed(1)),
      politics: parseFloat((targetTotal * 0.14).toFixed(1)),
      charm: parseFloat((targetTotal * 0.16).toFixed(1))
    };
  }

  /**
   * 生成军师型属性（Strategist）- v3.3规则
   * @private
   * 
   * 规则：
   * - 核心属性：运气 14%-18%（从16%-20%降低2%）
   * - 主要属性组：智政魅 44%-48%（从42%-46%提高2%作为补偿）
   * - 次要属性组：勇统武（剩余）
   * - 任一主要≥1.0×任一次要
   */
  static _generateStrategistAttributes(targetTotal, singleMax, minAttr) {
    const maxDiff = 3.5; // 主要属性组最大差值
    let attempts = 0;
    let isValid = false;
    let attributes = null;
    
    while (!isValid && attempts < 50) {
      attempts++;
      
      // 1. 计算核心属性（运气）
      const luckRatio = 0.14 + Math.random() * 0.04; // 14%-18%（降低运气占比）
      const luckPoints = targetTotal * luckRatio;
      let luck = luckPoints;
      
      // 2. 计算主要属性组点数（智政魅）
      const primaryRatio = 0.44 + Math.random() * 0.04; // 44%-48%（提高2%作为补偿）
      const primaryTotal = targetTotal * primaryRatio;
      
      // 3. 计算次要属性组点数（勇统武）
      const secondaryTotal = targetTotal - luckPoints - primaryTotal;
      
      // 4. 在主要属性组内随机分配（3项）
      const priWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const priSum = priWeights.reduce((a, b) => a + b, 0);
      let intelligence = (priWeights[0] / priSum) * primaryTotal;
      let politics = (priWeights[1] / priSum) * primaryTotal;
      let charm = (priWeights[2] / priSum) * primaryTotal;
      
      // 5. 在次要属性组内随机分配（3项）
      const secWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const secSum = secWeights.reduce((a, b) => a + b, 0);
      let courage = (secWeights[0] / secSum) * secondaryTotal;
      let command = (secWeights[1] / secSum) * secondaryTotal;
      let combat = (secWeights[2] / secSum) * secondaryTotal;
      
      // 应用限制
      luck = Math.max(minAttr, Math.min(singleMax, luck));
      intelligence = Math.max(minAttr, Math.min(singleMax, intelligence));
      politics = Math.max(minAttr, Math.min(singleMax, politics));
      charm = Math.max(minAttr, Math.min(singleMax, charm));
      courage = Math.max(minAttr, Math.min(singleMax, courage));
      command = Math.max(minAttr, Math.min(singleMax, command));
      combat = Math.max(minAttr, Math.min(singleMax, combat));
      
      // 重新调整主要属性组以保持比例
      const actualPrimaryTotal = intelligence + politics + charm;
      const actualSecondaryTotal = courage + command + combat;
      
      // 按比例调整到目标总和
      const primaryAdjust = primaryTotal / actualPrimaryTotal;
      const secondaryAdjust = secondaryTotal / actualSecondaryTotal;
      
      const roundedAttrs = {
        luck: parseFloat(Math.min(singleMax, Math.max(minAttr, luck)).toFixed(1)),
        intelligence: parseFloat(Math.min(singleMax, Math.max(minAttr, intelligence * primaryAdjust)).toFixed(1)),
        politics: parseFloat(Math.min(singleMax, Math.max(minAttr, politics * primaryAdjust)).toFixed(1)),
        charm: parseFloat(Math.min(singleMax, Math.max(minAttr, charm * primaryAdjust)).toFixed(1)),
        courage: parseFloat(Math.min(singleMax, Math.max(minAttr, courage * secondaryAdjust)).toFixed(1)),
        command: parseFloat(Math.min(singleMax, Math.max(minAttr, command * secondaryAdjust)).toFixed(1)),
        combat: parseFloat(Math.min(singleMax, Math.max(minAttr, combat * secondaryAdjust)).toFixed(1))
      };
      
      // 验证主要3项属性差值
      const primaryValues = [roundedAttrs.intelligence, roundedAttrs.politics, roundedAttrs.charm];
      const primaryMax = Math.max(...primaryValues);
      const primaryMin = Math.min(...primaryValues);
      const primaryDiff = primaryMax - primaryMin;
      
      // 验证次要3项属性差值
      const secondaryValues = [roundedAttrs.courage, roundedAttrs.command, roundedAttrs.combat];
      const secondaryMax = Math.max(...secondaryValues);
      const secondaryMin = Math.min(...secondaryValues);
      const secondaryDiff = secondaryMax - secondaryMin;
      
      // 验证主要属性 ≥ 1.0 × 次要属性
      const primaryMinValue = Math.min(...primaryValues);
      const secondaryMaxValue = Math.max(...secondaryValues);
      const ratio = primaryMinValue / secondaryMaxValue;
      
      if (primaryDiff <= maxDiff && secondaryDiff <= maxDiff && ratio >= 1.0) {
        isValid = true;
        attributes = roundedAttrs;
      }
    }
    
    // 如果50次都没成功，返回最后一次的结果
    return attributes || {
      luck: parseFloat((targetTotal * 0.16).toFixed(1)),
      courage: parseFloat((targetTotal * 0.14).toFixed(1)),
      command: parseFloat((targetTotal * 0.14).toFixed(1)),
      combat: parseFloat((targetTotal * 0.14).toFixed(1)),
      intelligence: parseFloat((targetTotal * 0.14).toFixed(1)),
      politics: parseFloat((targetTotal * 0.14).toFixed(1)),
      charm: parseFloat((targetTotal * 0.14).toFixed(1))
    };
  }

  /**
   * 生成文武双全型属性（Balanced）- v3.3规则
   * @private
   * 
   * 规则：
   * - 核心属性：运气 14%-16%（从14%-18%降低）
   * - 其他6项属性差值 ≤ 2.0
   * - 全部7项属性差值 ≤ 2.0
   * - 基础点数已包含+4点加成（在范围中）
   */
  static _generateBalancedAttributes(targetTotal, singleMax, minAttr) {
    let attempts = 0;
    let isValid = false;
    let attributes = null;
    
    while (!isValid && attempts < 50) {
      attempts++;
      
      // 1. 计算核心属性（运气）
      const luckRatio = 0.12 + Math.random() * 0.04; // 12%-16%（降低运气占比）
      const luckPoints = targetTotal * luckRatio;
      let luck = luckPoints;
      
      // 2. 计算剩余点数
      const remainingPoints = targetTotal - luckPoints;
      
      // 3. 计算其他6项属性的平均值
      const avgValue = remainingPoints / 6;
      
      // 4. 生成6个随机偏移值（范围：-1.0 到 +1.0）
      const offsets = [];
      for (let i = 0; i < 6; i++) {
        offsets.push(-1.0 + Math.random() * 2.0);
      }
      
      // 5. 应用偏移值
      const tempAttrs = {
        luck: luck,
        courage: avgValue + offsets[0],
        command: avgValue + offsets[1],
        combat: avgValue + offsets[2],
        intelligence: avgValue + offsets[3],
        politics: avgValue + offsets[4],
        charm: avgValue + offsets[5]
      };
      
      // 6. 调整确保总和不变
      const currentTotal = Object.values(tempAttrs).reduce((a, b) => a + b, 0);
      const adjustRatio = targetTotal / currentTotal;
      Object.keys(tempAttrs).forEach(key => {
        tempAttrs[key] = parseFloat((tempAttrs[key] * adjustRatio).toFixed(1));
      });
      
      // 7. 验证差值 ≤ 2.0（包括运气）
      let maxAttr = Math.max(...Object.values(tempAttrs));
      let minAttrVal = Math.min(...Object.values(tempAttrs));
      
      if (maxAttr - minAttrVal > 2.0) {
        // 压缩到差值2.0范围内
        const range = maxAttr - minAttrVal;
        const targetRange = 2.0;
        const compressRatio = targetRange / range;
        const center = (maxAttr + minAttrVal) / 2;
        
        Object.keys(tempAttrs).forEach(key => {
          tempAttrs[key] = parseFloat((center + (tempAttrs[key] - center) * compressRatio).toFixed(1));
        });
        
        // 再次调整总和
        const newTotal = Object.values(tempAttrs).reduce((a, b) => a + b, 0);
        const finalRatio = targetTotal / newTotal;
        Object.keys(tempAttrs).forEach(key => {
          tempAttrs[key] = parseFloat((tempAttrs[key] * finalRatio).toFixed(1));
        });
      }
      
      // 验证差值
      maxAttr = Math.max(...Object.values(tempAttrs));
      minAttrVal = Math.min(...Object.values(tempAttrs));
      const diff = maxAttr - minAttrVal;
      
      if (diff <= 2.0) {
        isValid = true;
        attributes = tempAttrs;
      }
    }
    
    // 确保所有属性在3.5-maxSingleAttr范围内
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        if (attributes[key] < minAttr) {
          attributes[key] = minAttr;
        }
        if (attributes[key] > singleMax) {
          attributes[key] = singleMax;
        }
      });
    }
    
    // 如果50次都没成功，返回平均分配
    return attributes || {
      luck: parseFloat((targetTotal / 7).toFixed(1)),
      courage: parseFloat((targetTotal / 7).toFixed(1)),
      command: parseFloat((targetTotal / 7).toFixed(1)),
      combat: parseFloat((targetTotal / 7).toFixed(1)),
      intelligence: parseFloat((targetTotal / 7).toFixed(1)),
      politics: parseFloat((targetTotal / 7).toFixed(1)),
      charm: parseFloat((targetTotal / 7).toFixed(1))
    };
  }

  /**
   * 生成技能（照抄CSV脚本逻辑）
   * @private
   */
  static _generateSkills(type, rarity, skillsData) {
    const rarityMap = {
      core: '5',
      legendary: '4',
      epic: '3',
      rare: '2',
      common: '1',
    };
    
    const rarityCode = rarityMap[rarity];
    
    // 筛选主动技能，使用正向匹配逻辑
    const activeSkills = skillsData.filter(s => {
      // 必须是对应稀有度的主动技能
      if (!s.id.startsWith(`san_1_skill_1_${rarityCode}`)) return false;
      
      // 如果技能指定了character_type，检查是否匹配
      if (s.characterType && s.characterType !== '') {
        // 支持多个类型（用逗号或分号分隔）
        const allowedTypes = s.characterType.split(/[,;]/).map(t => t.trim());
        return allowedTypes.includes(type.toLowerCase());
      }
      
      // 没有指定character_type，所有类型都可用
      return true;
    });
    
    // 筛选被动技能，使用正向匹配逻辑
    const passiveSkills = skillsData.filter(s => {
      // 必须是对应稀有度的被动技能
      if (!s.id.startsWith(`san_1_skill_2_${rarityCode}`)) return false;
      
      // 如果技能指定了character_type，检查是否匹配
      if (s.characterType && s.characterType !== '') {
        // 支持多个类型（用逗号或分号分隔）
        const allowedTypes = s.characterType.split(/[,;]/).map(t => t.trim());
        return allowedTypes.includes(type.toLowerCase());
      }
      
      // 没有指定character_type，所有类型都可用
      return true;
    });
    
    // 随机选择技能对象（包含完整信息）
    const skill_1 = activeSkills.length > 0 
      ? activeSkills[Math.floor(Math.random() * activeSkills.length)]
      : null;
    const skill_2 = passiveSkills.length > 0 
      ? passiveSkills[Math.floor(Math.random() * passiveSkills.length)]
      : null;
    
    return { skill_1, skill_2 };
  }

  /**
   * 生成随机整数
   * @private
   */
  static _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 验证角色名
   * @param {string} name - 角色名
   * @returns {Object} {valid: boolean, error?: string}
   */
  static validateCharacterName(name) {
    if (!name || name.trim() === '') {
      return { valid: false, error: '角色名不能为空' };
    }

    const length = name.length;
    if (length < 1 || length > 3) {
      return { valid: false, error: '角色名必须为1-3个中文字符' };
    }

    // 检查是否只包含中文字符
    const chineseRegex = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/;
    if (!chineseRegex.test(name)) {
      return { valid: false, error: '角色名只能包含中文字符' };
    }

    // 检查敏感词（简化版）
    const sensitiveWords = ['管理员', '客服', 'GM', '系统', '官方'];
    if (sensitiveWords.some(word => name.includes(word))) {
      return { valid: false, error: '角色名包含敏感词，请重新输入' };
    }

    return { valid: true };
  }

  /**
   * 创建玩家角色
   * @param {Object} data - 角色创建数据
   * @returns {Promise<Object>}
   */
  static async createCharacter(data) {
    const {
      playerId,
      characterName,
      factionId,
      factionName,
      attributes, // 整数版本（×10）
      skills, // 技能 {skill_1, skill_2}
      serverId,
      initialSilver = 0, // 剩余银两（从角色创建带入游戏）
      avatar = null // 头像路径
    } = data;

    // 验证角色名
    const nameValidation = this.validateCharacterName(characterName);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // 检查玩家是否已存在
    const exists = await Player.exists(playerId);
    if (exists) {
      throw new Error('该账号已创建角色');
    }

    // 检查角色名是否重复
    const nameTaken = await Player.isNameTaken(characterName, serverId);
    if (nameTaken) {
      throw new Error('该角色名已被使用，请重新输入');
    }

    // 创建玩家角色
    const playerData = {
      player_id: playerId,
      character_name: characterName,
      faction_id: factionId,
      faction_name: factionName,
      avatar: avatar,
      combat: attributes.combat,
      intelligence: attributes.intelligence,
      command: attributes.command,
      politics: attributes.politics,
      charm: attributes.charm,
      courage: attributes.courage,
      luck: attributes.luck,
      skill_1: skills?.skill_1?.id || skills?.skill_1 || null,
      skill_2: skills?.skill_2?.id || skills?.skill_2 || null,
      // 官职：初始无官职，需要完成第一个事件后获得
      current_position_id: null,
      current_position_name: null,
      position_level: null,
      // 初始银两：使用角色创建流程中剩余的银两
      initial_silver: initialSilver,
      // 初始粮草：0（不额外赠送）
      initial_food: 0
    };

    const player = await Player.create(playerData);
    return player;
  }

  /**
   * 添加初始部队卡
   * @param {string} playerId - 玩家ID
   * @param {Array<string>} troopIds - 部队卡ID数组
   */
  static async addInitialTroops(playerId, troopIds) {
    const { pool } = require('../database/connection');

    for (const troopId of troopIds) {
      // 查询部队配置
      const [troopConfigs] = await pool.query(
        'SELECT * FROM config_troops WHERE troop_id = ?',
        [troopId]
      );

      if (troopConfigs.length === 0) {
        console.warn(`部队配置不存在: ${troopId}`);
        continue;
      }

      const troopConfig = troopConfigs[0];

      // 生成卡牌实例ID
      const instanceId = `${playerId}_troop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 插入卡牌实例
      await pool.query(`
        INSERT INTO player_cards (
          instance_id, player_id, card_type, card_id, rarity,
          current_troops, battle_count, max_battle_count
        ) VALUES (?, ?, 'troop', ?, ?, ?, 0, ?)
      `, [
        instanceId,
        playerId,
        troopId,
        troopConfig.rarity,
        troopConfig.max_troops, // 初始兵力=最大兵力
        this._getMaxBattleCount(troopConfig.rarity)
      ]);
    }
  }

  /**
   * 获取最大战斗次数
   * @private
   */
  static _getMaxBattleCount(rarity) {
    const counts = {
      common: 10,
      rare: 15,
      epic: 20,
      legendary: 25,
      core: 30
    };
    return counts[rarity] || 10;
  }
}

module.exports = PlayerService;
