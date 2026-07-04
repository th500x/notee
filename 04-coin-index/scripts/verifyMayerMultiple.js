/**
 * 验证 Mayer / BTC四年指数（复用 btcDailySeries）
 * node scripts/verifyMayerMultiple.js --week=2026-W06
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveWeekById } from './lib/weekSchedule.js'
import { fetchMayerAndFourYear } from './lib/btcDailySeries.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../public/weeklyData.json')

async function main() {
  const weekArg = process.argv.find((a) => a.startsWith('--week='))
  const weekId = weekArg?.split('=')[1] || '2026-W06'
  const week = resolveWeekById(weekId)
  if (!week) throw new Error(`未知周: ${weekId}`)

  console.log(`\n=== Mayer & 四年指数验证 · ${weekId} ===\n`)

  const { mayer, fourYear, source } = await fetchMayerAndFourYear(week.startDate, week.endDate)

  console.log(`[Mayer 200SMA] 周均 ${mayer.weeklyAverage}，周末 ${mayer.weekEndValue}`)
  for (const row of mayer.daily) {
    console.log(`  ${row.date}  mayer=${row.value}`)
  }

  console.log(`\n[四年 1460SMA] 周均 ${fourYear.weeklyAverage}，周末 ${fourYear.weekEndValue}（${source}）`)
  for (const row of fourYear.daily) {
    console.log(`  ${row.date}  fourYear=${row.value}`)
  }

  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const weekData = data[weekId]
  console.log(`\n📋 JSON: mayer=${weekData?.mayerMultiple ?? '—'}, 四年=${weekData?.btcFourYearIndex ?? '—'}`)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
