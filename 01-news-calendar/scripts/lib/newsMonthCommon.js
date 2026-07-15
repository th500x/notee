import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = path.resolve(__dirname, '../..')

export const CATEGORIES = [
  'world_politics',
  'world_economy',
  'asia_politics',
  'asia_economy',
  'thailand_politics',
  'thailand_society',
]

export const GROUPS = {
  world: { keys: ['world_politics', 'world_economy'], label: 'A 世界组', quota: 20 },
  asia: { keys: ['asia_politics', 'asia_economy'], label: 'B 亚洲组', quota: 20 },
  cnTh: { keys: ['thailand_politics', 'thailand_society'], label: 'C 中泰组', quota: 20 },
}

export const SUMMARY_LEN = { min: 50, max: 150, target: 100 }

/** summary 须以此开头，如「3月12日，」 */
export const SUMMARY_DATE_PREFIX_RE = /^\d{1,2}月\d{1,2}日[，,]/

export function dayKeyToSummaryPrefix(dayKey) {
  const m = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error(`无效日期 key: ${dayKey}`)
  return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日，`
}

/** 为 summary 补上挂载日日期前缀（与 202603+ 格式一致） */
export function normalizeSummaryDatePrefix(dayKey, summary) {
  if (!summary?.trim()) return summary
  if (SUMMARY_DATE_PREFIX_RE.test(summary)) return summary

  let body = summary.trim()
  const looseLead = body.match(/^(\d{1,2})月(\d{1,2})日[^，,\n]{0,12}[，,]?\s*/)
  if (looseLead) body = body.slice(looseLead[0].length)

  return dayKeyToSummaryPrefix(dayKey) + body
}

export function normalizeMonthSummaryDates(data) {
  const out = { ...data }
  for (const [day, dayData] of Object.entries(data)) {
    if (day.startsWith('_') || typeof dayData !== 'object') continue
    out[day] = { ...dayData }
    for (const cat of CATEGORIES) {
      out[day][cat] = (dayData[cat] || []).map((item) => ({
        ...item,
        summary: normalizeSummaryDatePrefix(day, item.summary),
      }))
    }
  }
  return out
}

export function monthFileName(yyyymm) {
  if (!/^\d{6}$/.test(yyyymm)) {
    throw new Error(`无效月份: ${yyyymm}，应为 YYYYMM`)
  }
  return `news-calendar-${yyyymm}.json`
}

export function publicMonthPath(yyyymm) {
  return path.join(projectRoot, 'public', monthFileName(yyyymm))
}

export function draftPath(yyyymm) {
  return path.join(projectRoot, 'docs/tools', `draft-news-${yyyymm}.json`)
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function stripLinkFromItem(item) {
  if (!item || typeof item !== 'object') return item
  const { link, ...rest } = item
  return rest
}

export function stripLinksFromMonthData(data) {
  const out = {}
  for (const [day, dayData] of Object.entries(data)) {
    if (day.startsWith('_')) continue
    out[day] = {}
    for (const cat of CATEGORIES) {
      const items = dayData[cat] || []
      out[day][cat] = items.map(stripLinkFromItem)
    }
  }
  return out
}

export function countGroupTotals(data) {
  const totals = {}
  for (const [groupKey, group] of Object.entries(GROUPS)) {
    totals[groupKey] = {}
    let sum = 0
    for (const cat of group.keys) {
      let n = 0
      for (const day of Object.values(data)) {
        if (day && typeof day === 'object') {
          n += (day[cat] || []).length
        }
      }
      totals[groupKey][cat] = n
      sum += n
    }
    totals[groupKey].total = sum
  }
  return totals
}

export function parseYyyymm(arg) {
  if (/^\d{6}$/.test(arg)) return arg
  const m = arg.match(/news-calendar-(\d{6})\.json/) || arg.match(/draft-news-(\d{6})\.json/)
  if (m) return m[1]
  throw new Error(`无法解析月份: ${arg}`)
}
