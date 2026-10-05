/**
 * 去掉情绪四指标的历史占位默认值（无 sentimentSource 时），并给缺利率的周按「复用上周」补上。
 * node scripts/stripLegacyPlaceholders.js [--week=2026-W39]
 */
import { getPreviousWeekId, resolveWeekById } from './lib/weekSchedule.js'
import { loadWeeklyData, saveWeeklyData } from './lib/weeklyDataStore.js'

const PLACEHOLDERS = {
  fearGreedIndex: 50,
  mayerMultiple: 1.5,
  ahr999: 1.0,
  btcFourYearIndex: 0.8,
}

function main() {
  const weekArg = process.argv.find((a) => a.startsWith('--week='))
  const onlyId = weekArg ? weekArg.split('=')[1] : null
  const data = loadWeeklyData()
  const ids = onlyId ? [onlyId] : Object.keys(data).sort()
  let stripped = 0
  let ratesFilled = 0

  for (const weekId of ids) {
    const week = data[weekId]
    if (!week) {
      console.warn(`跳过不存在的周 ${weekId}`)
      continue
    }

    if (!week.sentimentSource) {
      for (const [field, placeholder] of Object.entries(PLACEHOLDERS)) {
        if (week[field] === placeholder) {
          delete week[field]
          stripped += 1
          console.log(`🧹 ${weekId}: 移除占位 ${field}=${placeholder}`)
        }
      }
      // 占位评级 3 且无 indicatorScores 时也清掉，避免日历误导
      if (week.personalRating === 3 && !week.indicatorScores) {
        delete week.personalRating
        console.log(`🧹 ${weekId}: 移除占位 personalRating=3`)
      }
    }

    const needRates =
      typeof week.fedRate !== 'number' || typeof week.bojRate !== 'number'
    if (needRates) {
      const prevId = getPreviousWeekId(weekId)
      const prev = prevId ? data[prevId] : null
      if (prev && typeof prev.fedRate === 'number' && typeof prev.bojRate === 'number') {
        week.fedRate = prev.fedRate
        week.bojRate = prev.bojRate
        week.macroSource = {
          lagReuse: true,
          reusedFrom: prevId,
          provisional: false,
          fetchedAt: new Date().toISOString(),
        }
        ratesFilled += 1
        console.log(`📎 ${weekId}: 利率复用 ${prevId} (fed=${prev.fedRate}, boj=${prev.bojRate})`)
      } else {
        console.log(`⚠️ ${weekId}: 无上周利率可复用`)
      }
    }

    week.updatedAt = new Date().toISOString()
    data[weekId] = week
    // touch resolve for side-effect free validation
    resolveWeekById(weekId)
  }

  saveWeeklyData(data)
  console.log(`\n✅ 完成：去掉占位 ${stripped} 处，补利率 ${ratesFilled} 周`)
}

main()
