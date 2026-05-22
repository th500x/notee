/**
 * 房源状态管理工具
 *
 * 功能：
 * - 获取房源状态
 * - 获取状态的显示文本和样式
 */

const VALID_STATUSES = new Set(['vacant', 'rented', 'new-contract'])

function normalizeRecordStatus(status) {
  if (!status || typeof status !== 'string') return null
  return VALID_STATUSES.has(status) ? status : null
}

/**
 * 获取房源在指定月份的状态
 *
 * 规则摘要：
 * 1) 若该月有多条收支记录，从该月最后一条往前找，采用第一条带合法 status 的记录。
 * 2) 若该月无任何带 status 的记录，则继承「严格早于该月」的最后一个有记录月份中、同规则取到的状态
 *    （解决：仅在某一月把状态改为「出租中」后，后续未建记录的月份不再错误落回 property.status 的「新合同」）。
 * 3) 仍无时回退到房源对象上的 property.status，再默认 vacant。
 *
 * @param {Object} property - 房源对象
 * @param {string} targetMonth - 目标月份 (格式: YYYY-MM)
 * @returns {string} 状态: 'vacant' | 'new-contract' | 'rented'
 */
export function getPropertyStatus(property, targetMonth) {
  if (!property) return 'vacant'

  const records = property.records
  if (records && records.length > 0) {
    const sameMonth = records.filter((r) => r.date === targetMonth)
    for (let i = sameMonth.length - 1; i >= 0; i--) {
      const st = normalizeRecordStatus(sameMonth[i]?.status)
      if (st) return st
    }

    const monthsBefore = [...new Set(records.map((r) => r.date))]
      .filter((d) => d < targetMonth)
      .sort()
    if (monthsBefore.length > 0) {
      const prevKey = monthsBefore[monthsBefore.length - 1]
      const prevMonthRecords = records.filter((r) => r.date === prevKey)
      for (let i = prevMonthRecords.length - 1; i >= 0; i--) {
        const st = normalizeRecordStatus(prevMonthRecords[i]?.status)
        if (st) return st
      }
    }
  }

  return normalizeRecordStatus(property.status) || 'vacant'
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
    return 'bg-blue-100 hover:bg-blue-200'
  }

  if (status === 'vacant') {
    return 'bg-gray-200 hover:bg-gray-300'
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
    vacant: '空置中',
    'new-contract': '新合同',
    rented: '出租中'
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
    vacant: 'bg-gray-300 text-gray-800',
    'new-contract': 'bg-blue-200 text-blue-800',
    rented: 'bg-green-100 text-green-700'
  }
  return classMap[status] || 'bg-gray-100 text-gray-700'
}
