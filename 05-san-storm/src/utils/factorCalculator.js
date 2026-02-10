/**
 * 因子计算工具
 * 
 * 用于计算角色因子对事件结果的影响
 * 属性范围：0.0-10.0（显示小数点后一位）
 */

import { EVENT_CONFIG } from '../data/eventConfig.js';

/**
 * 计算因子成功率
 * @param {Object} playerFactors - 玩家因子数据（0.0-10.0范围）
 * @param {Object} requiredFactors - 需求因子配置
 * @returns {number} 成功率 (0-1)
 */
export function calculateFactorSuccess(playerFactors, requiredFactors) {
  if (!requiredFactors || Object.keys(requiredFactors).length === 0) {
    return EVENT_CONFIG.PROBABILITY.BASE_SUCCESS_RATE;
  }

  let totalWeight = 0;
  let weightedScore = 0;

  // 遍历所有需求因子
  for (const [factorName, config] of Object.entries(requiredFactors)) {
    const playerValue = playerFactors[factorName] || 0;
    const minValue = config.min || 0;
    const weight = config.weight || 1;

    totalWeight += weight;

    // 计算该因子的得分
    if (playerValue >= minValue) {
      // 超过最低要求，计算超出部分的加成
      const excess = playerValue - minValue;
      const bonus = Math.min(excess / 10, 0.5); // 最多+50%（10.0满值时）
      weightedScore += (1 + bonus) * weight;
    } else {
      // 未达到最低要求，按比例扣分
      const ratio = playerValue / minValue;
      weightedScore += ratio * weight;
    }
  }

  // 计算最终成功率
  const successRate = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  
  // 限制在 0-1 范围内
  return Math.max(0, Math.min(1, successRate));
}

/**
 * 计算单个因子的影响
 * @param {number} playerValue - 玩家因子值（0.0-10.0）
 * @param {number} requiredValue - 需求因子值（0.0-10.0）
 * @returns {number} 影响系数 (0-2)
 */
export function calculateSingleFactorImpact(playerValue, requiredValue) {
  if (requiredValue === 0) return 1;
  
  const ratio = playerValue / requiredValue;
  
  // 使用S曲线平滑过渡
  return 1 / (1 + Math.exp(-5 * (ratio - 1)));
}

/**
 * 检查因子是否满足条件
 * @param {Object} playerFactors - 玩家因子（0.0-10.0范围）
 * @param {Object} requirements - 需求配置
 * @returns {boolean} 是否满足
 */
export function checkFactorRequirements(playerFactors, requirements) {
  if (!requirements) return true;

  for (const [factorName, minValue] of Object.entries(requirements)) {
    const playerValue = playerFactors[factorName] || 0;
    if (playerValue < minValue) {
      return false;
    }
  }

  return true;
}

/**
 * 计算大成功/大失败
 * @param {number} baseSuccessRate - 基础成功率
 * @param {number} roll - 随机数 (0-1)
 * @returns {string} 'critical_success' | 'success' | 'failure' | 'critical_failure'
 */
export function calculateOutcomeLevel(baseSuccessRate, roll) {
  const criticalSuccessThreshold = baseSuccessRate * EVENT_CONFIG.PROBABILITY.CRITICAL_SUCCESS_RATE;
  const criticalFailureThreshold = (1 - baseSuccessRate) * EVENT_CONFIG.PROBABILITY.CRITICAL_FAILURE_RATE;

  if (roll <= criticalSuccessThreshold) {
    return 'critical_success';
  } else if (roll <= baseSuccessRate) {
    return 'success';
  } else if (roll >= (1 - criticalFailureThreshold)) {
    return 'critical_failure';
  } else {
    return 'failure';
  }
}

/**
 * 获取因子描述文本
 * @param {string} factorName - 因子名称
 * @returns {string} 描述文本
 */
export function getFactorDescription(factorName) {
  const descriptions = {
    // 特殊属性
    luck: '运气',
    courage: '勇气',
    
    // 核心五维
    command: '统率',
    combat: '武力',
    intelligence: '智力',
    politics: '政治',
    charisma: '魅力',
    
    // 其他（兼容旧代码）
    loyalty: '忠诚',
    strategy: '谋略',
    diplomacy: '外交',
  };

  return descriptions[factorName] || factorName;
}

/**
 * 计算因子成长
 * @param {number} currentValue - 当前值（0.0-10.0）
 * @param {number} growth - 成长值
 * @param {number} maxValue - 最大值（默认10.0）
 * @returns {number} 新值（保留一位小数）
 */
export function calculateFactorGrowth(currentValue, growth, maxValue = 10.0) {
  const newValue = currentValue + growth;
  const clampedValue = Math.max(0, Math.min(maxValue, newValue));
  // 保留一位小数
  return Math.round(clampedValue * 10) / 10;
}
