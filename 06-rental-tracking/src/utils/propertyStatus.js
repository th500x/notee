/**
 * 房源状态管理工具
 * 
 * 功能：
 * - 获取房源状态
 * - 获取状态的显示文本和样式
 */

/**
 * 获取房源在指定月份的状态
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {string} 状态: 'vacant' | 'new-contract' | 'rented'
 */
export function getPropertyStatus(property, targetMonth) {
  // 优先从该月份的记录中获取状态
  if (property.records && property.records.length > 0) {
    // 🔧 修复：如果同一个月有多条记录，取最后一条记录的状态
    const records = property.records.filter(r => r.date === targetMonth)
    const record = records.length > 0 ? records[records.length - 1] : null
    
    if (record && record.status) {
      return record.status
    }
  }
  
  // 如果该月份没有记录或记录中没有状态，返回房源的默认状态
  return property.status || 'vacant'
}

/**
 * 获取房源的当前状态（当前月份）
 * 
 * @param {Object} property - 房源对象
 * @returns {string} 状态: 'vacant' | 'new-contract' | 'rented'
 */
export function getCurrentPropertyStatus(property) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  
  // 使用 getPropertyStatus 获取当前月份的状态
  return getPropertyStatus(property, currentMonth)
}

/**
 * 获取房源在指定月份的背景色类名
 * 优先级：新合同（蓝色）> 空置中（灰色）> 出租中（白色）
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {string} Tailwind CSS 类名
 */
export function getPropertyBackgroundColor(property, targetMonth) {
  const status = getPropertyStatus(property, targetMonth)
  
  if (status === 'new-contract') {
    return 'bg-blue-50 hover:bg-blue-100'
  }
  
  if (status === 'vacant') {
    return 'bg-gray-50 hover:bg-gray-100'
  }
  
  return 'bg-white hover:bg-gray-50'
}

/**
 * 获取房源当前月份的背景色类名
 * 
 * @param {Object} property - 房源对象
 * @returns {string} Tailwind CSS 类名
 */
export function getCurrentPropertyBackgroundColor(property) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return getPropertyBackgroundColor(property, currentMonth)
}

/**
 * 获取状态的显示文本
 * 
 * @param {string} status - 状态
 * @returns {string} 显示文本
 */
export function getStatusText(status) {
  const statusMap = {
    'vacant': '空置中',
    'new-contract': '新合同',
    'rented': '出租中'
  }
  return statusMap[status] || '未知'
}

/**
 * 获取状态的样式类名
 * 
 * @param {string} status - 状态
 * @returns {string} Tailwind CSS 类名
 */
export function getStatusClassName(status) {
  const classMap = {
    'vacant': 'bg-gray-100 text-gray-700',
    'new-contract': 'bg-blue-100 text-blue-700',
    'rented': 'bg-green-100 text-green-700'
  }
  return classMap[status] || 'bg-gray-100 text-gray-700'
}
