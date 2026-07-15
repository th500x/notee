/**
 * 宏观利率辅助表 — Fed 以 FRED 为准；BOJ 官方 API 返回值异常，用生效日时间线 + Agent 检索兜底
 */

/** @type {{ effectiveFrom: string, rate: number, note?: string }[]} 生效日 YYYY-MM-DD（含当日）起适用 */
export const BOJ_POLICY_TIMELINE = [
  { effectiveFrom: '2025-12-19', rate: 0.75, note: '2025年12月MPM加息至0.75%' },
  { effectiveFrom: '2025-01-24', rate: 0.5, note: '2025年1月MPM加息至0.50%' },
  { effectiveFrom: '2024-07-31', rate: 0.25, note: '2024年7月MPM加息至0.25%' },
  { effectiveFrom: '2024-03-19', rate: 0.1, note: '结束负利率' },
]

/** 2026 年 BOJ MPM 预定日（含决策日）；若目标周与此重叠，Agent 应联网确认周内生效值 */
export const BOJ_MPM_DATES_2026 = [
  '2026-01-23',
  '2026-03-19',
  '2026-04-29',
  '2026-06-17',
  '2026-07-31',
  '2026-09-18',
  '2026-10-29',
  '2026-12-18',
]

/** 2026 年 FOMC 声明日（美东）；若目标周与此重叠，Agent 应联网确认 */
export const FOMC_STATEMENT_DATES_2026 = [
  '2026-01-28',
  '2026-03-18',
  '2026-05-06',
  '2026-06-17',
  '2026-07-29',
  '2026-09-16',
  '2026-11-04',
  '2026-12-16',
]

export function formatYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getBojRateForDate(date) {
  const ymd = formatYmd(date)
  for (const entry of BOJ_POLICY_TIMELINE) {
    if (ymd >= entry.effectiveFrom) return entry.rate
  }
  return null
}

export function weekOverlapsDates(weekStart, weekEnd, dates) {
  const start = formatYmd(weekStart)
  const end = formatYmd(weekEnd)
  return dates.some((d) => d >= start && d <= end)
}
