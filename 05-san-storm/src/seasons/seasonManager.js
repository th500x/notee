/**
 * 赛季管理器
 * 
 * 负责赛季的加载、切换、数据继承等功能
 */

import { S1_CONFIG } from './san_1/config.js';

class SeasonManager {
  constructor() {
    this.seasons = new Map();
    this.currentSeason = null;
    this.loadSeasons();
  }

  /**
   * 加载所有赛季配置
   */
  loadSeasons() {
    // 注册S1赛季
    this.seasons.set('s1', S1_CONFIG);
    
    // 未来赛季在此注册
    // this.seasons.set('s2', S2_CONFIG);
    // this.seasons.set('s3', S3_CONFIG);
  }

  /**
   * 获取当前赛季
   * @returns {Object} 当前赛季配置
   */
  getCurrentSeason() {
    if (this.currentSeason) {
      return this.currentSeason;
    }

    // 根据日期自动判断当前赛季
    const now = new Date();
    
    for (const [id, config] of this.seasons) {
      const start = new Date(config.timeline.startDate);
      const end = new Date(config.timeline.endDate);
      
      if (now >= start && now <= end) {
        this.currentSeason = config;
        return config;
      }
    }

    // 默认返回最新赛季
    return this.getLatestSeason();
  }

  /**
   * 获取最新赛季
   * @returns {Object} 最新赛季配置
   */
  getLatestSeason() {
    const seasons = Array.from(this.seasons.values());
    return seasons[seasons.length - 1];
  }

  /**
   * 获取指定赛季
   * @param {string} seasonId - 赛季ID
   * @returns {Object|null} 赛季配置
   */
  getSeason(seasonId) {
    return this.seasons.get(seasonId) || null;
  }

  /**
   * 检查赛季是否激活
   * @param {string} seasonId - 赛季ID
   * @returns {boolean}
   */
  isSeasonActive(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) return false;

    const now = new Date();
    const start = new Date(season.timeline.startDate);
    const end = new Date(season.timeline.endDate);

