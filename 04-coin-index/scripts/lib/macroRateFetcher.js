/**
 * 美联储 / 日央行政策利率 — 周内生效值
 * Fed: FRED DFEDTARL（目标区间下限，与历史周 fedRate 字段一致）
 * BOJ: macroRateSchedule 时间线（遇 MPM 周需 Agent 联网复核）
 */
import {
  formatYmd,
  getBojRateForDate,
  weekOverlapsDates,
  BOJ_MPM_DATES_2026,
  FOMC_STATEMENT_DATES_2026,
} from './macroRateSchedule.js'

const FRED_FED_LOWER_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARL'

let fedSeriesCache = null

async function loadFedSeries() {
  if (fedSeriesCache) return fedSeriesCache

  const response = await fetch(FRED_FED_LOWER_URL)
  if (!response.ok) {
    throw new Error(`FRED DFEDTARL HTTP ${response.status}`)
  }

  const text = await response.text()
  const rows = text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(',')
      return { date, value: parseFloat(value) }
    })
    .filter((r) => r.date && !Number.isNaN(r.value))

  fedSeriesCache = rows
  return rows
}

/** 取周内最后一个观测日的目标区间下限 */
export async function fetchFedLowerBoundForWeek(weekStart, weekEnd) {
  const start = formatYmd(weekStart)
  const end = formatYmd(weekEnd)
  const series = await loadFedSeries()

  let last = null
  for (const row of series) {
    if (row.date < start) continue
    if (row.date > end) break
    last = row.value
  }

  if (last === null) {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].date <= end) {
        last = series[i].value
        break
      }
    }
  }

  if (last === null) {
    throw new Error(`FRED 无 ${start}–${end} 的联邦基金目标区间下限`)
  }

  return parseFloat(last.toFixed(2))
}

export function resolveBojRateForWeek(weekStart, weekEnd) {
  const rate = getBojRateForDate(weekEnd)
  if (rate === null) {
    throw new Error('BOJ 时间线无匹配利率，请 Agent 检索日本央行官网后手工写入')
  }
  return parseFloat(rate.toFixed(2))
}

export function getMacroRateWarnings(weekStart, weekEnd) {
  const warnings = []
  if (weekOverlapsDates(weekStart, weekEnd, FOMC_STATEMENT_DATES_2026)) {
    warnings.push('该周含 FOMC 会议日，请 Agent 检索美联储声明确认 fedRate（脚本已用 FRED 周内值）')
  }
  if (weekOverlapsDates(weekStart, weekEnd, BOJ_MPM_DATES_2026)) {
    warnings.push('该周含 BOJ MPM 决策日，请 Agent 检索 boj.or.jp 确认 bojRate')
  }
  return warnings
}

export async function fetchMacroRatesForWeek(weekStart, weekEnd) {
  const [fedRate, bojRate] = await Promise.all([
    fetchFedLowerBoundForWeek(weekStart, weekEnd),
    Promise.resolve(resolveBojRateForWeek(weekStart, weekEnd)),
  ])

  return {
    fedRate,
    bojRate,
    sources: {
      fedRate: 'FRED:DFEDTARL',
      bojRate: 'macroRateSchedule:BOJ_POLICY_TIMELINE',
    },
    warnings: getMacroRateWarnings(weekStart, weekEnd),
  }
}
