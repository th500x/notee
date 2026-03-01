/**
 * 验证日期对象是否有效
 * @param {Date} date - 要验证的日期对象
 * @returns {boolean} 是否为有效日期
 */
function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * 格式化日期为中文显示格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 * @throws {TypeError} 如果日期无效
 */
export function formatDate(date) {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date parameter: expected a valid Date object')
  }
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

/**
 * 格式化日期为YYYY-MM-DD格式
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD格式的日期字符串
 * @throws {TypeError} 如果日期无效
 */
export function formatDateKey(date) {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date parameter: expected a valid Date object')
  }
  
  // 使用本地时间避免时区偏移问题
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 比较两个日期是否为同一天
 * @param {Date} date1 - 第一个日期
 * @param {Date} date2 - 第二个日期
 * @returns {boolean} 是否为同一天
 * @throws {TypeError} 如果任一日期无效
 */
export function isSameDate(date1, date2) {
  if (!isValidDate(date1) || !isValidDate(date2)) {
    throw new TypeError('Invalid date parameter: expected valid Date objects')
  }
  
  return formatDateKey(date1) === formatDateKey(date2)
}

/**
 * 检查日期是否在指定范围内
 * @param {Date} date - 要检查的日期
 * @param {Date} minDate - 最小日期
 * @param {Date} maxDate - 最大日期
 * @returns {boolean} 是否在范围内
 */
export function isDateInRange(date, minDate, maxDate) {
  if (!isValidDate(date) || !isValidDate(minDate) || !isValidDate(maxDate)) {
    return false
  }
  
  return date >= minDate && date <= maxDate
}