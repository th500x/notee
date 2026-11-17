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

/** 没有佣金时，「其他支出」要达到的金额（泰铢） */
export const OTHER_EXPENSE_TIP_THRESHOLD = 500

/** 已经标了佣金支出时，「其他支出」要达到的金额（泰铢） */
export const COMMISSION_OTHER_EXPENSE_TIP_THRESHOLD = 3000

/**
 * 月视图里，房源编号下方的红色提示。
 * 备注含「佣金」：显示「佣金支出」，不看金额（半佣不含「佣金」，不标）。
 * 没有佣金时，费用 ≥ 500 显示「其他支出」。
 * 已有佣金支出时，其他支出要 ≥ 3000 才显示。先用总支出减去备注里佣金后的数字；没有这个数字，再减去房源租金。
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

  const labels = []
  const hasCommission = records.some((r) => String(r.note || '').includes('佣金'))
  if (hasCommission) labels.push('佣金支出')

  const otherExpenses = hasCommission
    ? otherExpensesBesideCommission(records, property.monthlyRent)
    : sumPositiveExpenses(records)
  const floor = hasCommission ? COMMISSION_OTHER_EXPENSE_TIP_THRESHOLD : OTHER_EXPENSE_TIP_THRESHOLD
  if (otherExpenses >= floor) labels.push('其他支出')
  return labels
}

function sumPositiveExpenses(records) {
  return records.reduce((sum, record) => {
    const expense = Number(record.expenses) || 0
    return expense > 0 ? sum + expense : sum
  }, 0)
}

/**
 * 已有佣金时，总支出扣掉佣金后的余额。
 * A：备注「佣金」后面的数字，多条相加，优先使用。
 * B：没有任何这种数字时，改扣房源月租金。
 */
function otherExpensesBesideCommission(records, monthlyRent) {
  let numberSum = 0
  let hasNumber = false
  for (const record of records) {
    const text = String(record.note || '')
    const keywordMatch = text.match(COMMISSION_KEYWORD_RE)
    if (!keywordMatch) continue
    const rest = text.slice(keywordMatch.index + keywordMatch[0].length)
    const numberMatch = rest.match(COMMISSION_NUMBER_AFTER_RE)
    if (!numberMatch) continue
    const parsed = Number(String(numberMatch[1]).replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) continue
    hasNumber = true
    numberSum += parsed
  }

  const total = sumPositiveExpenses(records)
  if (hasNumber) return total - numberSum
  const rent = Number(monthlyRent)
  const deduction = Number.isFinite(rent) && rent > 0 ? rent : 0
  return total - deduction
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
