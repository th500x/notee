/**
 * 事件系统核心
 * 
 * 负责事件的触发、处理和结果计算
 * 设计原则：轻量化、模块化、易扩展
 */

import { calculateFactorSuccess } from '../utils/factorCalculator.js';
import { rollProbability } from '../utils/probabilityEngine.js';
import { getEventsByLocation, getEventsByContext } from '../data/events/index.js';
import { EVENT_CONFIG } from '../data/eventConfig.js';

export class EventSystem {
  constructor() {
    // 事件历史记录（客户端本地存储）
    this.eventHistory = [];
    
    // 事件冷却记录
    this.cooldowns = new Map();
    
    // 当前激活的事件
    this.activeEvent = null;
  }

  /**
   * 检查并触发事件
   * @param {Object} player - 玩家数据
   * @param {string} location - 当前位置
   * @param {string} context - 触发场景
   * @returns {Object|null} 触发的事件或null
   */
  checkEventTrigger(player, location, context) {
    // 获取该位置和场景下的可用事件
    const locationEvents = getEventsByLocation(location);
    const contextEvents = getEventsByContext(context);
    
    // 取交集
    const availableEvents = locationEvents.filter(event => 
      contextEvents.includes(event)
    );

    // 过滤掉冷却中的事件
    const readyEvents = availableEvents.filter(event => 
      !this.isOnCooldown(event.id)
    );

    // 检查每个事件的触发条件
    for (const event of readyEvents) {
      if (this.canTrigger(event, player)) {
        // 概率判定
        if (rollProbability(event.trigger.probability)) {
          this.activeEvent = event;
          this.recordEventTrigger(event.id);
          return event;
        }
      }
    }

    return null;
  }