    return now >= start && now <= end;
  }

  /**
   * 获取赛季剩余时间
   * @param {string} seasonId - 赛季ID
   * @returns {Object|null} 剩余时间信息
   */
  getSeasonTimeRemaining(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) return null;

    const now = new Date();
    const end = new Date(season.timeline.endDate);
    const remaining = end - now;

    if (remaining <= 0) {
      return { 
        ended: true,
        days: 0,
        hours: 0,
        totalMs: 0,
      };
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ended: false,
      days,
      hours,
      minutes,
      totalMs: remaining,
    };
  }

  /**
   * 动态加载赛季资源
   * @param {string} seasonId - 赛季ID
   * @returns {Promise<Object>} 赛季资源
   */
  async loadSeasonAssets(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    try {
      // 动态导入赛季模块
      // seasonId 's1' -> 'san_1'
      const seasonNumber = seasonId.slice(1);  // 's1' -> '1'
      const seasonDir = `san_${seasonNumber}`;  // 'san_1'
      
      const modules = await Promise.all([
        import(`./san_${seasonNumber}/map/mapData.js`).catch(() => null),
        import(`./san_${seasonNumber}/map/cities.js`).catch(() => null),
        import(`./san_${seasonNumber}/characters/index.js`).catch(() => null),
        import(`./san_${seasonNumber}/troops/index.js`).catch(() => null),
        import(`./san_${seasonNumber}/events/seasonEvents.js`).catch(() => null),
      ]);

      return {
        map: modules[0]?.default || null,
        cities: modules[1]?.default || null,
        characters: modules[2]?.default || null,
        troops: modules[3]?.default || null,
        events: modules[4]?.default || null,
      };
    } catch (error) {
      console.error(`Failed to load season ${seasonId} assets:`, error);
      return null;
    }
  }

  /**
   * 获取所有赛季列表
   * @returns {Array} 赛季列表
   */
  getAllSeasons() {
    return Array.from(this.seasons.values()).map(season => ({
      id: season.id,
      name: season.name,
      subtitle: season.subtitle,
      version: season.version,
      startDate: season.timeline.startDate,
      endDate: season.timeline.endDate,
      historicalYear: season.timeline.historicalYear,
      isActive: this.isSeasonActive(season.id),
      timeRemaining: this.getSeasonTimeRemaining(season.id),
    }));
  }

  /**
   * 赛季结算
   * @param {string} seasonId - 赛季ID
   * @param {Object} playerData - 玩家数据
   * @returns {Object} 结算结果
   */
  async seasonEnd(seasonId, playerData) {
    const season = this.seasons.get(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    // 计算赛季奖励
    const rewards = this.calculateSeasonRewards(season, playerData);

    // 确定可继承数据
    const inheritedData = this.calculateInheritedData(season, playerData);

    return {
      seasonId,
      seasonName: season.name,
      seasonRewards: rewards,
      inheritedData,
      timestamp: Date.now(),
    };
  }

  /**
   * 计算赛季奖励
   * @param {Object} season - 赛季配置
   * @param {Object} playerData - 玩家数据
   * @returns {Object} 奖励数据
   */
  calculateSeasonRewards(season, playerData) {
    const rewards = {
      rank: playerData.rank || 9999,
      rankRewards: {},
      objectiveRewards: {},
      exclusiveItems: [],
    };

    // 排名奖励
    if (season.rewards.rankRewards) {
      for (const tier of season.rewards.rankTiers) {
        if (playerData.rank <= tier.rank) {
          rewards.rankRewards = tier.rewards;
          break;
        }
      }
    }

    // 赛季专属物品
    if (season.rewards.exclusiveItems) {
      rewards.exclusiveItems = season.rewards.exclusiveItems;
    }

    // 目标完成奖励
    if (playerData.completedObjectives) {
      rewards.objectiveRewards = playerData.completedObjectives.reduce((acc, objId) => {
        const objective = season.objectives.find(obj => obj.id === objId);
        if (objective) {
          Object.assign(acc, objective.rewards);
        }
        return acc;
      }, {});
    }

    return rewards;
  }

  /**
   * 计算可继承数据
   * @param {Object} season - 赛季配置
   * @param {Object} playerData - 玩家数据
   * @returns {Object} 可继承数据
   */
  calculateInheritedData(season, playerData) {
    const inheritance = season.inheritance;

    return {
      // 账号信息（完全继承）
      account: {
        username: playerData.username,
        userId: playerData.userId,
        totalPlayTime: playerData.totalPlayTime,
        achievements: playerData.achievements,
      },
      
      // 资源（按比例继承）
      resources: {
        gold: Math.floor((playerData.gold || 0) * inheritance.gold),
        gems: Math.floor((playerData.gems || 0) * inheritance.gems),
      },
      
      // 物品（选择性继承）
      items: this.filterInheritableItems(playerData.items, inheritance.items),
      
      // 武将（选择性继承）
      characters: this.filterInheritableCharacters(playerData.characters, inheritance.characters),
      
      // 成就（完全继承）
      achievements: playerData.achievements || [],
      
      // 统计数据
      statistics: {
        totalSeasons: (playerData.statistics?.totalSeasons || 0) + 1,
        totalBattles: playerData.statistics?.totalBattles || 0,
        totalVictories: playerData.statistics?.totalVictories || 0,
      },
    };
  }

  /**
   * 过滤可继承物品
   * @param {Array} items - 物品列表
   * @param {string} inheritanceRule - 继承规则
   * @returns {Array} 可继承物品
   */
  filterInheritableItems(items, inheritanceRule) {
    if (!items) return [];
    
    if (inheritanceRule === 'selective') {
      return items.filter(item => item.transferable === true);
    }
    
    return [];
  }

  /**
   * 过滤可继承武将
   * @param {Array} characters - 武将列表
   * @param {string} inheritanceRule - 继承规则
   * @returns {Array} 可继承武将
   */
  filterInheritableCharacters(characters, inheritanceRule) {
    if (!characters) return [];
    
    if (inheritanceRule === 'gacha_only') {
      return characters.filter(char => char.source === 'gacha');
    }
    
    return [];
  }

  /**
   * 新赛季开始
   * @param {string} newSeasonId - 新赛季ID
   * @param {Object} inheritedData - 继承数据
   * @returns {Object} 新赛季玩家数据
   */
  async seasonStart(newSeasonId, inheritedData) {
    const newSeason = this.seasons.get(newSeasonId);
    if (!newSeason) {
      throw new Error(`Season ${newSeasonId} not found`);
    }

    // 创建新赛季玩家数据
    const newPlayerData = {
      // 继承的数据
      ...inheritedData.account,
      
      // 新赛季基础信息
      seasonId: newSeasonId,
      level: newSeason.tutorial.initialLevel,
      exp: 0,
      location: newSeason.tutorial.startLocation,
      
      // 资源（继承 + 初始）
      gold: inheritedData.resources.gold + newSeason.tutorial.initialGold,
      gems: inheritedData.resources.gems,
      food: newSeason.tutorial.initialFood,
      
      // 继承的物品和武将
      items: inheritedData.items || [],
      characters: inheritedData.characters || [],
      
      // 新赛季初始数据
      troops: [],
      cities: [],
      relationships: {},
      
      // 成就和统计
      achievements: inheritedData.achievements || [],
      statistics: inheritedData.statistics || {},
      
      // 赛季进度
      seasonProgress: {
        objectives: [],
        events: [],
        rank: 0,
      },
      
      // 时间戳
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };

    return newPlayerData;
  }

  /**
   * 获取赛季统计
   * @param {string} seasonId - 赛季ID
   * @returns {Object} 统计信息
   */
  getSeasonStatistics(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) return null;

    return {
      id: season.id,
      name: season.name,
      totalCharacters: season.characters.total,
      totalCities: season.map.cities,
      totalRegions: season.map.regions,
      troopTypes: season.troops.types.length,
      factions: season.factions.length,
      features: Object.keys(season.features).filter(key => season.features[key]),
    };
  }
}

// 导出单例
export const seasonManager = new SeasonManager();

// 导出类（用于测试）
export { SeasonManager };
