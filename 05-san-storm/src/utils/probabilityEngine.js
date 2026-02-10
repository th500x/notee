/**
 * 概率引擎
 * 
 * 处理游戏中的所有随机和概率相关逻辑
 */

/**
 * 投掷概率
 * @param {number} probability - 概率值 (0-1)
 * @returns {boolean} 是否成功
 */
export function rollProbability(probability) {
  return Math.random() < probability;
}

/**
 * 生成随机数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 随机数
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机浮点数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 随机浮点数
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 从数组中随机选择一个元素
 * @param {Array} array - 数组
 * @returns {*} 随机元素
 */
export function randomChoice(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 根据权重随机选择
 * @param {Array} items - 项目数组
 * @param {Array} weights - 权重数组
 * @returns {*} 选中的项目
 */
export function weightedRandomChoice(items, weights) {
  if (!items || items.length === 0) return null;
  if (!weights || weights.length !== items.length) {
    return randomChoice(items);
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * 洗牌算法（Fisher-Yates）
 * @param {Array} array - 要洗牌的数组
 * @returns {Array} 洗牌后的新数组
 */
export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 生成正态分布随机数
 * @param {number} mean - 均值
 * @param {number} stdDev - 标准差
 * @returns {number} 正态分布随机数
 */
export function normalRandom(mean = 0, stdDev = 1) {
  // Box-Muller变换
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * 计算概率范围
 * @param {number} baseRate - 基础概率
 * @param {number} variance - 方差
 * @returns {Object} {min, max, actual}
 */
export function calculateProbabilityRange(baseRate, variance = 0.1) {
  const min = Math.max(0, baseRate - variance);
  const max = Math.min(1, baseRate + variance);
  const actual = randomFloat(min, max);
  
  return { min, max, actual };
}

/**
 * 连续成功概率计算
 * @param {number} singleProbability - 单次成功概率
 * @param {number} times - 次数
 * @returns {number} 连续成功的概率
 */
export function consecutiveSuccessProbability(singleProbability, times) {
  return Math.pow(singleProbability, times);
}

/**
 * 至少一次成功概率
 * @param {number} singleProbability - 单次成功概率
 * @param {number} times - 尝试次数
 * @returns {number} 至少一次成功的概率
 */
export function atLeastOnceSuccessProbability(singleProbability, times) {
  return 1 - Math.pow(1 - singleProbability, times);
}

/**
 * 模拟多次投掷
 * @param {number} probability - 概率
 * @param {number} times - 次数
 * @returns {number} 成功次数
 */
export function simulateRolls(probability, times) {
  let successes = 0;
  for (let i = 0; i < times; i++) {
    if (rollProbability(probability)) {
      successes++;
    }
  }
  return successes;
}

/**
 * 保底机制
 * @param {number} attempts - 已尝试次数
 * @param {number} guaranteedAt - 保底次数
 * @param {number} baseProbability - 基础概率
 * @returns {number} 当前概率
 */
export function pitySystemProbability(attempts, guaranteedAt, baseProbability) {
  if (attempts >= guaranteedAt) {
    return 1; // 保底必中
  }
  
  // 接近保底时提升概率
  const pityBonus = (attempts / guaranteedAt) * 0.5;
  return Math.min(1, baseProbability + pityBonus);
}
