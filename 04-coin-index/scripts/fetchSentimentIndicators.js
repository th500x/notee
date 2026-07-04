/**
 * 自动拉取恐惧&贪婪 + Ahr999 + 梅耶倍数 + BTC四年指数 并写入 weeklyData.json
 * node scripts/fetchSentimentIndicators.js --week=2026-W06
 * node scripts/fetchSentimentIndicators.js          # 默认：上一完整周
 */
import { resolveWeekById, getLastCompletedWeek } from './lib/weekSchedule.js'
import { loadWeeklyData, saveWeeklyData } from './lib/weeklyDataStore.js'
import { fetchWeekSentiment } from './lib/sentimentFetchers.js'

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
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { weekStart: fmt(week.startDate), weekEnd: fmt(week.endDate) }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const week = parseWeekArg(process.argv)
  const { weekStart, weekEnd } = formatWeekDates(week)

  console.log(`\n=== 情绪指标自动采集 · ${week.id} (${weekStart} – ${weekEnd}) ===\n`)

  const { fearGreed, ahr999, mayer, fourYear } = await fetchWeekSentiment(week.startDate, week.endDate)

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
    fearGreedIndex: fearGreed.weeklyAverage,
    mayerMultiple: mayer.weeklyAverage,
    ahr999: ahr999.value,
    btcFourYearIndex: fourYear.weeklyAverage,
    updatedAt: new Date().toISOString(),
    sentimentSource: {
      fearGreed: fearGreed.source,
      mayer: mayer.source,
      fourYear: fourYear.source,
      ahr999: ahr999.source,
      fetchedAt: new Date().toISOString(),
    },
    rawData: {
      ...(existing.rawData || {}),
      fearGreed: {
        weeklyAverage: fearGreed.weeklyAverage,
        daily: fearGreed.daily,
      },
      mayer: {
        weeklyAverage: mayer.weeklyAverage,
        weekEndDate: mayer.weekEndDate,
        weekEndValue: mayer.weekEndValue,
        daily: mayer.daily,
      },
      btcFourYearIndex: {
        weeklyAverage: fourYear.weeklyAverage,
        weekEndDate: fourYear.weekEndDate,
        weekEndValue: fourYear.weekEndValue,
        windowDays: fourYear.windowDays,
        daily: fourYear.daily,
      },
      ahr999: {
        date: ahr999.date,
        value: ahr999.value,
      },
    },
  }

  saveWeeklyData(data)
  console.log(
    `\n✅ 已写入 ${week.id}: 恐惧&贪婪=${fearGreed.weeklyAverage}, 梅耶=${mayer.weeklyAverage}, 四年=${fourYear.weeklyAverage}, Ahr999=${ahr999.value}`,
  )
  console.log('💡 若需重算 personalRating，请运行: npm run recalc-ratings')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
