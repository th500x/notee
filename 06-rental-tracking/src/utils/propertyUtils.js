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

/** 房源列表「大额/佣金/物业」提示：当月支出阈值（泰铢） */
export const MONTHLY_EXPENSE_TIP_THRESHOLD = 2000

/**
 * 根据当月收支记录生成房源编号下方的红色提示文案。
 * - 备注含「半佣」的记录不参与合计与分类（不标大额/佣金/物业）
 * - 其余记录当月支出合计不足 2000：无提示
 * - ≥2000 且备注含「佣金」→「佣金支出」
 * - ≥2000 且备注含「物业费」→「物业支出」
 * - 否则 ≥2000 →「大额支出」
 * 佣金优先于物业费；二者都不命中时才显示「大额支出」。
 *
 * @param {Object} property
 * @param {string} monthKey - YYYY-MM
 * @returns {string|null}
 */
export function getMonthlyExpenseTipLabel(property, monthKey) {
  if (!property || !monthKey) return null
  const records = (property.records || []).filter((r) => {
    if (r.date !== monthKey) return false
    return !String(r.note || '').includes('半佣')
  })
  if (records.length === 0) return null

  const totalExpenses = records.reduce((sum, r) => sum + (Number(r.expenses) || 0), 0)
  if (totalExpenses < MONTHLY_EXPENSE_TIP_THRESHOLD) return null

  const notesJoined = records.map((r) => String(r.note || '')).join('\n')
  if (notesJoined.includes('佣金')) return '佣金支出'
  if (notesJoined.includes('物业费')) return '物业支出'
  return '大额支出'
}
