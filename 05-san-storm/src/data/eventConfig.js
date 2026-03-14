/**
 * 事件系统全局配置
 * 
 * 用于配置事件系统的全局参数和常量
 */

export const EVENT_CONFIG = {
  // 事件类型定义
  EVENT_TYPES: {
    HISTORICAL: 'historical',    // 历史真实类
    FICTIONAL: 'fictional',      // 虚构类
    DAILY: 'daily',             // 日常类
  },

  // 结果类型定义
  OUTCOME_TYPES: {
    TEXT: 'text',                    // 纯文本结果
    TEXT_REWARD: 'text_reward',      // 文本+奖励
    BATTLE: 'battle',                // 触发战斗
    CHAIN_EVENT: 'chain_event',      // 触发连锁事件
    SIEGE: 'siege',                  // 触发攻城
  },

  // 条件判定类型
  CONDITION_TYPES: {
    ALWAYS: 'always',                // 总是成功
    NEVER: 'never',                  // 总是失败
    FACTOR_CHECK: 'factor_check',    // 因子检查
    RANDOM: 'random',                // 纯随机
    ITEM_CHECK: 'item_check',        // 物品检查
    RELATIONSHIP: 'relationship',    // 关系检查
  },

  // 触发场景
  TRIGGER_CONTEXTS: {
    MOVE: 'move',                    // 移动时
    SOCIAL: 'social',                // 社交时
    GACHA: 'gacha',                  // 抽卡时
    BATTLE_END: 'battle_end',        // 战斗结束
    CITY_ENTER: 'city_enter',        // 进入城市
    IDLE: 'idle',                    // 闲置时
  },

  // 难度等级
  DIFFICULTY: {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    EXTREME: 'extreme',
  },

  // 事件冷却时间（秒）
  COOLDOWN: {
    COMMON: 3600,        // 普通事件：1小时
    RARE: 7200,          // 稀有事件：2小时
    EPIC: 14400,         // 史诗事件：4小时
    LEGENDARY: 86400,    // 传说事件：24小时
  },

  // 概率权重配置
  PROBABILITY: {
    BASE_SUCCESS_RATE: 0.5,          // 基础成功率
    FACTOR_WEIGHT_MAX: 1.0,          // 因子权重上限
    CRITICAL_SUCCESS_RATE: 0.1,      // 大成功概率
    CRITICAL_FAILURE_RATE: 0.05,     // 大失败概率
  },

  // 奖励类型
  REWARD_TYPES: {
    EXP: 'exp',                      // 经验值
    GOLD: 'gold',                    // 金币
    ITEMS: 'items',                  // 物品
    ATTRIBUTES: 'attributes',        // 属性
    RELATIONSHIP: 'relationship',    // 关系值
    TITLE: 'title',                  // 称号
    TROOPS: 'troops',                // 兵力
  },

  // 因子类型定义
  FACTOR_TYPES: {
    // 基础属性
    COMBAT: 'combat',                // 武力
    INTELLIGENCE: 'intelligence',    // 智力
    CHARISMA: 'charisma',           // 魅力
    POLITICS: 'politics',           // 政治
    COURAGE: 'courage',             // 勇气
    LOYALTY: 'loyalty',             // 忠诚
    
    // 技能相关
    STRATEGY: 'strategy',           // 谋略
    COMMAND: 'command',             // 统帅
    DIPLOMACY: 'diplomacy',         // 外交
  },
};

/**
 * 事件元数据配置
 */
export const EVENT_METADATA = {
  // 版本控制
  VERSION: '0.1.0',
  
  // 事件数量统计（自动更新）
  TOTAL_EVENTS: 0,
  
  // 最后更新时间
  LAST_UPDATE: '2026-02-05',
};

/**
 * 获取事件配置
 */
export function getEventConfig(key) {
  return EVENT_CONFIG[key];
}

/**
 * 获取事件类型列表
 */
export function getEventTypes() {
  return Object.values(EVENT_CONFIG.EVENT_TYPES);
}

/**
 * 验证事件数据结构
 */
export function validateEventData(event) {
  const required = ['id', 'type', 'title', 'description', 'options'];
  
  for (const field of required) {
    if (!event[field]) {
      throw new Error(`Event missing required field: ${field}`);
    }
  }
  
  // 验证选项
  if (!Array.isArray(event.options) || event.options.length === 0) {
    throw new Error('Event must have at least one option');
  }
  
  // 验证每个选项
  event.options.forEach((option, index) => {
    if (!option.id || !option.text || !option.outcomes) {
      throw new Error(`Option ${index} missing required fields`);
    }
  });
  
  return true;
}
