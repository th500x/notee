/**
 * 虚构事件总导出
 * 
 * 汇总所有虚构类事件
 */

// 虚构事件集合（待添加）
export const fictionalEvents = [
  // 未来添加虚构事件
];

// 统计信息
export const fictionalEventStats = {
  total: fictionalEvents.length,
  byCategory: {},
};

// 按ID快速查找
export function getFictionalEventById(id) {
  return fictionalEvents.find(event => event.id === id);
}
