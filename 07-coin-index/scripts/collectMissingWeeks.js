/**
 * 补采所有已结束、但没有记录或指标不全的周（含上一完整周），按时间先后逐周跑 collect-week。
 * 曼谷机每周一 UTC 00:05 由 systemd 定时器经 scripts/weekly-auto-collect.sh 调用。
 *
 * node scripts/collectMissingWeeks.js [--dry-run]
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getAllConfiguredWeeks,
  getLastCompletedWeek,
  weekNeedsPriceCollection,
} from './lib/weekSchedule.js'
import { loadWeeklyData } from './lib/weeklyDataStore.js'
import { delay } from './lib/apiDelay.js'

const BETWEEN_WEEKS_DELAY = 90000
const DAY_MS = 86400000

const REQUIRED_FIELDS = [
  'btcWeeklyAvgPrice',
  'ethWeeklyAvgPrice',
  'btcWeeklyChange',
  'ethBtcRatio',
  'fearGreedIndex',
  'mayerMultiple',
  'ahr999',
  'btcFourYearIndex',
  'fedRate',
  'bojRate',
  'personalRating',
]

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function weekIsIncomplete(record, week) {
  if (!record) return true
  if (weekNeedsPriceCollection(record, week)) return true
  return REQUIRED_FIELDS.some((field) => typeof record[field] !== 'number')
}

function findWeeksToCollect(data, referenceDate = new Date()) {
  const last = getLastCompletedWeek(referenceDate)
  if (!last) throw new Error('未找到已结束的完整周')

  const today = new Date(referenceDate)
  today.setHours(12, 0, 0, 0)
  if (today.getTime() - last.endDate.getTime() > 7 * DAY_MS) {
    throw new Error(
      `周历只配置到 ${last.id}（${last.endDate.toDateString()} 结束），` +
        '请先在 scripts/lib/weekSchedule.js 与 src/utils/weekCalculator.js 补上新的一年',
    )
  }

  return getAllConfiguredWeeks()
    .filter((week) => week.endDate <= last.endDate)
    .filter((week) => weekIsIncomplete(data[week.id], week))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const weeks = findWeeksToCollect(loadWeeklyData())

  if (weeks.length === 0) {
    console.log('✅ 已结束的周都有完整数据，无需采集')
    return
  }

  console.log(`📋 待采集 ${weeks.length} 周: ${weeks.map((w) => w.id).join(', ')}`)
  if (dryRun) {
    console.log('🏁 --dry-run：不采集')
    return
  }

  for (const [index, week] of weeks.entries()) {
    if (index > 0) {
      console.log(`\n⏸️  周间冷却 ${BETWEEN_WEEKS_DELAY / 1000}s…`)
      await delay(BETWEEN_WEEKS_DELAY)
    }
    console.log(`\n${'#'.repeat(60)}\n# ${week.id}\n${'#'.repeat(60)}`)
    const result = spawnSync(process.execPath, ['scripts/collectWeek.js', `--week=${week.id}`], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    if (result.status !== 0) {
      throw new Error(`${week.id} 采集失败 (exit ${result.status})，后面的周未采集`)
    }
  }

  console.log(`\n✅ 采集完成: ${weeks.map((w) => w.id).join(', ')}`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
