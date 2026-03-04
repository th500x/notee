/**
 * 统一的 JSON 解析工具
 * 处理 MySQL2 可能返回字符串或已解析对象的情况
 * 并确保数据类型与期望一致
 */

/**
 * 解析 JSON 字段
 * @param {*} value - 要解析的值
 * @param {*} defaultValue - 默认值（用于推断期望的数据类型）
 * @returns {*} 解析后的值或默认值
 */
function parseJSON(value, defaultValue) {
  // 如果值为空，返回默认值
  if (!value) return defaultValue;
  
  // 如果是字符串，尝试解析
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      
      // 类型检查：如果期望数组但得到对象，返回默认值
      if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
        console.warn('[JSON Parse Warning] Expected array but got object, using default value');
        return defaultValue;
      }
      
      return parsed;
    } catch (e) {
      console.error('[JSON Parse Error]', e);
      return defaultValue;
    }
  }
  
  // 如果已经是对象，进行类型检查
  // 类型检查：如果期望数组但得到对象，返回默认值
  if (Array.isArray(defaultValue) && !Array.isArray(value)) {
    console.warn('[JSON Parse Warning] Expected array but got object, using default value');
    return defaultValue;
  }
  
  return value;
}

module.exports = { parseJSON };
