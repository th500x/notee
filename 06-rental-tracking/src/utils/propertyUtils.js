/**
 * 房源工具函数
 * 
 * 提供房源相关的通用工具函数
 */

/**
 * 获取项目的所有房源（包括默认分组和自定义分组）
 * 
 * @param {Object} project - 项目对象
 * @returns {Array} 所有房源列表
 */
export function getAllProperties(project) {
  const allProperties = [...(project.properties || [])]
  
  if (project.propertyGroups && project.propertyGroups.length > 0) {
    project.propertyGroups.forEach(group => {
      if (group.properties && group.properties.length > 0) {
        allProperties.push(...group.properties)
      }
    })
  }
  
  return allProperties
}

/** 房源列表支出提示：当月支出合计达到该金额（泰铢）才显示 */
export const MONTHLY_EXPENSE_TIP_THRESHOLD = 2000

/**
 * 月视图里，房源编号下方的红色提示。
 * 当月支出合计不足 2000：不显示。
 * 达到 2000 且备注含「佣金」：显示「佣金支出」（半佣不含「佣金」，不标）。
 * 达到 2000 且扣掉佣金后仍有费用：统一显示「其他支出」。
 * 两行可以同时出现。不再单独标大额或物业。
 *
 * @param {Object} property
 * @param {string} monthKey - YYYY-MM
 * @returns {string[]}
 */
export function getMonthlyExpenseTipLabels(property, monthKey) {
  if (!property || !monthKey) return []
  const records = (property.records || []).filter((r) => r.date === monthKey)
  if (records.length === 0) return []

  const totalExpenses = records.reduce((sum, r) => sum + (Number(r.expenses) || 0), 0)
  if (totalExpenses < MONTHLY_EXPENSE_TIP_THRESHOLD) return []

  const labels = []
  const notesJoined = records.map((r) => String(r.note || '')).join('\n')
  if (notesJoined.includes('佣金')) labels.push('佣金支出')

  let otherExpenses = 0
  for (const record of records) {
    const expense = Number(record.expenses) || 0
    if (expense <= 0) continue
    const commission = parseCommissionAmountFromNote(record.note, property.monthlyRent)
    if (commission == null) {
      otherExpenses += expense
    } else {
      otherExpenses += Math.max(0, expense - commission)
    }
  }
  if (otherExpenses > 0) labels.push('其他支出')
  return labels
}

/**
 * 收支记录日期（YYYY-MM）是否落在当前统计视图内。
 *
 * @param {string} dateStr
 * @param {number} selectedYear
 * @param {number} selectedMonth
 * @param {'month'|'year'} viewMode
 */
export function isYearMonthInView(dateStr, selectedYear, selectedMonth, viewMode) {
  if (!dateStr) return false
  const parts = String(dateStr).split('-')
  const recordYear = parseInt(parts[0], 10)
  const recordMonth = parseInt(parts[1], 10)
  if (!Number.isFinite(recordYear) || !Number.isFinite(recordMonth)) return false
  if (viewMode === 'month') {
    return recordYear === selectedYear && recordMonth === selectedMonth
  }
  return recordYear === selectedYear
}

const COMMISSION_KEYWORD_RE = /佣金/
const COMMISSION_NUMBER_AFTER_RE = /^[\s:：=￥¥$฿]*([\d,]+(?:\.\d+)?)/

/**
 * 从房源收支备注解析佣金金额。
 * - 不含「佣金」→ null（不计入）
 * - 「佣金」后紧跟数字 → 该数字
 * - 「佣金」后无数字 → 该房源月租金
 *
 * @param {string} note
 * @param {number} monthlyRent
 * @returns {number|null}
 */
export function parseCommissionAmountFromNote(note, monthlyRent) {
  const text = String(note || '')
  const keywordMatch = text.match(COMMISSION_KEYWORD_RE)
  if (!keywordMatch) return null

  const rest = text.slice(keywordMatch.index + keywordMatch[0].length)
  const numberMatch = rest.match(COMMISSION_NUMBER_AFTER_RE)
  if (numberMatch) {
    const parsed = Number(String(numberMatch[1]).replace(/,/g, ''))
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }

  const rent = Number(monthlyRent)
  return Number.isFinite(rent) && rent > 0 ? rent : 0
}

/**
 * 当期房源列表备注中的佣金合计（不含项目开支）。
 *
 * @param {Array} projects
 * @param {number} selectedYear
 * @param {number} selectedMonth
 * @param {'month'|'year'} viewMode
 * @returns {number}
 */
export function sumCommissionFromProjects(projects, selectedYear, selectedMonth, viewMode) {
  let total = 0
  for (const project of projects || []) {
    for (const property of getAllProperties(project)) {
      for (const record of property.records || []) {
        if (!isYearMonthInView(record.date, selectedYear, selectedMonth, viewMode)) continue
        const amount = parseCommissionAmountFromNote(record.note, property.monthlyRent)
        if (amount != null) total += amount
      }
    }
  }
  return total
}
