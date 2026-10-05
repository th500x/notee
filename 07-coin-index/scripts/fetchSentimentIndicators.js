/**
 * 自动拉取恐惧&贪婪 + Ahr999 + 梅耶倍数 + BTC四年指数 并写入 weeklyData.json
 * 单项缺失不写占位默认值（页面显示 --）；有成功项则写入并 exit 0，便于后续利率步骤继续。
 * node scripts/fetchSentimentIndicators.js --week=2026-W06
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

  const { fearGreed, ahr999, mayer, fourYear, errors } = await fetchWeekSentiment(
    week.startDate,
    week.endDate,
  )

  const wroteAny = Boolean(fearGreed || ahr999 || mayer || fourYear)
  if (!wroteAny) {
    throw new Error(`情绪指标全部失败: ${errors.join('；') || '未知'}`)
  }

  if (dryRun) {
    console.log('\n🏁 --dry-run：未写入文件')
    if (errors.length) console.log(`⚠️ 部分失败: ${errors.join('；')}`)
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

  const next = {
    ...existing,
    weekStart: existing.weekStart || weekStart,
    weekEnd: existing.weekEnd || weekEnd,
    updatedAt: new Date().toISOString(),
    sentimentSource: {
      ...(existing.sentimentSource || {}),
      fetchedAt: new Date().toISOString(),
      errors: errors.length ? errors : undefined,
    },
    rawData: {
      ...(existing.rawData || {}),
    },
  }

  if (fearGreed) {
    next.fearGreedIndex = fearGreed.weeklyAverage
    next.sentimentSource.fearGreed = fearGreed.source
    next.rawData.fearGreed = {
      weeklyAverage: fearGreed.weeklyAverage,
      daily: fearGreed.daily,
    }
  }
  if (mayer) {
    next.mayerMultiple = mayer.weeklyAverage
    next.sentimentSource.mayer = mayer.source
    next.rawData.mayer = {
      weeklyAverage: mayer.weeklyAverage,
      weekEndDate: mayer.weekEndDate,
      weekEndValue: mayer.weekEndValue,
      daily: mayer.daily,
    }
  }
  if (fourYear) {
    next.btcFourYearIndex = fourYear.weeklyAverage
    next.sentimentSource.fourYear = fourYear.source
    next.rawData.btcFourYearIndex = {
      weeklyAverage: fourYear.weeklyAverage,
      weekEndDate: fourYear.weekEndDate,
      weekEndValue: fourYear.weekEndValue,
      windowDays: fourYear.windowDays,
      daily: fourYear.daily,
    }
  }
  if (ahr999) {
    next.ahr999 = ahr999.value
    next.sentimentSource.ahr999 = ahr999.source
    next.rawData.ahr999 = {
      date: ahr999.date,
      value: ahr999.value,
    }
  }

  data[week.id] = next
  saveWeeklyData(data)

  const parts = [
    fearGreed ? `恐惧&贪婪=${fearGreed.weeklyAverage}` : '恐惧&贪婪=--',
    mayer ? `梅耶=${mayer.weeklyAverage}` : '梅耶=--',
    fourYear ? `四年=${fourYear.weeklyAverage}` : '四年=--',
    ahr999 ? `Ahr999=${ahr999.value}` : 'Ahr999=--',
  ]
  console.log(`\n✅ 已写入 ${week.id}: ${parts.join(', ')}`)
  if (errors.length) {
    console.log(`⚠️ 部分未取到（不写占位，页面显示 --）: ${errors.join('；')}`)
  }
  console.log('💡 若需重算 personalRating，请运行: npm run recalc-ratings')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