  /**
   * 检查事件是否可以触发
   * @param {Object} event - 事件数据
   * @param {Object} player - 玩家数据
   * @returns {boolean}
   */
  canTrigger(event, player) {
    const { trigger } = event;

    // 检查等级要求
    if (trigger.minLevel && player.level < trigger.minLevel) {
      return false;
    }

    // 检查因子要求
    if (trigger.requiredFactors) {
      for (const [factor, minValue] of Object.entries(trigger.requiredFactors)) {
        if ((player.factors[factor] || 0) < minValue) {
          return false;
        }
      }
    }

    // 检查物品要求
    if (trigger.requiredItems) {
      for (const item of trigger.requiredItems) {
        if (!player.inventory?.includes(item)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 处理玩家选择
   * @param {Object} event - 事件数据
   * @param {string} optionId - 选项ID
   * @param {Object} player - 玩家数据
   * @returns {Object} 结果数据
   */
  processChoice(event, optionId, player) {
    const option = event.options.find(opt => opt.id === optionId);
    if (!option) {
      throw new Error(`Invalid option ID: ${optionId}`);
    }

    // 处理每个可能的结果
    for (const outcome of option.outcomes) {
      const result = this.evaluateOutcome(outcome, player);
      
      if (result.success) {
        // 应用成功结果
        return this.applyOutcome(outcome.onSuccess, player, event);
      } else if (outcome.onFailure) {
        // 应用失败结果
        return this.applyOutcome(outcome.onFailure, player, event);
      }
    }

    return { success: false, message: '未知错误' };
  }

  /**
   * 评估结果条件
   * @param {Object} outcome - 结果配置
   * @param {Object} player - 玩家数据
   * @returns {Object} {success: boolean, rate: number}
   */
  evaluateOutcome(outcome, player) {
    const { condition } = outcome;

    switch (condition.type) {
      case EVENT_CONFIG.CONDITION_TYPES.ALWAYS:
        return { success: true, rate: 1 };

      case EVENT_CONFIG.CONDITION_TYPES.NEVER:
        return { success: false, rate: 0 };

      case EVENT_CONFIG.CONDITION_TYPES.FACTOR_CHECK:
        const successRate = calculateFactorSuccess(
          player.factors,
          condition.factors
        );
        const roll = Math.random();
        return { 
          success: roll < successRate, 
          rate: successRate,
          roll 
        };

      case EVENT_CONFIG.CONDITION_TYPES.RANDOM:
        const probability = condition.probability || 0.5;
        return { 
          success: rollProbability(probability), 
          rate: probability 
        };

      case EVENT_CONFIG.CONDITION_TYPES.ITEM_CHECK:
        const hasItems = condition.items.every(item => 
          player.inventory?.includes(item)
        );
        return { success: hasItems, rate: hasItems ? 1 : 0 };

      default:
        return { success: false, rate: 0 };
    }
  }

  /**
   * 应用结果
   * @param {Object} outcomeData - 结果数据
   * @param {Object} player - 玩家数据
   * @param {Object} event - 事件数据
   * @returns {Object} 应用结果
   */
  applyOutcome(outcomeData, player, event) {
    const result = {
      type: outcomeData.type,
      text: outcomeData.text,
      rewards: outcomeData.rewards || {},
      nextAction: null,
    };

    // 根据结果类型处理
    switch (outcomeData.type) {
      case EVENT_CONFIG.OUTCOME_TYPES.TEXT:
      case EVENT_CONFIG.OUTCOME_TYPES.TEXT_REWARD:
        // 纯文本或文本+奖励，直接返回
        break;

      case EVENT_CONFIG.OUTCOME_TYPES.BATTLE:
        // 触发战斗
        result.nextAction = {
          type: 'battle',
          config: outcomeData.battleConfig,
          afterBattleText: outcomeData.afterBattleText,
        };
        break;

      case EVENT_CONFIG.OUTCOME_TYPES.CHAIN_EVENT:
        // 触发连锁事件
        result.nextAction = {
          type: 'chain_event',
          eventId: outcomeData.nextEventId,
        };
        break;

      case EVENT_CONFIG.OUTCOME_TYPES.SIEGE:
        // 触发攻城
        result.nextAction = {
          type: 'siege',
          config: outcomeData.siegeConfig,
        };
        break;
    }

    // 记录事件完成
    this.recordEventCompletion(event.id, result);

    // 设置冷却
    this.setCooldown(event.id, event.metadata?.rarity);

    return result;
  }

  /**
   * 检查事件是否在冷却中
   * @param {string} eventId - 事件ID
   * @returns {boolean}
   */
  isOnCooldown(eventId) {
    const cooldownEnd = this.cooldowns.get(eventId);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
      this.cooldowns.delete(eventId);
      return false;
    }
    
    return true;
  }

  /**
   * 设置事件冷却
   * @param {string} eventId - 事件ID
   * @param {string} rarity - 稀有度
   */
  setCooldown(eventId, rarity = 'common') {
    const cooldownDuration = EVENT_CONFIG.COOLDOWN[rarity.toUpperCase()] || EVENT_CONFIG.COOLDOWN.COMMON;
    const cooldownEnd = Date.now() + (cooldownDuration * 1000);
    this.cooldowns.set(eventId, cooldownEnd);
  }

  /**
   * 记录事件触发
   * @param {string} eventId - 事件ID
   */
  recordEventTrigger(eventId) {
    this.eventHistory.push({
      eventId,
      action: 'trigger',
      timestamp: Date.now(),
    });
  }

  /**
   * 记录事件完成
   * @param {string} eventId - 事件ID
   * @param {Object} result - 结果数据
   */
  recordEventCompletion(eventId, result) {
    this.eventHistory.push({
      eventId,
      action: 'complete',
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取事件历史
   * @param {number} limit - 限制数量
   * @returns {Array}
   */
  getEventHistory(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * 清除事件历史
   */
  clearEventHistory() {
    this.eventHistory = [];
  }

  /**
   * 获取冷却信息
   * @param {string} eventId - 事件ID
   * @returns {Object|null}
   */
  getCooldownInfo(eventId) {
    const cooldownEnd = this.cooldowns.get(eventId);
    if (!cooldownEnd) return null;

    const now = Date.now();
    const remaining = Math.max(0, cooldownEnd - now);

    return {
      isOnCooldown: remaining > 0,
      remainingSeconds: Math.ceil(remaining / 1000),
      endTime: cooldownEnd,
    };
  }
}

// 导出单例
export const eventSystem = new EventSystem();
