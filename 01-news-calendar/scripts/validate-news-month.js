/**
 * 校验月度新闻 JSON
 * node scripts/validate-news-month.js 202601
 * node scripts/validate-news-month.js public/news-calendar-202601.json
 */
import fs from 'fs'
import path from 'path'
import {
  CATEGORIES,
  GROUPS,
  SUMMARY_LEN,
  publicMonthPath,
  loadJson,
  countGroupTotals,
  parseYyyymm,
  stripLinksFromMonthData,
} from './lib/newsMonthCommon.js'

const args = process.argv.slice(2)
const stripLinks = args.includes('--strip-links')
const fileArgs = args.filter((a) => !a.startsWith('--'))

if (fileArgs.length === 0) {
  console.error('用法: node scripts/validate-news-month.js <YYYYMM|文件路径> [--strip-links]')
  process.exit(1)
}

const yyyymm = parseYyyymm(fileArgs[0])
const filePath = fileArgs[0].endsWith('.json')
  ? path.resolve(fileArgs[0])
  : publicMonthPath(yyyymm)

if (!fs.existsSync(filePath)) {
  console.error(`❌ 文件不存在: ${filePath}`)
  process.exit(1)
}

let data = loadJson(filePath)
const errors = []
const warnings = []

if (stripLinks) {
  data = stripLinksFromMonthData(data)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`🔗 已移除 link 并写回: ${filePath}`)
}

for (const [day, dayData] of Object.entries(data)) {
  if (day.startsWith('_')) continue
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    errors.push(`无效日期 key: ${day}`)
    continue
  }
  if (!day.startsWith(yyyymm.slice(0, 4) + '-' + yyyymm.slice(4))) {
    const monthPrefix = `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`
    if (!day.startsWith(monthPrefix)) {
      warnings.push(`${day} 不在目标月 ${monthPrefix}`)
    }
  }
  if (!dayData || typeof dayData !== 'object') {
    errors.push(`${day}: 日对象无效`)
    continue
  }
  for (const cat of CATEGORIES) {
    if (!Array.isArray(dayData[cat])) {
      errors.push(`${day}.${cat}: 应为数组`)
    }
  }
  for (const cat of CATEGORIES) {
    for (const [i, item] of (dayData[cat] || []).entries()) {
      const loc = `${day}.${cat}[${i}]`
      if (!item?.title?.trim()) errors.push(`${loc}: 缺少 title`)
      if (!item?.summary?.trim()) errors.push(`${loc}: 缺少 summary`)
      if (item?.link !== undefined) {
        errors.push(`${loc}: 不应含 link 字段（请 --strip-links 或重新导出）`)
      }
      const len = (item?.summary || '').length
      if (len < SUMMARY_LEN.min) warnings.push(`${loc}: summary 仅 ${len} 字（建议 ≥${SUMMARY_LEN.min}）`)
      if (len > SUMMARY_LEN.max) warnings.push(`${loc}: summary ${len} 字（建议 ≤${SUMMARY_LEN.max}）`)
    }
  }
}

const totals = countGroupTotals(data)
console.log(`\n📂 ${path.basename(filePath)} · ${Object.keys(data).filter((k) => !k.startsWith('_')).length} 天`)

for (const [groupKey, group] of Object.entries(GROUPS)) {
  const t = totals[groupKey]
  const detail = group.keys.map((k) => `${k}=${t[k]}`).join(', ')
  const ok = t.total === group.quota
  console.log(`${ok ? '✅' : '❌'} ${group.label}: ${t.total}/${group.quota} (${detail})`)
  if (!ok) errors.push(`${group.label} 应为 ${group.quota} 条，实际 ${t.total}`)
}

const totalItems = Object.values(totals).reduce((s, g) => s + g.total, 0)
console.log(`📊 合计: ${totalItems} 条\n`)

if (warnings.length) {
  console.log(`⚠️  警告 ${warnings.length} 条:`)
  warnings.slice(0, 15).forEach((w) => console.log(`   - ${w}`))
  if (warnings.length > 15) console.log(`   ... 另有 ${warnings.length - 15} 条`)
}

if (errors.length) {
  console.log(`\n❌ 错误 ${errors.length} 条:`)
  errors.forEach((e) => console.log(`   - ${e}`))
  process.exit(1)
}

console.log('✅ 校验通过')
process.exit(0)
