/**
 * 日常事件总导出
 * 
 * 汇总所有日常类事件
 */

// 日常事件集合（待添加）
export const dailyEvents = [
  // 未来添加日常事件
];

// 统计信息
export const dailyEventStats = {
  total: dailyEvents.length,
  byCategory: {},
};

// 按ID快速查找
export function getDailyEventById(id) {
  return dailyEvents.find(event => event.id === id);
}
