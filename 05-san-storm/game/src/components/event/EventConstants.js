/**
 * 事件系统常量
 * 
 * @description 从 ExploreDemo 提取的核心常量，供事件系统各组件/hook 共享
 */

// 运势等级
export const FORTUNE_LEVELS = [
  { name: '鸿运', emoji: '⭐⭐⭐', color: 'text-yellow-600', multiplier: 1.5, min: 120 },
  { name: '大吉', emoji: '⭐⭐',  color: 'text-green-600',  multiplier: 1.2, min: 100 },
  { name: '吉',   emoji: '⭐',    color: 'text-blue-600',   multiplier: 1.0, min: 80 },
  { name: '凶',   emoji: '💀',    color: 'text-orange-600', multiplier: 0.8, min: 60 },
  { name: '大凶', emoji: '💀💀',  color: 'text-red-600',    multiplier: 0.5, min: 0 },
];

// 骰子倍率表
export const DICE_TABLE = [
  { dice: 6, multiplier: 1.2, label: '大幸运' },
  { dice: 5, multiplier: 1.1, label: '小幸运' },
  { dice: 4, multiplier: 1.0, label: '正常' },
  { dice: 3, multiplier: 0.9, label: '小不幸' },
  { dice: 2, multiplier: 0.8, label: '较不幸' },
  { dice: 1, multiplier: 0.7, label: '大不幸' },
];

// 阶段枚举
export const PHASE = {
  IDLE: 'idle',
  EVENT: 'event',         // 显示事件描述+选项
  ROLLING: 'rolling',     // 骰子动画
  RESULT: 'result',       // 判定结果
  BATTLE: 'battle',       // 惩罚战斗（凶/大凶）
  REWARD: 'reward',       // 显示奖励
  RETURNING: 'returning', // 探索返回中（5秒）
  MINIGAME: 'minigame',   // 跳转迷你游戏前确认
};

// 中文映射
export const FACTOR_CN = {
  luck: '运气', military: '武略', strategist: '谋略', balanced: '综合',
  courage: '勇气', command: '统帅', combat: '武力',
  intelligence: '智力', politics: '政治', charm: '魅力',
};

export const RARITY_CN = {
  common: '普通', rare: '精良', epic: '史诗', legendary: '传说', core: '核心',
};

export const RESOURCE_CN = {
  silver: '银两', food: '粮草', reputation: '声望', morale: '士气',
};
