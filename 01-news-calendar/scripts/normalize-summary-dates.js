/**
 * 为 summary 补上「M月D日，」前缀（按 JSON 挂载日）
 * node scripts/normalize-summary-dates.js 202601
 * node scripts/normalize-summary-dates.js public/news-calendar-202602.json
 */
import fs from 'fs'
import path from 'path'
import {
  publicMonthPath,
  draftPath,
  loadJson,
  parseYyyymm,
  normalizeMonthSummaryDates,
  SUMMARY_DATE_PREFIX_RE,
  SUMMARY_LEN,
} from './lib/newsMonthCommon.js'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('用法: node scripts/normalize-summary-dates.js <YYYYMM|文件路径> [更多文件…]')
  process.exit(1)
}

function resolvePaths(arg) {
  if (arg.endsWith('.json')) return [path.resolve(arg)]
  const yyyymm = parseYyyymm(arg)
  const paths = [publicMonthPath(yyyymm)]
  const draft = draftPath(yyyymm)
  if (fs.existsSync(draft)) paths.push(draft)
  return paths
}

for (const arg of args) {
  for (const filePath of resolvePaths(arg)) {
    if (!fs.existsSync(filePath)) {
      console.warn(`⏭️  跳过（不存在）: ${filePath}`)
      continue
    }

    const before = loadJson(filePath)
    let changed = 0
    for (const [day, dayData] of Object.entries(before)) {
      if (day.startsWith('_')) continue
      for (const items of Object.values(dayData)) {
        for (const item of items || []) {
          if (!SUMMARY_DATE_PREFIX_RE.test(item.summary || '')) changed++
        }
      }
    }

    const after = normalizeMonthSummaryDates(before)
    fs.writeFileSync(filePath, JSON.stringify(after, null, 2), 'utf8')

    let overMax = 0
    for (const dayData of Object.values(after)) {
      for (const items of Object.values(dayData)) {
        for (const item of items || []) {
          if ((item.summary || '').length > SUMMARY_LEN.max) overMax++
        }
      }
    }

    console.log(`✅ ${path.relative(process.cwd(), filePath)} · 补前缀 ${changed} 条${overMax ? ` · ⚠️ ${overMax} 条超 ${SUMMARY_LEN.max} 字` : ''}`)
  }
}
