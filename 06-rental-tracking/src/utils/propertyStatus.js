/**
 * 房源状态管理工具
 * 
 * 功能：
 * - 根据租客信息和日期自动推断房源状态
 * - 支持手动覆盖状态
 */

/**
 * 获取房源在指定月份的状态
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {string} 状态: 'vacant' | 'new-contract' | 'rented'
 */
export function getPropertyStatus(property, targetMonth) {
  // 1. 检查该月份的记录是否有手动设置的状态
  const record = property.records?.find(r => r.date === targetMonth)
  if (record && record.status) {
    return record.status // 优先使用手动设置的状态
  }

  // 2. 根据租客信息自动推断状态
  if (!property.tenant || !property.tenant.startDate) {
    return 'vacant' // 无租客 = 空置
  }

  const startDate = new Date(property.tenant.startDate + '-01') // 添加日期部分
  const targetDate = new Date(targetMonth + '-01')
  
  // 比较年月
  const startYearMonth = startDate.getFullYear() * 12 + startDate.getMonth()
  const targetYearMonth = targetDate.getFullYear() * 12 + targetDate.getMonth()
  
  if (targetYearMonth < startYearMonth) {
    return 'vacant' // 起租前 = 空置
  } else if (targetYearMonth === startYearMonth) {
    return 'new-contract' // 起租月 = 新合同
  } else {
    // 检查是否已到期
    if (property.tenant.endDate) {
      const endDate = new Date(property.tenant.endDate + '-01')
      const endYearMonth = endDate.getFullYear() * 12 + endDate.getMonth()
      
      if (targetYearMonth > endYearMonth) {
        return 'vacant' // 已到期 = 空置
      }
    }
    return 'rented' // 起租后且未到期 = 出租中
  }
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
  return getPropertyStatus(property, currentMonth)
}

/**
 * 设置房源在指定月份的状态（手动覆盖）
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @param {string} status - 状态: 'vacant' | 'new-contract' | 'rented'
 * @returns {Object} 更新后的房源对象
 */
export function setPropertyStatus(property, targetMonth, status) {
  const records = property.records || []
  const recordIndex = records.findIndex(r => r.date === targetMonth)
  
  if (recordIndex >= 0) {
    // 更新现有记录的状态
    records[recordIndex] = {
      ...records[recordIndex],
      status
    }
  } else {
    // 创建新记录
    records.push({
      date: targetMonth,
      status,
      income: 0,
      expenses: 0,
      note: ''
    })
  }
  
  return {
    ...property,
    records: records.sort((a, b) => a.date.localeCompare(b.date))
  }
}

/**
 * 检查房源在指定月份是否已缴租
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {boolean} 是否已缴租
 */
export function hasPropertyPaid(property, targetMonth) {
  const record = property.records?.find(r => r.date === targetMonth)
  return record && (record.income || 0) > 0
}

/**
 * 获取房源在指定月份的背景色类名
 * 优先级：未缴租（红色）> 新合同（蓝色）> 空置中（灰色）> 出租中（白色）
 * 
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {string} Tailwind CSS 类名
 */
export function getPropertyBackgroundColor(property, targetMonth) {
  const status = getPropertyStatus(property, targetMonth)
  const hasPaid = hasPropertyPaid(property, targetMonth)
  
  // 优先级1：如果是出租中或新合同，但未缴租 → 淡红色
  if ((status === 'rented' || status === 'new-contract') && !hasPaid) {
    return 'bg-red-50 hover:bg-red-100'
  }
  
  // 优先级2：新合同 → 淡蓝色
  if (status === 'new-contract') {
    return 'bg-blue-50 hover:bg-blue-100'
  }
  
  // 优先级3：空置中 → 淡灰色
  if (status === 'vacant') {
    return 'bg-gray-50 hover:bg-gray-100'
  }
  
  // 默认：出租中且已缴租 → 白色
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
