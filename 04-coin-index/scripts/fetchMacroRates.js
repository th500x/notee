/**
 * 自动写入 fedRate / bojRate
 * node scripts/fetchMacroRates.js --week=2026-W07
 */
import { resolveWeekById, getLastCompletedWeek } from './lib/weekSchedule.js'
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

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const week = parseWeekArg(process.argv)
  const { weekStart, weekEnd } = formatWeekDates(week)

  console.log(`\n=== 宏观利率 · ${week.id} (${weekStart} – ${weekEnd}) ===\n`)

  const { fedRate, bojRate, sources, warnings } = await fetchMacroRatesForWeek(
    week.startDate,
    week.endDate,
  )

  console.log(`美联储 fedRate: ${fedRate}% (${sources.fedRate})`)
  console.log(`日央行 bojRate: ${bojRate}% (${sources.bojRate})`)
  for (const w of warnings) console.log(`⚠️  ${w}`)

  if (dryRun) {
    console.log('\n🏁 --dry-run：未写入文件')
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

  data[week.id] = {
    ...existing,
    weekStart: existing.weekStart || weekStart,
    weekEnd: existing.weekEnd || weekEnd,
    fedRate,
    bojRate,
    updatedAt: new Date().toISOString(),
    macroSource: {
      ...sources,
      fetchedAt: new Date().toISOString(),
      warnings,
    },
  }

  saveWeeklyData(data)
  console.log(`\n✅ 已写入 ${week.id}: fedRate=${fedRate}, bojRate=${bojRate}`)
  console.log('💡 请运行: npm run recalc-ratings')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
