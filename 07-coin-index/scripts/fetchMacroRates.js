/**
 * 自动写入 fedRate / bojRate
 *
 * 默认（采当周）：
 * 1) 先联网拉取「上一周」的真实利率并写回上周（定稿）
 * 2) 当周利率复用上周数值（lagReuse），不查当周官方源
 *
 * --finalize：只为指定周拉真实利率（给 collect-missing 重取暂定值用）
 *
 * node scripts/fetchMacroRates.js --week=2026-W39
 * node scripts/fetchMacroRates.js --week=2026-W38 --finalize
 */
import { resolveWeekById, getLastCompletedWeek, getPreviousWeekId } from './lib/weekSchedule.js'
import { loadWeeklyData, saveWeeklyData } from './lib/weeklyDataStore.js'
import { fetchMacroRatesForWeek } from './lib/macroRateFetcher.js'

function parseWeekArg(argv) {
  const arg = argv.find((a) => a.startsWith('--week='))
  if (arg) {
    const id = arg.split('=')[1]
    const week = resolveWeekById(id)
    if (!week) throw new Error(`未知周 ID: ${id}`)
    return week
  }
  const last = getLastCompletedWeek()
  if (!last) throw new Error('未找到已结束的完整周')
  return last
}

function formatWeekDates(week) {
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { weekStart: fmt(week.startDate), weekEnd: fmt(week.endDate) }
}

function applyRealRates(data, week, result) {
  const { weekStart, weekEnd } = formatWeekDates(week)
  const existing = data[week.id] || {
    weekId: week.id,
    year: week.year,
    weekNumber: week.weekNumber,
    weekStart,
    weekEnd,
  }
  data[week.id] = {
    ...existing,
    weekStart: existing.weekStart || weekStart,
    weekEnd: existing.weekEnd || weekEnd,
    fedRate: result.fedRate,
    bojRate: result.bojRate,
    updatedAt: new Date().toISOString(),
    macroSource: {
      ...result.sources,
      asOf: result.asOf,
      bojCheck: result.bojCheck,
      provisional: result.provisional,
      lagReuse: false,
      fetchedAt: new Date().toISOString(),
    },
  }
}

async function finalizeWeek(week, dryRun) {
  const { weekStart, weekEnd } = formatWeekDates(week)
  console.log(`\n=== 宏观利率定稿 · ${week.id} (${weekStart} – ${weekEnd}) ===\n`)

  const result = await fetchMacroRatesForWeek(week.startDate, week.endDate)
  console.log(`美联储 fedRate: ${result.fedRate}% (${result.sources.fedRate}，数据截至 ${result.asOf.fedRate})`)
  console.log(`日央行 bojRate: ${result.bojRate}% (${result.sources.bojRate}，数据截至 ${result.asOf.bojRate})`)
  console.log(`   核对: ${result.bojCheck.date} 隔夜拆借利率 ${result.bojCheck['FM01/STRDCLUCON']}%`)
  if (result.provisional) {
    console.log('⏳ 官方数据还没发布到周结束日，本次为暂定值；collect-missing 下次运行会重取')
  }

  if (dryRun) {
    console.log('\n🏁 --dry-run：未写入文件')
    return
  }

  const data = loadWeeklyData()
  applyRealRates(data, week, result)
  saveWeeklyData(data)
  console.log(
    `\n✅ 已写入 ${week.id}: fedRate=${result.fedRate}, bojRate=${result.bojRate}${result.provisional ? '（暂定）' : ''}`,
  )
}

async function collectWithLagReuse(week, dryRun) {
  const { weekStart, weekEnd } = formatWeekDates(week)
  console.log(`\n=== 宏观利率（滞后一周复用）· ${week.id} (${weekStart} – ${weekEnd}) ===\n`)

  const prevId = getPreviousWeekId(week.id)
  const prevWeek = prevId ? resolveWeekById(prevId) : null

  if (prevWeek) {
    console.log(`▶ 定稿上周 ${prevWeek.id} 真实利率…`)
    try {
      const realPrev = await fetchMacroRatesForWeek(prevWeek.startDate, prevWeek.endDate)
      console.log(
        `   ✅ ${prevWeek.id}: fed=${realPrev.fedRate} boj=${realPrev.bojRate}` +
          (realPrev.provisional ? '（官方尚未覆盖周末，仍为暂定）' : ''),
      )
      if (!dryRun) {
        const data = loadWeeklyData()
        applyRealRates(data, prevWeek, realPrev)
        saveWeeklyData(data)
      }
    } catch (err) {
      console.warn(`   ⚠️ 上周 ${prevWeek.id} 真值拉取失败，将尽量复用库内已有利率: ${err.message}`)
    }
  } else {
    console.log('▶ 无上一周可定稿（首周）')
  }

  if (dryRun) {
    console.log('\n🏁 --dry-run：未写入当周复用')
    return
  }

  const data = loadWeeklyData()
  const existing = data[week.id] || {
    weekId: week.id,
    year: week.year,
    weekNumber: week.weekNumber,
    weekStart,
    weekEnd,
  }
  const prevRecord = prevId ? data[prevId] : null

  if (
    prevRecord &&
    typeof prevRecord.fedRate === 'number' &&
    typeof prevRecord.bojRate === 'number'
  ) {
    data[week.id] = {
      ...existing,
      weekStart: existing.weekStart || weekStart,
      weekEnd: existing.weekEnd || weekEnd,
      fedRate: prevRecord.fedRate,
      bojRate: prevRecord.bojRate,
      updatedAt: new Date().toISOString(),
      macroSource: {
        lagReuse: true,
        reusedFrom: prevId,
        provisional: false,
        fetchedAt: new Date().toISOString(),
      },
    }
    saveWeeklyData(data)
    console.log(
      `\n✅ ${week.id} 利率复用 ${prevId}: fedRate=${prevRecord.fedRate}, bojRate=${prevRecord.bojRate}`,
    )
  } else {
    delete existing.fedRate
    delete existing.bojRate
    delete existing.macroSource
    data[week.id] = {
      ...existing,
      weekStart: existing.weekStart || weekStart,
      weekEnd: existing.weekEnd || weekEnd,
      updatedAt: new Date().toISOString(),
    }
    saveWeeklyData(data)
    console.log(`\n⚠️ ${week.id} 无上周利率可复用，fedRate/bojRate 留空（页面显示 --）`)
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const finalize = process.argv.includes('--finalize')
  const week = parseWeekArg(process.argv)

  if (finalize) {
    await finalizeWeek(week, dryRun)
  } else {
    await collectWithLagReuse(week, dryRun)
  }
  console.log('💡 请运行: npm run recalc-ratings')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
