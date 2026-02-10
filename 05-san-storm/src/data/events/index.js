/**
 * 事件数据总导出
 * 
 * 统一管理所有类型的事件
 */

import { historicalEvents, historicalEventStats } from './historical/index.js';
import { fictionalEvents, fictionalEventStats } from './fictional/index.js';
import { dailyEvents, dailyEventStats } from './daily/index.js';

// 汇总所有事件
export const allEvents = [
  ...historicalEvents,
  ...fictionalEvents,
  ...dailyEvents,
];

// 统计信息
export const eventStats = {
  total: allEvents.length,
  historical: historicalEventStats.total,
  fictional: fictionalEventStats.total,
  daily: dailyEventStats.total,
};

/**
 * 按ID获取事件
 */
export function getEventById(id) {
  return allEvents.find(event => event.id === id);
}

/**
 * 按类型获取事件
 */
export function getEventsByType(type) {
  return allEvents.filter(event => event.type === type);
}

/**
 * 按分类获取事件
 */
export function getEventsByCategory(category) {
  return allEvents.filter(event => event.category === category);
}

/**
 * 按地点获取可触发事件
 */
export function getEventsByLocation(location) {
  return allEvents.filter(event => 
    event.trigger?.locations?.includes(location)
  );
}

/**
 * 按触发场景获取事件
 */
export function getEventsByContext(context) {
  return allEvents.filter(event => 
    event.trigger?.context?.includes(context)
  );
}

/**
 * 获取事件统计信息
 */
export function getEventStatistics() {
  return {
    ...eventStats,
    byDifficulty: {
      easy: allEvents.filter(e => e.metadata?.difficulty === 'easy').length,
      normal: allEvents.filter(e => e.metadata?.difficulty === 'normal').length,
      hard: allEvents.filter(e => e.metadata?.difficulty === 'hard').length,
      extreme: allEvents.filter(e => e.metadata?.difficulty === 'extreme').length,
    },
    byRarity: {
      common: allEvents.filter(e => e.metadata?.rarity === 'common').length,
      rare: allEvents.filter(e => e.metadata?.rarity === 'rare').length,
      epic: allEvents.filter(e => e.metadata?.rarity === 'epic').length,
      legendary: allEvents.filter(e => e.metadata?.rarity === 'legendary').length,
    },
  };
}

// 导出子模块
export { historicalEvents, fictionalEvents, dailyEvents };
