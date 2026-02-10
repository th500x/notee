/**
 * 历史事件总导出
 * 
 * 汇总所有历史类事件
 */

import { threeKingdomsEvents, threeKingdomsEventCount } from './three-kingdoms.js';

// 汇总所有历史事件
export const historicalEvents = [
  ...threeKingdomsEvents,
  // 未来可以添加更多历史事件集合
  // ...hanDynastyEvents,
  // ...warringStatesEvents,
];

// 统计信息
export const historicalEventStats = {
  total: historicalEvents.length,
  byCategory: {
    three_kingdoms: threeKingdomsEventCount,
  },
};

// 按ID快速查找
export function getHistoricalEventById(id) {
  return historicalEvents.find(event => event.id === id);
}

// 按分类获取事件
export function getHistoricalEventsByCategory(category) {
  return historicalEvents.filter(event => event.category === category);
}

// 按标签获取事件
export function getHistoricalEventsByTag(tag) {
  return historicalEvents.filter(event => 
    event.metadata?.tags?.includes(tag)
  );
}
