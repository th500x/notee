/**
 * 周历定义 — 与 src/utils/weekCalculator.js + src/constants 对齐（脚本侧副本）
 */
const WEEK_LIMITS = { STANDARD_WEEKS: 52 }

const SPECIAL_WEEKS = {
  '2025-W53': { start: new Date(2025, 11, 29), end: new Date(2026, 0, 4) },
  '2026-W52': { start: new Date(2026, 11, 28), end: new Date(2027, 0, 3) },
}

const SPECIAL_WEEKS_2026 = [
  { start: new Date(2026, 0, 5), end: new Date(2026, 0, 11), num: 1 },
  { start: new Date(2026, 0, 12), end: new Date(2026, 0, 18), num: 2 },
  { start: new Date(2026, 0, 19), end: new Date(2026, 0, 25), num: 3 },
  { start: new Date(2026, 0, 26), end: new Date(2026, 1, 1), num: 4 },
]

const formatWeekId = (year, weekNum) =>
  `${year}-W${weekNum.toString().padStart(2, '0')}`

const atNoon = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)

export function getWeeksInYear(year) {
  const weeks = []

  if (year === 2025) {
    let currentDate = new Date(year, 0, 1)
    const dayOfWeek = currentDate.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    currentDate.setDate(currentDate.getDate() + daysToMonday)

    for (let weekNum = 1; weekNum <= WEEK_LIMITS.STANDARD_WEEKS; weekNum++) {
      const weekEnd = new Date(currentDate)
      weekEnd.setDate(currentDate.getDate() + 6)
      weeks.push({
        id: formatWeekId(year, weekNum),
        weekNumber: weekNum,
        startDate: atNoon(currentDate),
        endDate: atNoon(weekEnd),
        year,
      })
      currentDate.setDate(currentDate.getDate() + 7)
    }

    const w53 = SPECIAL_WEEKS['2025-W53']
    weeks.push({
      id: '2025-W53',
      weekNumber: 53,
      startDate: atNoon(w53.start),
      endDate: atNoon(w53.end),
      year: 2025,
    })
  } else if (year === 2026) {
    SPECIAL_WEEKS_2026.forEach((week) => {
      weeks.push({
        id: formatWeekId(year, week.num),
        weekNumber: week.num,
        startDate: atNoon(week.start),
        endDate: atNoon(week.end),
        year,
      })
    })

    let currentDate = atNoon(new Date(2026, 1, 2))
    for (let weekNum = 5; weekNum <= 51; weekNum++) {
      const weekEnd = new Date(currentDate)
      weekEnd.setDate(currentDate.getDate() + 6)
      weeks.push({
        id: formatWeekId(year, weekNum),
        weekNumber: weekNum,
        startDate: new Date(currentDate),
        endDate: atNoon(weekEnd),
        year,
      })
      currentDate.setDate(currentDate.getDate() + 7)
    }

    const w52 = SPECIAL_WEEKS['2026-W52']
    weeks.push({
      id: '2026-W52',
      weekNumber: 52,
      startDate: atNoon(w52.start),
      endDate: atNoon(w52.end),
      year: 2026,
    })
  }

  return weeks
}

export function getAllConfiguredWeeks() {
  return [...getWeeksInYear(2025), ...getWeeksInYear(2026)]
}

/** 今天 12:00 本地；周结束日 < 今天 → 视为已结束的完整周 */
export function getLastCompletedWeek(referenceDate = new Date()) {
  const today = atNoon(referenceDate)
  const completed = getAllConfiguredWeeks().filter((w) => w.endDate < today)
  if (completed.length === 0) return null
  return completed[completed.length - 1]
}

export function getPreviousWeekId(weekId) {
  const all = getAllConfiguredWeeks()
  const idx = all.findIndex((w) => w.id === weekId)
  if (idx <= 0) return null
  return all[idx - 1].id
}

export function resolveWeekById(weekId) {
  return getAllConfiguredWeeks().find((w) => w.id === weekId) || null
}

/**
 * 默认：仅「上一完整周」且 public 中缺价或价数据不完整。
 * --week=2026-W05 可显式指定；--dry-run 只打印计划。
 */
export function resolveWeeksToCollect(existingData, argv = process.argv) {
  const weekArg = argv.find((a) => a.startsWith('--week='))
  if (weekArg) {
    const id = weekArg.split('=')[1]
    const week = resolveWeekById(id)
    if (!week) throw new Error(`未知周 ID: ${id}`)
    return [week]
  }

  const last = getLastCompletedWeek()
  if (!last) {
    console.log('⚠️ 未找到已结束的周（可能日历未配置或日期过早）')
    return []
  }

  const existing = existingData[last.id]
  if (!existing) {
    console.log(`📋 ${last.id}: 无记录，需收集`)
    return [last]
  }

  if (weekNeedsPriceCollection(existing, last)) {
    console.log(`📋 ${last.id}: 价格数据不完整，需增量收集`)
    return [last]
  }

  console.log(`✅ ${last.id}: 价格数据已完整，跳过 API 收集`)
  return []
}

export function weekNeedsPriceCollection(weekData, weekDef) {
  if (!weekData?.rawData?.btc?.dates?.length || !weekData?.rawData?.eth?.dates?.length) {
    return true
  }

  const expectedDays = daysBetween(weekDef.startDate, weekDef.endDate)
  const btcComplete = weekData.rawData.btc.dates.length >= expectedDays
  const ethComplete = weekData.rawData.eth.dates.length >= expectedDays
  const hasChange = weekData.btcWeeklyChange !== undefined && weekData.btcWeeklyChange !== null
  const hasRatio = weekData.ethBtcRatio !== undefined && weekData.ethBtcRatio !== null

  return !(btcComplete && ethComplete && hasChange && hasRatio)
}

function daysBetween(start, end) {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}
